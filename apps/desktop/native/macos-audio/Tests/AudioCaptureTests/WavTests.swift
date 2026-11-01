import XCTest
@testable import AudioCapture

final class WavTests: XCTestCase {
    func testHeaderAndLength() {
        let data = Wav.data(samples: [0, 1000, -1000])
        XCTAssertEqual(String(decoding: data.prefix(4), as: UTF8.self), "RIFF")
        XCTAssertEqual(data.count, 44 + 6)
    }

    func testRmsOfSilenceIsZero() {
        XCTAssertEqual(Wav.rms([0, 0, 0]), 0)
        XCTAssertGreaterThan(Wav.rms([16384, -16384]), 0.4)
    }
}
