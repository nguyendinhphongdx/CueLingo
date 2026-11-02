import AudioCapture
import AVFoundation
import Foundation
import LocalSTT

// cuelingo-audio: captures system audio + mic, transcribes on-device, prints one JSON object per line.
// stdout events: {"type":"status","state":"loading|ready|error","message":…}
//                {"type":"segment","segmentId","stream","startMs","endMs","text","words":[],"partial"}
//                {"type":"model","language","state":"downloading|ready|error","progress":0...1,"message"}
//                {"type":"stats","language","count","p50Ms","p95Ms"}  (recognition time, once at the end)
// stdin: a line "stop" ends the session; "vocab ["SLA",...]" replaces the glossary terms;
//        "language ja" switches the recognition model (captions continue on the old one until it is ready).
// env CUELINGO_VOCAB: the same JSON array, applied at start. env CUELINGO_LANGUAGE: language at start (default en).

let out = FileHandle.standardOutput
let writeLock = NSLock()
func emit(_ object: [String: Any]) {
    guard let data = try? JSONSerialization.data(withJSONObject: object) else { return }
    writeLock.lock()
    out.write(data + Data([0x0A]))
    writeLock.unlock()
}
func status(_ state: String, _ message: String = "") { emit(["type": "status", "state": state, "message": message]) }

/// Passes on download progress only when it moved by at least 5 points, so the pipe is not flooded.
final class ProgressGate: @unchecked Sendable {
    private let lock = NSLock()
    private var last = -1.0
    func shouldReport(_ fraction: Double) -> Bool {
        lock.lock()
        defer { lock.unlock() }
        guard last < 1, fraction >= 1 || fraction - last >= 0.05 else { return false }
        last = fraction
        return true
    }
}

final class Pipeline: @unchecked Sendable {
    let stream: String
    let segmenter = UtteranceSegmenter()
    let transcriber: Transcriber
    private let lock = NSLock()
    private var busy = false
    private var epoch = Date()

    init(stream: String, transcriber: Transcriber) {
        self.stream = stream
        self.transcriber = transcriber
    }

    func feed(_ samples: [Int16]) {
        lock.lock()
        let events = segmenter.push(samples)
        lock.unlock()
        for event in events { handle(event) }
    }

    private func clearBusy() {
        lock.lock()
        busy = false
        lock.unlock()
    }

    func finish() {
        lock.lock()
        let events = segmenter.flush()
        lock.unlock()
        for event in events { handle(event) }
    }

    private func handle(_ event: UtteranceSegmenter.Event) {
        let (utterance, partial): (UtteranceSegmenter.Utterance, Bool)
        switch event {
        case .partial(let u): (utterance, partial) = (u, true)
        case .final(let u): (utterance, partial) = (u, false)
        }
        if partial {
            lock.lock()
            if busy { lock.unlock(); return }  // drop partials while a recognition is running
            busy = true
            lock.unlock()
        }
        Task {
            defer { if partial { clearBusy() } }
            do {
                let text = try await transcriber.transcribe(utterance.samples)
                guard !text.isEmpty else { return }
                emit([
                    "type": "segment", "segmentId": utterance.id.uuidString.lowercased(), "stream": stream,
                    "startMs": utterance.startMs, "endMs": utterance.endMs, "text": text,
                    "words": [Any](), "partial": partial,
                ])
            } catch {
                status("error", "transcribe failed: \(error)")
            }
        }
    }
}

status("loading", "loading speech model")
// `--permissions`: print the microphone permission state and exit (no model load).
if CommandLine.arguments.contains("--permissions") {
    let state: String
    switch AVCaptureDevice.authorizationStatus(for: .audio) {
    case .authorized: state = "granted"
    case .denied, .restricted: state = "denied"
    default: state = "undetermined"
    }
    emit(["type": "permissions", "microphone": state])
    exit(0)
}

