import XCTest
@testable import LocalSTT

final class UtteranceSegmenterTests: XCTestCase {
    private func tone(ms: Int, amplitude: Int16 = 8000) -> [Int16] {
        (0..<(ms * 16)).map { Int16(Double(amplitude) * sin(Double($0) * 0.2)) }
    }
    private func silence(ms: Int) -> [Int16] { [Int16](repeating: 0, count: ms * 16) }

    func testSilenceProducesNothing() {
        let s = UtteranceSegmenter()
        XCTAssertTrue(s.push(silence(ms: 3000)).isEmpty)
    }

    func testSpeechThenSilenceGivesPartialsThenOneFinal() {
        let s = UtteranceSegmenter()
        var events = s.push(tone(ms: 2000))
        events += s.push(silence(ms: 1000))
        let finals = events.filter { if case .final = $0 { return true } else { return false } }
        let partials = events.filter { if case .partial = $0 { return true } else { return false } }
        XCTAssertEqual(finals.count, 1)
        XCTAssertGreaterThanOrEqual(partials.count, 2)
    }

    func testBlipShorterThanMinSpeechIsIgnored() {
        let s = UtteranceSegmenter()
        let events = s.push(tone(ms: 100)) + s.push(silence(ms: 1000))
        XCTAssertTrue(events.isEmpty)
    }

    func testLongSpeechIsForcedFinal() {
        let s = UtteranceSegmenter(maxUtteranceMs: 3000)
        let events = s.push(tone(ms: 3500))
        XCTAssertTrue(events.contains { if case .final = $0 { return true } else { return false } })
    }
}
