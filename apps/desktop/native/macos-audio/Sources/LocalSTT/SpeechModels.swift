import FluidAudio

/// Which on-device recognition model serves each language. One entry per language; nothing else in the
/// sidecar branches on a language code (docs: ADR 0013).
public enum SpeechModels {
    /// Language codes the sidecar can recognise, in the same codes as `SUPPORTED_LANGUAGES` in @cuelingo/shared.
    public static let languages = ["en", "ja"]

    /// Languages recognised in the cloud, with no model on this machine. Mirrors `recognition: 'cloud'` in
    /// packages/shared/src/languages.ts; the sidecar only cuts their audio into utterances. `ja` also stays in
    /// `languages` (its on-device model is kept for a later evaluation, ADR 0016), but a cloud language always
    /// wins: every place that picks a mode checks `isCloud` first.
    public static let cloudLanguages = ["vi", "ja", "ko", "zh"]

    public static func isCloud(_ language: String) -> Bool {
        cloudLanguages.contains(language)
    }

    public static func isSupported(_ language: String) -> Bool {
        languages.contains(language)
    }

    /// Languages the start-of-meeting probe listens for: only when the meeting itself is on-device, never the
    /// start language, and only languages with a model here. A suggestion for a cloud language (ja) is still fine:
    /// accepting it goes through the cloud path, which the TypeScript controller guards with consent.
    public static func probeCandidates(start: String, requested: [String]) -> [String] {
        if isCloud(start) { return [] }
        return requested.filter { $0 != start && isSupported($0) }
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
