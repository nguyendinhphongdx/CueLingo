import FluidAudio
import Foundation

/// English speech-to-text on the Neural Engine (Parakeet TDT v2 through FluidAudio).
public actor Transcriber {
    private let manager = AsrManager(config: .default)

    public init() {}

    /// Downloads the model on first use (~500 MB), then loads it.
    public func load() async throws {
        let models = try await AsrModels.downloadAndLoad(version: .v2)
        try await manager.loadModels(models)
    }

    public func transcribe(_ samples: [Float]) async throws -> String {
        // Each utterance is independent, so it gets a fresh decoder state.
        var state = TdtDecoderState.make(decoderLayers: await manager.decoderLayerCount)
        let result = try await manager.transcribe(samples, decoderState: &state)
        return result.text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
