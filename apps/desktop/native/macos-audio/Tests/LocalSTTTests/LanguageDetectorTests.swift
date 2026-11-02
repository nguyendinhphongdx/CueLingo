import XCTest
@testable import LocalSTT

final class LanguageDetectorTests: XCTestCase {
    func testJapaneseTextScoresAsJapaneseNotEnglish() {
        let text = "来週の月曜日までに見積もりを送ります。"
        XCTAssertGreaterThan(LanguageDetector.score(text, as: "ja"), 0.8)
        XCTAssertLessThan(LanguageDetector.score(text, as: "en"), 0.2)
    }

    // Numbers below are what the real models gave on English and Japanese speech.
    func testSuggestsJapaneseWhenOnlyTheJapaneseModelIsSure() {
        let verdict = LanguageDetector.verdict(
            current: "en",
            readings: [
                .init(language: "en", text: "Rai shu no gets", confidence: 0.77),
                .init(language: "ja", text: "来週の月曜日までに見積もりを送ります。", confidence: 0.997),
            ])
        XCTAssertEqual(verdict?.language, "ja")
    }

    func testStaysWhenTheCurrentModelIsSureOfItself() {
        let verdict = LanguageDetector.verdict(
            current: "en",
            readings: [
                .init(language: "en", text: "Let us circle back on the quarterly roadmap.", confidence: 0.999),
                .init(language: "ja", text: "またそこバカなクオリティーロールマップ。", confidence: 0.80),
            ])
        XCTAssertNil(verdict)
    }

    func testBothSureMeansNoSuggestion() {
        let verdict = LanguageDetector.verdict(
            current: "en",
            readings: [
                .init(language: "en", text: "Okay, sounds good to me.", confidence: 0.97),
                .init(language: "ja", text: "オーケー、サウンズグッド。", confidence: 0.96),
            ])
        XCTAssertNil(verdict)
    }

    func testNoiseThatDoesNotReadAsTheLanguageNeverWins() {
        XCTAssertNil(LanguageDetector.verdict(
            current: "en",
            readings: [
                .init(language: "en", text: "uh", confidence: 0.5),
                .init(language: "ja", text: "は", confidence: 0.99),
            ]))
    }
}
