import AVFoundation

/// Captures the user's own voice from the default input device. Needs the Microphone permission.
public final class MicCapture {
    private let engine = AVAudioEngine()

    public init() {}

    public func start(onSamples: @escaping @Sendable ([Int16]) -> Void) throws {
        let input = engine.inputNode
        let format = input.outputFormat(forBus: 0)
        guard let resampler = Resampler(from: format) else { throw CaptureError.format("unsupported mic format") }
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
            let samples = resampler.convert(buffer)
            if !samples.isEmpty { onSamples(samples) }
        }
        try engine.start()
    }

    public func stop() {
        engine.inputNode.removeTap(onBus: 0)
        engine.stop()
    }
}
