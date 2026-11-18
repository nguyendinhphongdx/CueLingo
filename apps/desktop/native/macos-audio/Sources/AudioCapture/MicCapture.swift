import AVFoundation

/// Captures the user's own voice from the default input device. Needs the Microphone permission.
public final class MicCapture {
    private let engine = AVAudioEngine()
    private var running = false

    public init() {}

    /// Safe to call again after `stop()` (the microphone can be switched off and on during a meeting);
    /// calling it while already running does nothing.
    public func start(onSamples: @escaping @Sendable ([Int16]) -> Void) throws {
        guard !running else { return }
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard let resampler = Resampler(from: format) else { throw CaptureError.format("unsupported mic format") }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            let samples = resampler.convert(buffer)
            if !samples.isEmpty { onSamples(samples) }
        }
        do { try engine.start() } catch {
            input.removeTap(onBus: 0)
            throw error
        }
        running = true
    }

    public func stop() {
        guard running else { return }
        running = false
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
    }
}