// `--check-system-audio`: macOS has no API to read the system-audio permission, so play a short system
// sound and see whether the tap hears it. Silence means no permission or a muted speaker.
if CommandLine.arguments.contains("--check-system-audio") {
    let lock = NSLock()
    nonisolated(unsafe) var peak = 0
    let probe = SystemAudioTap()
    do {
        try probe.start { samples in
            let loudest = samples.map { abs(Int($0)) }.max() ?? 0
            lock.lock()
            peak = max(peak, loudest)
            lock.unlock()
        }
    } catch {
        emit(["type": "system-audio", "state": "error", "message": "\(error)"])
        exit(0)
    }
    let player = Process()
    player.executableURL = URL(fileURLWithPath: "/usr/bin/afplay")
    player.arguments = ["/System/Library/Sounds/Ping.aiff"]
    try? player.run()
    try? await Task.sleep(nanoseconds: 1_600_000_000)
    probe.stop()
    lock.lock()
    let heard = peak
    lock.unlock()
    emit(["type": "system-audio", "state": heard > 200 ? "granted" : "silent", "peak": heard])
    exit(0)
}

let transcriber = Transcriber()

/// Loads the model for a language, reporting download progress. Returns false when it could not.
func loadModel(_ language: String) async -> Bool {
    guard SpeechModels.isSupported(language) else {
        emit(["type": "model", "language": language, "state": "error", "message": "unsupported language"])
        return false
    }
    let reported = ProgressGate()
    do {
        try await transcriber.load(language: language) { fraction in
            if reported.shouldReport(fraction) {
                emit(["type": "model", "language": language, "state": "downloading", "progress": fraction])
            }
        }
        emit(["type": "model", "language": language, "state": "ready"])
        return true
    } catch {
        emit(["type": "model", "language": language, "state": "error", "message": "\(error)"])
        return false
    }
}

/// Recognition time per language, reported once at the end so slow models show up in a real run.
func reportLatency() async {
    for entry in await transcriber.latencySummary() {
        emit([
            "type": "stats", "language": entry.language, "count": entry.count,
            "p50Ms": entry.p50.rounded(), "p95Ms": entry.p95.rounded(),
        ])
    }
}

let startLanguage = ProcessInfo.processInfo.environment["CUELINGO_LANGUAGE"] ?? "en"
if !(await loadModel(startLanguage)) {
    status("error", "model load failed for \(startLanguage)")
    exit(2)
}
func applyVocabulary(_ json: String) async {
    guard let data = json.data(using: .utf8),
          let terms = try? JSONDecoder().decode([String].self, from: data) else { return }
    await transcriber.setVocabulary(terms)
}
if let initial = ProcessInfo.processInfo.environment["CUELINGO_VOCAB"] { await applyVocabulary(initial) }

let system = Pipeline(stream: "system", transcriber: transcriber)

// `--file x.wav` (16 kHz mono Int16): run a recording through the same pipeline, for tests and demos.
if let flag = CommandLine.arguments.firstIndex(of: "--file"), flag + 1 < CommandLine.arguments.count {
    let data = try Data(contentsOf: URL(fileURLWithPath: CommandLine.arguments[flag + 1]))
    let pcm = data.dropFirst(44)
    let samples: [Int16] = pcm.withUnsafeBytes { Array($0.bindMemory(to: Int16.self)) }
    status("ready")
    var offset = 0
    while offset < samples.count {
        system.feed(Array(samples[offset..<min(offset + 3200, samples.count)]))
        offset += 3200
    }
    system.feed([Int16](repeating: 0, count: 16_000))  // trailing silence closes the last sentence
    system.finish()
    try? await Task.sleep(nanoseconds: 4_000_000_000)
    await reportLatency()
    status("stopped")
    exit(0)
}
let mic = Pipeline(stream: "mic", transcriber: transcriber)
let tap = SystemAudioTap()
let micCapture = MicCapture()
do { try tap.start { system.feed($0) } } catch { status("error", "system audio: \(error)") }
status("ready")
// The mic can block on its permission prompt; start it off the main path so system captions never wait for it.
DispatchQueue.global().async {
    do { try micCapture.start { mic.feed($0) } } catch { status("error", "microphone: \(error)") }
}

// Wait for "stop" on stdin (or EOF when the parent exits).
while let line = readLine() {
    let command = line.trimmingCharacters(in: .whitespaces)
    if command == "stop" { break }
    if command.hasPrefix("vocab ") { await applyVocabulary(String(command.dropFirst(6))) }
    if command.hasPrefix("language ") {
        let target = String(command.dropFirst(9)).trimmingCharacters(in: .whitespaces)
        // Off the input loop so "stop" is never stuck behind a model download.
        Task { _ = await loadModel(target) }
    }
}
tap.stop()
micCapture.stop()
system.finish()
mic.finish()
try? await Task.sleep(nanoseconds: 1_500_000_000)  // let final recognitions flush
await reportLatency()
status("stopped")
