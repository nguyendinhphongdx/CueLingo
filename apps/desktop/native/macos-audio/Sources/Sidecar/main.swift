import AudioCapture
import AVFoundation
import Foundation
import LocalSTT

// cuelingo-audio: captures system audio + mic, transcribes on-device, prints one JSON object per line.
// stdout events: {"type":"status","state":"loading|ready|error","message":…}
//                {"type":"segment","segmentId","stream","startMs","endMs","text","words":[],"partial"}
//                {"type":"model","language","state":"downloading|ready|error","progress":0...1,"message"}
//                {"type":"language-suggestion","language","confidence"}  (the meeting sounds like another language)
//                {"type":"stats","language","count","p50Ms","p95Ms"}  (recognition time, once at the end)
//                {"type":"utterance","segmentId","stream","startMs","endMs","sampleRate":16000,"pcm"}  (cloud languages:
//                 one finished utterance as base64 16-bit LE mono PCM; no model runs on this machine)
//                {"type":"level","stream":"system|mic","rms":0...1,"peak":0...1}  (at most 10 per second per stream)
// stdin: a line "stop" ends the session; "vocab ["SLA",...]" replaces the glossary terms;
//        "language ja" switches the recognition model (captions continue on the old one until it is ready).
// env CUELINGO_DETECT: comma-separated candidate languages to listen for in the first seconds (their models must
// already be on this machine; nothing is downloaded for this).
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

/// Listens to the first utterances of the meeting and, when another language fits clearly better, says so once.
actor LanguageProbe {
    private let candidates: [String]
    private let current: @Sendable () async -> String
    private var utterances: [[Float]] = []
    private var attempts = 0
    private var finished = false
    private var probing = false
    private let maxAttempts = 2
    /// Enough speech to judge by: about three seconds.
    private let samplesPerAttempt = 16_000 * 3

    init(candidates: [String], current: @escaping @Sendable () async -> String) {
        self.candidates = candidates
        self.current = current
    }

    func hear(_ samples: [Float]) async {
        guard !finished, !probing else { return }
        utterances.append(samples)
        guard utterances.reduce(0, { $0 + $1.count }) >= samplesPerAttempt else { return }
        probing = true
        let batch = Array(utterances.joined().prefix(16_000 * 8))
        utterances = []
        attempts += 1
        if let verdict = await detect(batch) {
            emit(["type": "language-suggestion", "language": verdict.language, "confidence": verdict.confidence])
            finished = true
        } else if attempts >= maxAttempts {
            finished = true
        }
        probing = false
    }

    private func detect(_ samples: [Float]) async -> LanguageDetector.Verdict? {
        let active = await current()
        var readings: [LanguageDetector.Reading] = []
        for language in [active] + candidates where Transcriber.isCached(language: language) {
            // Each candidate model is loaded just for this and released right after.
            let transcriber = Transcriber()
            do { try await transcriber.load(language: language) } catch {
                FileHandle.standardError.write(Data("probe load \(language) failed: \(error)\n".utf8)); continue
            }
            let heard: Transcriber.Recognition
            do { heard = try await transcriber.recognize(samples) } catch {
                FileHandle.standardError.write(Data("probe recognize \(language) failed: \(error)\n".utf8)); continue
            }
            readings.append(.init(language: language, text: heard.text, confidence: heard.confidence))
        }
        return LanguageDetector.verdict(current: active, readings: readings)
    }
}

/// Whether the meeting language is recognised in the cloud: then pipelines emit utterances instead of text.
final class RecognitionMode: @unchecked Sendable {
    private let lock = NSLock()
    private var value = false
    var cloud: Bool {
        get { lock.lock(); defer { lock.unlock() }; return value }
        set { lock.lock(); value = newValue; lock.unlock() }
    }
}
let mode = RecognitionMode()

final class Pipeline: @unchecked Sendable {
    let stream: String
    let segmenter = UtteranceSegmenter()
    let transcriber: Transcriber
    private let lock = NSLock()
    private var busy = false
    private var epoch = Date()

