import XCTest
@testable import LocalSTT

final class UtterancePCMTests: XCTestCase {
    func testRoundTripKeepsInt16Samples() {
        let ints: [Int16] = [0, 1, -1, 1234, -32768, 32767]
        let floats = ints.map { Float($0) / 32768 }
        let back = UtterancePCM.samples(fromBase64: UtterancePCM.base64(floats))
        XCTAssertEqual(back, floats)
    }

    func testClampsOutOfRangeAndIsLittleEndian() {
        let text = UtterancePCM.base64([2.0, -2.0, 0.5])
        let bytes = [UInt8](Data(base64Encoded: text)!)
        XCTAssertEqual(bytes, [0xFF, 0x7F, 0x00, 0x80, 0x00, 0x40])
    }

    func testCapSplitsLongSpeechAndStaysUnderApiLimit() {
        let s = UtteranceSegmenter()
        s.setLimits(maxUtteranceMs: UtterancePCM.maxUtteranceMs, minSpeechMs: UtterancePCM.minSpeechMs)
        let tone = (0..<(60 * 16_000)).map { Int16(8000 * sin(Double($0) * 0.2)) }
        var finals: [UtteranceSegmenter.Utterance] = []
        for start in stride(from: 0, to: tone.count, by: 3200) {
            for case .final(let u) in s.push(Array(tone[start..<min(start + 3200, tone.count)])) { finals.append(u) }
        }
        XCTAssertGreaterThanOrEqual(finals.count, 2)
        for u in finals {
            XCTAssertLessThanOrEqual(u.samples.count, 25 * 16_000 + 320)
            XCTAssertLessThan(UtterancePCM.base64(u.samples).count, 1_400_000)
        }
    }

    func testSpeechUnderThreeTenthsOfASecondIsDropped() {
        let s = UtteranceSegmenter()
        s.setLimits(maxUtteranceMs: UtterancePCM.maxUtteranceMs, minSpeechMs: UtterancePCM.minSpeechMs)
        let blip = (0..<(280 * 16)).map { Int16(8000 * sin(Double($0) * 0.2)) }
        XCTAssertTrue((s.push(blip) + s.push([Int16](repeating: 0, count: 16_000))).isEmpty)
    }

    func testCloudLanguages() {
        XCTAssertTrue(SpeechModels.isCloud("vi"))
        XCTAssertFalse(SpeechModels.isCloud("en"))
    }
}
