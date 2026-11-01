import AudioCapture
import Foundation

// Spike M1-01: record N seconds of system audio and mic to WAV and report levels.
// usage: cuelingo-audio-spike [seconds] [outDir]
final class Sink: @unchecked Sendable {
    private let lock = NSLock()
    private var samples: [Int16] = []
    private var firstAt: Date?
    func append(_ new: [Int16]) {
        lock.lock(); defer { lock.unlock() }
        if firstAt == nil { firstAt = Date() }
        samples.append(contentsOf: new)
    }
    func take() -> (samples: [Int16], firstAt: Date?) {
        lock.lock(); defer { lock.unlock() }
        return (samples, firstAt)
    }
}

let seconds = Double(CommandLine.arguments.dropFirst().first ?? "5") ?? 5
let outDir = URL(fileURLWithPath: CommandLine.arguments.dropFirst(2).first ?? NSTemporaryDirectory())
let system = Sink(), mic = Sink()
let tap = SystemAudioTap(), micCapture = MicCapture()
let startedAt = Date()

do {
    try tap.start { system.append($0) }
    print("system tap: started")
} catch { print("system tap: FAILED \(error)") }
do {
    try micCapture.start { mic.append($0) }
    print("mic: started")
} catch { print("mic: FAILED \(error)") }

Thread.sleep(forTimeInterval: seconds)
tap.stop(); micCapture.stop()

for (name, sink) in [("system", system), ("mic", mic)] {
    let (samples, firstAt) = sink.take()
    let file = outDir.appendingPathComponent("spike-\(name).wav")
    try? Wav.data(samples: samples).write(to: file)
    let latency = firstAt.map { String(format: "%.0f ms", $0.timeIntervalSince(startedAt) * 1000) } ?? "n/a"
    print(String(format: "%@: %d samples (%.1f s), rms %.4f, first frame after %@ -> %@",
                 name, samples.count, Double(samples.count) / 16_000, Wav.rms(samples), latency, file.path))
}
