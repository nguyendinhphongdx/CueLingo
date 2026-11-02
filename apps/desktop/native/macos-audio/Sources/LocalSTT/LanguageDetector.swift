import Foundation
import NaturalLanguage

/// Decides which language a meeting is really in. The first utterances are recognised once per candidate
/// language. A model hearing its own language is nearly certain of itself (measured: 0.99+), while the
/// wrong one is not (0.77 to 0.80 on English and Japanese), so the models' own confidence decides, and the
/// text must also read as the candidate's language so noise cannot win.
public enum LanguageDetector {
    public struct Reading: Sendable {
        public let language: String
        public let text: String
        /// The model's confidence in what it heard, 0...1.
        public let confidence: Double
        public init(language: String, text: String, confidence: Double) {
            self.language = language
            self.text = text
            self.confidence = confidence
        }
    }

    public struct Verdict: Sendable, Equatable {
        public let language: String
        public let confidence: Double
    }

    /// Chance (0...1) that `text` is written in `language`, from Apple's on-device language recognizer.
    public static func score(_ text: String, as language: String) -> Double {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count >= 4 else { return 0 }
        let recognizer = NLLanguageRecognizer()
        recognizer.processString(trimmed)
        return recognizer.languageHypotheses(withMaximum: 5)[NLLanguage(rawValue: language)] ?? 0
    }

    /// The language to suggest instead of `current`, or nil to stay.
    public static func verdict(
        current: String,
        readings: [Reading],
        minimumConfidence: Double = 0.95,
        minimumMargin: Double = 0.15,
        minimumTextScore: Double = 0.7
    ) -> Verdict? {
        let currentConfidence = readings.first { $0.language == current }?.confidence ?? 0
        let candidates = readings.filter {
            $0.language != current
                && $0.confidence >= minimumConfidence
                && $0.confidence - currentConfidence >= minimumMargin
                && score($0.text, as: $0.language) >= minimumTextScore
        }
        guard let best = candidates.max(by: { $0.confidence < $1.confidence }) else { return nil }
        return Verdict(language: best.language, confidence: best.confidence)
    }
}
