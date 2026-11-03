import XCTest
@testable import LocalSTT

final class AudioLevelTests: XCTestCase {
    func testSilenceAndEmptyAreZero() {
        XCTAssertEqual(AudioLevel.of([Int16](repeating: 0, count: 320)), AudioLevel(rms: 0, peak: 0))
        XCTAssertEqual(AudioLevel.of([Int16]()), AudioLevel(rms: 0, peak: 0))
        XCTAssertEqual(AudioLevel.of([Float]()), AudioLevel(rms: 0, peak: 0))
    }

    func testFullScaleSquareIsOne() {
        let square = (0..<320).map { $0 % 2 == 0 ? Int16.max : Int16.min }
        let level = AudioLevel.of(square)
        XCTAssertEqual(level.rms, 1, accuracy: 0.001)
        XCTAssertEqual(level.peak, 1, accuracy: 0.001)
    }

    func testHalfScaleSquare() {
        let level = AudioLevel.of([Int16](repeating: 16384, count: 100))
        XCTAssertEqual(level.rms, 0.5, accuracy: 0.001)
        XCTAssertEqual(level.peak, 0.5, accuracy: 0.001)
    }

    func testFloatSamplesAreClamped() {
        let level = AudioLevel.of([Float](repeating: 3, count: 10) + [-5])
        XCTAssertEqual(level.rms, 1, accuracy: 0.001)
        XCTAssertEqual(level.peak, 1)
    }

    func testMeterReportsFirstChunkThenOncePerInterval() {
        var meter = LevelMeter(intervalMs: 100)
        let loud = [Int16](repeating: 16384, count: 320)
        XCTAssertNotNil(meter.add(loud, nowMs: 0))
        XCTAssertNil(meter.add(loud, nowMs: 20))
        XCTAssertNil(meter.add(loud, nowMs: 99))
        XCTAssertNotNil(meter.add(loud, nowMs: 100))
        XCTAssertNil(meter.add(loud, nowMs: 150))
    }

    func testMeterCoversTheWholeInterval() {
        var meter = LevelMeter(intervalMs: 100)
        _ = meter.add([Int16](repeating: 0, count: 320), nowMs: 0)
        _ = meter.add([Int16.max] + [Int16](repeating: 0, count: 319), nowMs: 40)
        let level = meter.add([Int16](repeating: 0, count: 320), nowMs: 100)
        XCTAssertEqual(level?.peak ?? 0, 1, accuracy: 0.001)
    }

    func testMeterIgnoresEmptyChunks() {
        var meter = LevelMeter()
        XCTAssertNil(meter.add([], nowMs: 0))
    }
}
