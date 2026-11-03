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

    private func finals(_ events: [UtteranceSegmenter.Event]) -> Int {
        events.filter { if case .final = $0 { return true } else { return false } }.count
    }

    /// Speech, a pause, speech, then a long silence; returns how many sentences came out.
    private func sentences(pauseMs: Int, cloud: Bool) -> Int {
        let s = UtteranceSegmenter()  // default minSilenceMs is 600
        if cloud {
            s.setLimits(
                maxUtteranceMs: UtterancePCM.maxUtteranceMs, minSpeechMs: UtterancePCM.minSpeechMs,
                minSilenceMs: UtterancePCM.minSilenceMs)
        }
        let events = s.push(tone(ms: 1000)) + s.push(silence(ms: pauseMs)) + s.push(tone(ms: 1000))
            + s.push(silence(ms: 1500))
        return finals(events)
    }

    // The default is 600 ms, so a 400 ms breath splits in neither mode; 650 ms is the pause that tells them apart.
    func testShortBreathDoesNotSplitInEitherMode() {
        XCTAssertEqual(sentences(pauseMs: 400, cloud: false), 1)
        XCTAssertEqual(sentences(pauseMs: 400, cloud: true), 1)
    }

    func testPauseBetweenDefaultAndCloudSilenceSplitsOnlyWithDefault() {
        XCTAssertEqual(sentences(pauseMs: 650, cloud: false), 2)
        XCTAssertEqual(sentences(pauseMs: 650, cloud: true), 1)
    }

    func testLongPauseSplitsInBothModes() {
        XCTAssertEqual(sentences(pauseMs: 900, cloud: false), 2)
        XCTAssertEqual(sentences(pauseMs: 900, cloud: true), 2)
    }

    func testSetLimitsWithoutSilenceRestoresTheDefault() {
        let s = UtteranceSegmenter()
        s.setLimits(maxUtteranceMs: 25_000, minSpeechMs: 300, minSilenceMs: 700)
        s.setLimits(maxUtteranceMs: 15_000, minSpeechMs: 250)
        let events = s.push(tone(ms: 1000)) + s.push(silence(ms: 650)) + s.push(tone(ms: 1000))
        XCTAssertEqual(finals(events), 1)  // the first sentence ended at 600 ms
    }
}
