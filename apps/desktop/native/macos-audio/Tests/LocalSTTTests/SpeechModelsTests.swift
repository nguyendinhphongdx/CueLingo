import XCTest
@testable import LocalSTT

final class SpeechModelsTests: XCTestCase {
    func testEveryListedLanguageHasAModel() {
        for language in SpeechModels.languages {
            XCTAssertNotNil(SpeechModels.version(for: language), language)
        }
    }

    func testUnknownLanguageHasNoModel() {
        XCTAssertFalse(SpeechModels.isSupported("xx"))
        XCTAssertNil(SpeechModels.version(for: "xx"))
    }
}

final class LatencyStatsTests: XCTestCase {
    func testPercentilesUseNearestRank() {
        var stats = LatencyStats()
        for value in 1...100 { stats.record(Double(value)) }
        XCTAssertEqual(stats.percentile(50), 50)
        XCTAssertEqual(stats.percentile(95), 95)
        XCTAssertEqual(stats.percentile(100), 100)
    }

    func testEmptyHasNoPercentile() {
        XCTAssertNil(LatencyStats().percentile(95))
    }
}

final class CalendarEventsTests: XCTestCase {
    func testKeepsOnlyTheDomainOfAnAddress() {
        XCTAssertEqual(CalendarEvents.domain(ofAddress: "mailto:Ken@Acme.co.jp"), "acme.co.jp")
        XCTAssertNil(CalendarEvents.domain(ofAddress: "not an address"))
        XCTAssertNil(CalendarEvents.domain(ofAddress: "ken@"))
    }
}
