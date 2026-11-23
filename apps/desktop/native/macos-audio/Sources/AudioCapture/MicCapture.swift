import AVFoundation

/// Captures the user's own voice from the default input device. Needs the Microphone permission.
public final class MicCapture {
    /// The Microphone permission as the sidecar reports it; `undetermined` means macOS has not asked yet.
    public enum Authorization: String, Sendable {
        case authorized, denied, undetermined
    }

    private let engine = AVAudioEngine()
    private var running = false

    public init() {}

    public static func authorization() -> Authorization {
        switch AVCaptureDevice.authorizationStatus(for: .audio) {
        case .authorized: return .authorized
        case .denied, .restricted: return .denied
        default: return .undetermined
        }
    }

    /// Shows macOS's own permission dialog when the state is still `undetermined` and waits for the answer.
    /// With any other state it just returns it, so it is safe to call more than once.
    public static func requestAccess() async -> Authorization {
        if authorization() == .undetermined { _ = await AVCaptureDevice.requestAccess(for: .audio) }
        return authorization()
    }

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
