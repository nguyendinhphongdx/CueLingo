import FluidAudio

/// Which on-device recognition model serves each language. One entry per language; nothing else in the
/// sidecar branches on a language code (docs: ADR 0013).
public enum SpeechModels {
    /// Language codes the sidecar can recognise, in the same codes as `SUPPORTED_LANGUAGES` in @cuelingo/shared.
    public static let languages = ["en", "ja"]

    /// Languages recognised in the cloud, with no model on this machine. Mirrors `recognition: 'cloud'` in
    /// packages/shared/src/languages.ts; the sidecar only cuts their audio into utterances.
    public static let cloudLanguages = ["vi"]

    public static func isCloud(_ language: String) -> Bool {
        cloudLanguages.contains(language)
    }

    public static func isSupported(_ language: String) -> Bool {
        languages.contains(language)
    }

    /// The FluidAudio model for a language, or nil when the sidecar has none.
    static func version(for language: String) -> AsrModelVersion? {
        switch language {
        case "en": return .v2  // Parakeet TDT v2, English
        case "ja": return .tdtJa  // Parakeet TDT Japanese
        default: return nil
        }
    }
}
