import XCTest
@testable import LocalSTT

/// Runs the vectors in `native/fixtures/*.json`, the same files the Windows sidecar's `cargo test` runs
/// (`windows-audio/tests/fixtures.rs`). If one copy of the logic changes behaviour, the other suite goes red.
final class SharedFixturesTests: XCTestCase {
    private func fixture(_ name: String) throws -> [String: Any] {
        // Tests/LocalSTTTests/<this file> -> macos-audio -> native -> fixtures
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent()
        let data = try Data(contentsOf: root.appendingPathComponent("fixtures/\(name)"))
        return try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    private func cases(_ file: String, _ key: String = "cases") throws -> [[String: Any]] {
        try XCTUnwrap(try fixture(file)[key] as? [[String: Any]])
    }

    func testVocabularyVectors() throws {
        for item in try cases("vocabulary.json") {
            let terms = item["terms"] as! [String]
            let corrector = VocabularyCorrector(terms: terms)
            XCTAssertEqual(corrector.correct(item["input"] as! String), item["expected"] as! String, item["name"] as! String)
        }
    }

    private func samples(fromRuns runs: Any?) -> [Int16] {
        (runs as! [[NSNumber]]).flatMap { run in
            [Int16](repeating: Int16(truncating: run[0]), count: run[1].intValue)
        }
    }

    func testLevelVectors() throws {
        for item in try cases("level.json", "levels") {
            let level = AudioLevel.of(samples(fromRuns: item["runs"]))
            let name = item["name"] as! String
            XCTAssertEqual(Double(level.rms), (item["rms"] as! NSNumber).doubleValue, accuracy: 0.001, name)
            XCTAssertEqual(Double(level.peak), (item["peak"] as! NSNumber).doubleValue, accuracy: 0.001, name)
        }
        for item in try cases("level.json", "meters") {
            var meter = LevelMeter(intervalMs: (item["intervalMs"] as! NSNumber).intValue)
            for (index, step) in (item["steps"] as! [[String: Any]]).enumerated() {
                let report = meter.add(samples(fromRuns: step["runs"]), nowMs: (step["nowMs"] as! NSNumber).intValue)
                let name = "\(item["name"] as! String) step \(index)"
                XCTAssertEqual(report != nil, step["report"] as! Bool, name)
                if let report, let peak = step["peak"] as? NSNumber {
                    XCTAssertEqual(Double(report.peak), peak.doubleValue, accuracy: 0.001, name)
                }
            }
        }
    }

    func testPCMVectors() throws {
        for item in try cases("pcm.json") {
            let floats = (item["floats"] as! [NSNumber]).map { Float(truncating: $0) }
            XCTAssertEqual(UtterancePCM.base64(floats), item["base64"] as! String, item["name"] as! String)
        }
    }

    private func events(of item: [String: Any]) -> [[String: Any]] {
        let segmenter: UtteranceSegmenter
        if let cap = item["maxUtteranceMs"] as? NSNumber {
            segmenter = UtteranceSegmenter(maxUtteranceMs: cap.intValue)
        } else {
            segmenter = UtteranceSegmenter()
        }
        func cloud() {
            segmenter.setLimits(
                maxUtteranceMs: UtterancePCM.maxUtteranceMs, minSpeechMs: UtterancePCM.minSpeechMs,
                minSilenceMs: UtterancePCM.minSilenceMs)
        }
        if item["limits"] as? String == "cloud" { cloud() }
        var produced: [UtteranceSegmenter.Event] = []
        for step in item["input"] as! [[String: Any]] {
            if let ms = (step["tone"] as? NSNumber)?.intValue {
                let amplitude = (step["amplitude"] as! NSNumber).doubleValue
                produced += segmenter.push((0..<(ms * 16)).map { Int16(amplitude * sin(Double($0) * 0.2)) })
            } else if let ms = (step["silence"] as? NSNumber)?.intValue {
                produced += segmenter.push([Int16](repeating: 0, count: ms * 16))
            } else if step["limits"] as? String == "cloud" {
                cloud()
            } else if step["limits"] as? String == "default" {
                segmenter.setLimits(maxUtteranceMs: 15_000, minSpeechMs: 250)
            }
        }
        if item["flush"] as? Bool == true { produced += segmenter.flush() }
        return produced.map { event in
            let kind: String
            let u: UtteranceSegmenter.Utterance
            switch event {
            case .partial(let p): (kind, u) = ("partial", p)
            case .final(let f): (kind, u) = ("final", f)
            }
            return ["kind": kind, "startMs": u.startMs, "endMs": u.endMs, "samples": u.samples.count]
        }
    }

    func testSegmenterVectors() throws {
        for item in try cases("segmenter.json") {
            let expected = item["expected"] as! [[String: Any]]
            let got = events(of: item)
            let name = item["name"] as! String
            XCTAssertEqual(got.count, expected.count, name)
            for (a, b) in zip(got, expected) {
                XCTAssertEqual(a["kind"] as? String, b["kind"] as? String, name)
                XCTAssertEqual(a["startMs"] as? Int, (b["startMs"] as! NSNumber).intValue, name)
                XCTAssertEqual(a["endMs"] as? Int, (b["endMs"] as! NSNumber).intValue, name)
                XCTAssertEqual(a["samples"] as? Int, (b["samples"] as! NSNumber).intValue, name)
            }
        }
    }
}
