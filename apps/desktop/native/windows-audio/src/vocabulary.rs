//! Repairs recognition errors on the user's own terms (acronyms, product names) after the model ran.
//! Port of `VocabularyCorrector.swift`. Cheap and local: a word is replaced only when it is very close to
//! exactly one glossary term. Shares vectors with the Swift copy in `native/fixtures/vocabulary.json`.
use std::collections::HashSet;

#[derive(Debug, Clone, Default)]
pub struct VocabularyCorrector {
    terms: Vec<String>,
}

impl VocabularyCorrector {
    pub fn new<S: AsRef<str>>(terms: &[S]) -> Self {
        let mut seen = HashSet::new();
        let terms = terms
            .iter()
            .map(|t| t.as_ref().trim().to_string())
            .filter(|t| t.chars().count() >= 3 && !t.contains(' ') && seen.insert(t.to_lowercase()))
            .collect();
        Self { terms }
    }

    pub fn correct(&self, text: &str) -> String {
        if self.terms.is_empty() {
            return text.to_string();
        }
        text.split(' ')
            .map(|token| self.replace(token))
            .collect::<Vec<_>>()
            .join(" ")
    }

    fn replace(&self, token: &str) -> String {
        let word: String = token
            .chars()
            .filter(|c| c.is_alphabetic() || c.is_numeric() || *c == '\'')
            .collect();
        if word.chars().count() < 3 {
            return token.to_string();
        }
        let word = word.to_lowercase();
        let mut matches = self.terms.iter().filter(|t| is_close(&word, t));
        let (Some(term), None) = (matches.next(), matches.next()) else {
            return token.to_string();
        };
        // Keep surrounding punctuation ("slaw?" -> "SLA?").
        let is_word = |c: char| c.is_alphabetic() || c.is_numeric();
        let prefix: String = token.chars().take_while(|c| !is_word(*c)).collect();
        let mut suffix: Vec<char> = token.chars().rev().take_while(|c| !is_word(*c)).collect();
        suffix.reverse();
        format!("{prefix}{term}{}", suffix.into_iter().collect::<String>())
    }
}

fn is_close(word: &str, term: &str) -> bool {
    let target = term.to_lowercase();
    if word == target {
        return true; // fixes only the casing
    }
    let is_acronym = term == term.to_uppercase() && term.chars().count() <= 6;
    if is_acronym {
        // "slaw", "slas", "sla's": the acronym plus one stray trailing letter.
        return (word.starts_with(&target) && word.chars().count() <= target.chars().count() + 1)
            || word == format!("{target}'s");
    }
    if target.chars().count() < 5 {
        return false;
    }
    distance(word, &target) <= 1
}

/// Levenshtein distance over characters.
pub fn distance(a: &str, b: &str) -> usize {
    let x: Vec<char> = a.chars().collect();
    let y: Vec<char> = b.chars().collect();
    let mut previous: Vec<usize> = (0..=y.len()).collect();
    for i in 1..=x.len() {
        let mut row = vec![i];
        for j in 1..=y.len() {
            let cost = usize::from(x[i - 1] != y[j - 1]);
            row.push(
                (previous[j] + 1)
                    .min(row[j - 1] + 1)
                    .min(previous[j - 1] + cost),
            );
        }
        previous = row;
    }
    previous[y.len()]
}

#[cfg(test)]
mod tests {
    use super::*;

    // The cases of VocabularyCorrectorTests.swift live in native/fixtures/vocabulary.json and run from
    // tests/fixtures.rs; these cover what the Swift file does not.
    #[test]
    fn distance_counts_single_edits() {
        assert_eq!(distance("kitten", "sitting"), 3);
        assert_eq!(distance("", "abc"), 3);
        assert_eq!(distance("abc", ""), 3);
        assert_eq!(distance("same", "same"), 0);
    }

    #[test]
    fn non_ascii_text_does_not_break_it() {
        let corrector = VocabularyCorrector::new(&["SLA"]);
        assert_eq!(corrector.correct("xin chào, slaw"), "xin chào, SLA");
    }
}
