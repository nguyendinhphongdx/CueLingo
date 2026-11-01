import Foundation

/// Repairs recognition errors on the user's own terms (acronyms, product names) after the model ran.
/// Cheap and local: a word is replaced only when it is very close to exactly one glossary term.
public struct VocabularyCorrector: Sendable {
    private let terms: [String]

    public init(terms: [String]) {
        var seen = Set<String>()
        self.terms = terms
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { $0.count >= 3 && !$0.contains(" ") && seen.insert($0.lowercased()).inserted }
    }

    public func correct(_ text: String) -> String {
        if terms.isEmpty { return text }
        return text.split(separator: " ", omittingEmptySubsequences: false)
            .map { replace(String($0)) }
            .joined(separator: " ")
    }

    private func replace(_ token: String) -> String {
        let letters = token.filter { $0.isLetter || $0.isNumber || $0 == "'" }
        guard letters.count >= 3 else { return token }
        let word = letters.lowercased()
        let matches = terms.filter { isClose(word, to: $0) }
        guard matches.count == 1, let term = matches.first else { return token }
        // Keep surrounding punctuation ("slaw?" -> "SLA?").
        let prefix = token.prefix { !($0.isLetter || $0.isNumber) }
        let suffix = String(token.reversed().prefix { !($0.isLetter || $0.isNumber) }.reversed())
        return prefix + term + suffix
    }

    private func isClose(_ word: String, to term: String) -> Bool {
        let target = term.lowercased()
        if word == target { return true } // fixes only the casing
        let isAcronym = term == term.uppercased() && term.count <= 6
        if isAcronym {
            // "slaw", "slas", "sla's": the acronym plus one stray trailing letter.
            return word.hasPrefix(target) && word.count <= target.count + 1
                || word == target + "'s"
        }
        guard target.count >= 5 else { return false }
        return Self.distance(word, target) <= 1
    }

    static func distance(_ a: String, _ b: String) -> Int {
        let x = Array(a), y = Array(b)
        var previous = Array(0...y.count)
        for i in 1...max(x.count, 1) where !x.isEmpty {
            var row = [i]
            for j in 1...max(y.count, 1) where !y.isEmpty {
                row.append(min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (x[i - 1] == y[j - 1] ? 0 : 1)))
            }
            previous = row
        }
        return previous[y.count]
    }
}
