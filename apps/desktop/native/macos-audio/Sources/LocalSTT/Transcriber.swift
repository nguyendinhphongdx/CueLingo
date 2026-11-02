import FluidAudio
import Foundation

public enum TranscriberError: Error {
    case unsupportedLanguage(String)
    case notLoaded
}

/// On-device speech-to-text on the Neural Engine (Parakeet through FluidAudio). The model follows the
/// meeting's language, and can be switched while running: the old model keeps recognising until the new
/// one is ready, so captions never stop during a switch.
public actor Transcriber {
    private var manager: AsrManager?
    private var corrector = VocabularyCorrector(terms: [])
    private var stats: [String: LatencyStats] = [:]

    /// The language the loaded model recognises; nil before the first load.
    public private(set) var language: String?

    public init() {}

    /// The user's glossary terms for the current meeting; applied to every later utterance.
    public func setVocabulary(_ terms: [String]) {
        corrector = VocabularyCorrector(terms: terms)
    }

    /// Loads (downloading on first use) the model for `language`. `progress` gets 0...1 while downloading.
    /// Switching to the language that is already loaded does nothing.
    public func load(
        language target: String,
        progress: (@Sendable (Double) -> Void)? = nil
    ) async throws {
        guard let version = SpeechModels.version(for: target) else {
            throw TranscriberError.unsupportedLanguage(target)
        }
        if language == target, manager != nil { return }
        let handler: ProgressHandler? = progress.map { report in
            { @Sendable update in report(update.fractionCompleted) }
        }
        let models = try await AsrModels.downloadAndLoad(version: version, progressHandler: handler)
        let next = AsrManager(config: .default)
        try await next.loadModels(models)
        // Swap only now; utterances recognised while loading used the previous model.
        manager = next
        language = target
    }

    /// The model needs at least ~1 s of audio; shorter utterances are padded with silence.
    static let minSamples = 16_000

    public struct Recognition: Sendable {
        public let text: String
        /// How sure the model is of what it heard, 0...1.
        public let confidence: Double
    }

    public func transcribe(_ input: [Float]) async throws -> String {
        try await recognize(input).text
    }

    public func recognize(_ input: [Float]) async throws -> Recognition {
        guard let manager, let language else { throw TranscriberError.notLoaded }
        let samples = input.count < Self.minSamples
            ? input + [Float](repeating: 0, count: Self.minSamples - input.count) : input
        let started = Date()
        // Each utterance is independent, so it gets a fresh decoder state.
        var state = TdtDecoderState.make(decoderLayers: await manager.decoderLayerCount)
        let result = try await manager.transcribe(samples, decoderState: &state)
        stats[language, default: LatencyStats()].record(Date().timeIntervalSince(started) * 1000)
        let text = corrector.correct(result.text.trimmingCharacters(in: .whitespacesAndNewlines))
        return Recognition(text: text, confidence: Double(result.confidence))
    }

    /// Whether the model for `language` is already on this machine (no download needed).
    public static func isCached(language: String) -> Bool {
        guard let version = SpeechModels.version(for: language) else { return false }
        return AsrModels.modelsExist(
            at: AsrModels.defaultCacheDirectory(for: version), version: version)
    }

    /// Per language: how many recognitions ran and their p50/p95 in milliseconds.
    public func latencySummary() -> [(language: String, count: Int, p50: Double, p95: Double)] {
        stats.compactMap { language, value in
            guard let p50 = value.percentile(50), let p95 = value.percentile(95) else { return nil }
            return (language, value.count, p50, p95)
        }.sorted { $0.language < $1.language }
    }
}
