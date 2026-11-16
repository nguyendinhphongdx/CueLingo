//! Runs the vectors in `native/fixtures/*.json`. The Swift tests read the same files
//! (`macos-audio/Tests/LocalSTTTests/SharedFixturesTests.swift`), so the two copies of the logic cannot drift
//! apart without one of the suites going red (plan risk R9).
use cuelingo_audio::level::{Level, LevelMeter};
use cuelingo_audio::pcm;
use cuelingo_audio::segmenter::{Event, Segmenter};
use cuelingo_audio::vocabulary::VocabularyCorrector;
use serde_json::Value;
use std::path::PathBuf;

fn fixture(name: &str) -> Value {
    let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../fixtures")
        .join(name);
    let text = std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    serde_json::from_str(&text).unwrap_or_else(|e| panic!("{}: {e}", path.display()))
}

fn near(a: f64, b: f64, tolerance: f64) -> bool {
    (a - b).abs() <= tolerance
}

#[test]
fn vocabulary_vectors() {
    for case in fixture("vocabulary.json")["cases"].as_array().unwrap() {
        let terms: Vec<&str> = case["terms"]
            .as_array()
            .unwrap()
            .iter()
            .map(|t| t.as_str().unwrap())
            .collect();
        let got = VocabularyCorrector::new(&terms).correct(case["input"].as_str().unwrap());
        assert_eq!(got, case["expected"].as_str().unwrap(), "{}", case["name"]);
    }
}

fn runs(value: &Value) -> Vec<i16> {
    value
        .as_array()
        .unwrap()
        .iter()
        .flat_map(|run| {
            let value = run[0].as_i64().unwrap() as i16;
            vec![value; run[1].as_u64().unwrap() as usize]
        })
        .collect()
}

#[test]
fn level_vectors() {
    let file = fixture("level.json");
    for case in file["levels"].as_array().unwrap() {
        let level = Level::of_i16(&runs(&case["runs"]));
        let name = &case["name"];
        assert!(
            near(f64::from(level.rms), case["rms"].as_f64().unwrap(), 0.001),
            "{name} rms"
        );
        assert!(
            near(f64::from(level.peak), case["peak"].as_f64().unwrap(), 0.001),
            "{name} peak"
        );
    }
    for case in file["meters"].as_array().unwrap() {
        let mut meter = LevelMeter::new(case["intervalMs"].as_i64().unwrap());
        for (i, step) in case["steps"].as_array().unwrap().iter().enumerate() {
            let report = meter.add(&runs(&step["runs"]), step["nowMs"].as_i64().unwrap());
            let name = &case["name"];
            assert_eq!(
                report.is_some(),
                step["report"].as_bool().unwrap(),
                "{name} step {i}"
            );
            if let (Some(report), Some(peak)) = (report, step["peak"].as_f64()) {
                assert!(
                    near(f64::from(report.peak), peak, 0.001),
                    "{name} step {i} peak"
                );
            }
        }
    }
}

#[test]
fn pcm_vectors() {
    for case in fixture("pcm.json")["cases"].as_array().unwrap() {
        let floats: Vec<f32> = case["floats"]
            .as_array()
            .unwrap()
            .iter()
            .map(|v| v.as_f64().unwrap() as f32)
            .collect();
        assert_eq!(
            pcm::base64(&floats),
            case["base64"].as_str().unwrap(),
            "{}",
            case["name"]
        );
    }
}

fn tone(ms: usize, amplitude: f64) -> Vec<i16> {
    (0..ms * 16)
        .map(|i| (amplitude * (i as f64 * 0.2).sin()) as i16)
        .collect()
}

/// Every event of a case as `{kind, startMs, endMs, samples}`.
fn segmenter_events(case: &Value) -> Vec<Value> {
    let mut segmenter = match case["maxUtteranceMs"].as_u64() {
        Some(ms) => Segmenter::with_max_utterance_ms(ms as usize),
        None => Segmenter::default(),
    };
    let cloud = |s: &mut Segmenter| {
        s.set_limits(
            pcm::MAX_UTTERANCE_MS,
            pcm::MIN_SPEECH_MS,
            Some(pcm::MIN_SILENCE_MS),
        )
    };
    if case["limits"] == "cloud" {
        cloud(&mut segmenter);
    }
    let mut events = Vec::new();
    for item in case["input"].as_array().unwrap() {
        let chunk = if let Some(ms) = item["tone"].as_u64() {
            tone(ms as usize, item["amplitude"].as_f64().unwrap())
        } else if let Some(ms) = item["silence"].as_u64() {
            vec![0i16; ms as usize * 16]
        } else {
            match item["limits"].as_str() {
                Some("cloud") => cloud(&mut segmenter),
                Some("default") => segmenter.set_limits(15_000, 250, None),
                other => panic!("unknown input item {other:?}"),
            }
            continue;
        };
        events.extend(segmenter.push(&chunk));
    }
    if case["flush"] == true {
        events.extend(segmenter.flush());
    }
    events
        .into_iter()
        .map(|event| {
            let (kind, u) = match event {
                Event::Partial(u) => ("partial", u),
                Event::Final(u) => ("final", u),
            };
            serde_json::json!({
                "kind": kind, "startMs": u.start_ms, "endMs": u.end_ms, "samples": u.samples.len(),
            })
        })
        .collect()
}

#[test]
fn segmenter_vectors() {
    for case in fixture("segmenter.json")["cases"].as_array().unwrap() {
        let expected = case["expected"]
            .as_array()
            .unwrap_or_else(|| panic!("{} has no expected", case["name"]));
        assert_eq!(&segmenter_events(case), expected, "{}", case["name"]);
    }
}
