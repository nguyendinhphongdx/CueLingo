import XCTest
@testable import LocalSTT

final class UtteranceBacklogTests: XCTestCase {
    private func utterance(_ startMs: Int, samples: Int) -> UtteranceSegmenter.Utterance {
        .init(id: UUID(), startMs: startMs, endMs: startMs + samples / 16,
              samples: [Float](repeating: 0.1, count: samples))
    }

    func testKeepsOrderAndDrainEmpties() {
        var backlog = UtteranceBacklog()
        backlog.push(utterance(0, samples: 16_000))
        backlog.push(utterance(2000, samples: 16_000))
        XCTAssertEqual(backlog.drain().map(\.startMs), [0, 2000])
        XCTAssertTrue(backlog.isEmpty)
        XCTAssertEqual(backlog.sampleCount, 0)
        XCTAssertTrue(backlog.drain().isEmpty)
    }

    func testDefaultCapIsSixtySeconds() {
        XCTAssertEqual(UtteranceBacklog.defaultMaxSamples, 960_000)
        XCTAssertEqual(UtteranceBacklog().maxSamples, 960_000)
    }

    func testDropsOldestWhenOverCap() {
        var backlog = UtteranceBacklog(maxSamples: 960_000)
        var dropped = 0
        // Seven 10 s utterances = 70 s: the first one must go.
        for index in 0..<7 { dropped += backlog.push(utterance(index * 10_000, samples: 160_000)) }
        XCTAssertEqual(dropped, 1)
        XCTAssertEqual(backlog.sampleCount, 960_000)
        XCTAssertEqual(backlog.drain().map(\.startMs), [10_000, 20_000, 30_000, 40_000, 50_000, 60_000])
    }

    func testExactlyAtCapKeepsEverything() {
        var backlog = UtteranceBacklog(maxSamples: 320_000)
        XCTAssertEqual(backlog.push(utterance(0, samples: 160_000)), 0)
        XCTAssertEqual(backlog.push(utterance(10_000, samples: 160_000)), 0)
        XCTAssertEqual(backlog.drain().count, 2)
    }

    func testOneOversizedUtteranceIsKeptAlone() {
        var backlog = UtteranceBacklog(maxSamples: 16_000)
        backlog.push(utterance(0, samples: 8_000))
        XCTAssertEqual(backlog.push(utterance(1000, samples: 32_000)), 1)
        XCTAssertEqual(backlog.drain().map(\.startMs), [1000])
    }
}