    private let probe: LanguageProbe?
    private var meter = LevelMeter()
    private let clock = DispatchTime.now()

    init(stream: String, transcriber: Transcriber, probe: LanguageProbe? = nil) {
        self.stream = stream
        self.transcriber = transcriber
        self.probe = probe
    }

    func feed(_ samples: [Int16]) {
        let cloud = mode.cloud
        lock.lock()
        let nowMs = Int((DispatchTime.now().uptimeNanoseconds - clock.uptimeNanoseconds) / 1_000_000)
        let level = meter.add(samples, nowMs: nowMs)
        if cloud {
            segmenter.setLimits(maxUtteranceMs: UtterancePCM.maxUtteranceMs, minSpeechMs: UtterancePCM.minSpeechMs,
                                minSilenceMs: UtterancePCM.minSilenceMs)
        } else {
            segmenter.setLimits(maxUtteranceMs: 15_000, minSpeechMs: 250)
        }
        let events = segmenter.push(samples)
        lock.unlock()
        if let level {
            emit(["type": "level", "stream": stream, "rms": Double(level.rms), "peak": Double(level.peak)])
        }
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
        if mode.cloud {
            // Cloud language: only finished utterances leave, as audio; partials are not sent.
            guard !partial else { return }
            emit([
                "type": "utterance", "segmentId": utterance.id.uuidString.lowercased(), "stream": stream,
                "startMs": utterance.startMs, "endMs": utterance.endMs, "sampleRate": 16_000,
                "pcm": UtterancePCM.base64(utterance.samples),
            ])
            return
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
                if !partial, let probe { await probe.hear(utterance.samples) }
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

// `--calendar-status` / `--calendar-request` / `--calendar-events`: calendar access and the next meetings, for
// suggesting a language before a meeting. Read on this machine only; attendees are reduced to their domains.
func calendarArgument() -> String? {
    CommandLine.arguments.first { $0.hasPrefix("--calendar-") }
}
if let mode = calendarArgument() {
    let access = mode == "--calendar-request" ? await CalendarEvents.request() : CalendarEvents.access()
    var message: [String: Any] = ["type": "calendar", "state": access.rawValue]
    if mode == "--calendar-events", access == .granted {
        message["events"] = CalendarEvents.upcoming().map { item -> [String: Any] in
            [
                "title": item.title, "startMs": item.startMs, "endMs": item.endMs,
                "location": item.location, "attendeeDomains": item.attendeeDomains,
            ]
        }
    }
    emit(message)
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
    guard SpeechModels.isSupported(language) || SpeechModels.isCloud(language) else {
        emit(["type": "model", "language": language, "state": "error", "message": "unsupported language"])
        return false
    }
    if SpeechModels.isCloud(language) {
        mode.cloud = true  // nothing to download or load; utterances go out as audio at once
        emit(["type": "model", "language": language, "state": "ready"])
        return true
    }
    let reported = ProgressGate()
    do {
        try await transcriber.load(language: language) { fraction in
            if reported.shouldReport(fraction) {
                emit(["type": "model", "language": language, "state": "downloading", "progress": fraction])
            }
        }
        mode.cloud = false
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

let detectCandidates = (ProcessInfo.processInfo.environment["CUELINGO_DETECT"] ?? "")
    .split(separator: ",").map(String.init).filter { $0 != startLanguage && SpeechModels.isSupported($0) && !SpeechModels.isCloud(startLanguage) }
let probe: LanguageProbe? = detectCandidates.isEmpty
    ? nil : LanguageProbe(candidates: detectCandidates, current: { await transcriber.language ?? "en" })
let system = Pipeline(stream: "system", transcriber: transcriber, probe: probe)

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
    try? await Task.sleep(nanoseconds: probe == nil ? 4_000_000_000 : 60_000_000_000)
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
