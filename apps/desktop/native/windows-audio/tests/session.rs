//! The sidecar end to end without a model or a device: a fake recognizer and fake captures drive a whole
//! session and the test reads the protocol lines it prints.
use cuelingo_audio::capture::{Capture, CaptureError, SampleSink, Unavailable};
use cuelingo_audio::pcm;
use cuelingo_audio::protocol::Out;
use cuelingo_audio::session::{FileOptions, Session, NOT_YET};
use cuelingo_audio::stt::{ModelProvider, Recognizer, Timings, Transcriber};
use serde_json::Value;
use std::io::Write;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;

#[derive(Clone, Default)]
struct Buffer(Arc<Mutex<Vec<u8>>>);

impl Write for Buffer {
    fn write(&mut self, data: &[u8]) -> std::io::Result<usize> {
        self.0.lock().unwrap().extend_from_slice(data);
        Ok(data.len())
    }
    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}

impl Buffer {
    fn lines(&self) -> Vec<Value> {
        let text = String::from_utf8(self.0.lock().unwrap().clone()).unwrap();
        text.lines()
            .map(|l| serde_json::from_str(l).unwrap())
            .collect()
    }
}

/// Recognises every utterance as `text` after `delay`.
struct Fake {
    text: String,
    delay: Duration,
}

impl Recognizer for Fake {
    fn recognize(&mut self, _samples: &[f32]) -> Result<String, String> {
        std::thread::sleep(self.delay);
        Ok(self.text.clone())
    }
}

struct FakeProvider {
    text: String,
    delay: Duration,
    loads: AtomicUsize,
    /// Progress values reported while "downloading".
    progress: Vec<f64>,
}

impl FakeProvider {
    fn new(text: &str) -> Arc<Self> {
        Arc::new(Self {
            text: text.into(),
            delay: Duration::ZERO,
            loads: AtomicUsize::new(0),
            progress: vec![],
        })
    }
}

impl ModelProvider for FakeProvider {
    fn load(
        &self,
        language: &str,
        progress: &mut dyn FnMut(f64),
    ) -> Result<(Box<dyn Recognizer>, Timings), String> {
        if language != "en" {
            return Err(format!("no model for {language}"));
        }
        self.loads.fetch_add(1, Ordering::SeqCst);
        for p in &self.progress {
            progress(*p);
        }
        Ok((
            Box::new(Fake {
                text: self.text.clone(),
                delay: self.delay,
            }),
            Timings::default(),
        ))
    }
}

fn tone(ms: usize) -> Vec<i16> {
    (0..ms * 16)
        .map(|i| (8000.0 * (i as f64 * 0.2).sin()) as i16)
        .collect()
}

fn session(provider: Arc<dyn ModelProvider>) -> (Session, Buffer) {
    let buffer = Buffer::default();
    (
        Session::new(Out::new(Box::new(buffer.clone())), provider),
        buffer,
    )
}

fn of_type<'a>(lines: &'a [Value], kind: &str) -> Vec<&'a Value> {
    lines.iter().filter(|l| l["type"] == kind).collect()
}

fn states(lines: &[Value]) -> Vec<String> {
    of_type(lines, "status")
        .iter()
        .map(|l| l["state"].as_str().unwrap().to_string())
        .collect()
}

/// Plays the given chunks into the sink the moment it starts, then does nothing.
struct Scripted(Vec<Vec<i16>>);

impl Capture for Scripted {
    fn start(&mut self, mut sink: SampleSink) -> Result<(), CaptureError> {
        for chunk in &self.0 {
            sink(chunk);
        }
        Ok(())
    }
    fn stop(&mut self) {}
}

struct Failing(&'static str);

impl Capture for Failing {
    fn start(&mut self, _sink: SampleSink) -> Result<(), CaptureError> {
        Err(CaptureError::Failed(self.0.into()))
    }
    fn stop(&mut self) {}
}

/// A microphone that counts how often it was opened and closed; it can refuse to open again.
struct CountingMic {
    starts: Arc<AtomicUsize>,
    stops: Arc<AtomicUsize>,
    fail_reopen: bool,
}

impl Capture for CountingMic {
    fn start(&mut self, _sink: SampleSink) -> Result<(), CaptureError> {
        if self.starts.fetch_add(1, Ordering::SeqCst) > 0 && self.fail_reopen {
            return Err(CaptureError::Failed("device gone".into()));
        }
        Ok(())
    }
    fn stop(&mut self) {
        self.stops.fetch_add(1, Ordering::SeqCst);
    }
}

fn one_sentence() -> Vec<Vec<i16>> {
    vec![tone(2000), vec![0; 16_000]]
}

fn stdin(text: &str) -> std::io::Cursor<Vec<u8>> {
    std::io::Cursor::new(text.as_bytes().to_vec())
}

#[test]
fn a_meeting_prints_segments_for_both_streams_then_stats_and_stopped() {
    let (session, out) = session(FakeProvider::new("hello there"));
    let code = session.run_meeting(
        "en",
        None,
        Box::new(Scripted(one_sentence())),
        Box::new(Scripted(one_sentence())),
        &mut stdin("stop\n"),
    );
    assert_eq!(code, 0);
    let lines = out.lines();
    assert_eq!(states(&lines), ["loading", "ready", "stopped"]);
    let segments = of_type(&lines, "segment");
    for stream in ["system", "mic"] {
        let finals: Vec<_> = segments
            .iter()
            .filter(|s| s["stream"] == stream && s["partial"] == false)
            .collect();
        assert_eq!(finals.len(), 1, "{stream}");
        assert_eq!(finals[0]["text"], "hello there");
        assert_eq!(finals[0]["words"], serde_json::json!([]));
    }
    let stats = of_type(&lines, "stats");
    assert_eq!(stats.len(), 1);
    assert_eq!(stats[0]["language"], "en");
    assert!(stats[0]["count"].as_u64().unwrap() >= 2);
    // Levels are reported, and the model said it was ready before anything else.
    assert!(!of_type(&lines, "level").is_empty());
    assert_eq!(lines[1]["type"], "model");
    assert_eq!(lines[1]["state"], "ready");
}

#[test]
fn the_last_line_of_a_meeting_is_stopped() {
    let (session, out) = session(FakeProvider::new("x"));
    session.run_meeting(
        "en",
        None,
        Box::new(Scripted(one_sentence())),
        Box::new(Scripted(vec![])),
        &mut stdin("stop\n"),
    );
    let lines = out.lines();
    assert_eq!(lines.last().unwrap()["state"], "stopped");
}

#[test]
fn partials_come_before_the_final_of_their_sentence() {
    let (session, out) = session(FakeProvider::new("words"));
    session.run_meeting(
        "en",
        None,
        Box::new(Scripted(one_sentence())),
        Box::new(Scripted(vec![])),
        &mut stdin("stop\n"),
    );
    let segments: Vec<Value> = of_type(&out.lines(), "segment")
        .into_iter()
        .cloned()
        .collect();
    let flags: Vec<bool> = segments
        .iter()
        .map(|s| s["partial"].as_bool().unwrap())
        .collect();
    let final_at = flags.iter().position(|p| !p).expect("a final");
    assert!(
        flags[final_at + 1..].is_empty(),
        "nothing after the final: {flags:?}"
    );
    assert!(flags[..final_at].iter().all(|p| *p));
    let ids: Vec<_> = segments.iter().map(|s| s["segmentId"].clone()).collect();
    assert!(ids.windows(2).all(|w| w[0] == w[1]), "one sentence, one id");
}

#[test]
fn partials_are_dropped_while_a_recognition_is_running() {
    let provider = Arc::new(FakeProvider {
        text: "slow".into(),
        delay: Duration::from_millis(300),
        loads: AtomicUsize::new(0),
        progress: vec![],
    });
    let (session, out) = session(provider);
    // 6 s of speech fed at once makes 8 partial snapshots; the model can take about one at a time.
    session.run_meeting(
        "en",
        None,
        Box::new(Scripted(vec![tone(6000), vec![0; 16_000]])),
        Box::new(Scripted(vec![])),
        &mut stdin("stop\n"),
    );
    let segments = of_type(&out.lines(), "segment").len();
    let finals = of_type(&out.lines(), "segment")
        .iter()
        .filter(|s| s["partial"] == false)
        .count();
    assert_eq!(finals, 1, "a final is never dropped");
    assert!(segments <= 3, "{segments} segments");
}

#[test]
fn cloud_language_prints_utterances_with_pcm_and_loads_no_model() {
    let provider = FakeProvider::new("must not be used");
    let (session, out) = session(provider.clone());
    let code = session.run_meeting(
        "vi",
        None,
        Box::new(Scripted(one_sentence())),
        Box::new(Scripted(vec![])),
        &mut stdin("stop\n"),
    );
    assert_eq!(code, 0);
    assert_eq!(provider.loads.load(Ordering::SeqCst), 0);
    let lines = out.lines();
    assert!(of_type(&lines, "segment").is_empty());
    assert!(of_type(&lines, "stats").is_empty());
    let model = of_type(&lines, "model");
    assert_eq!(
        (model[0]["language"].as_str(), model[0]["state"].as_str()),
        (Some("vi"), Some("ready"))
    );
    let utterances = of_type(&lines, "utterance");
    assert_eq!(utterances.len(), 1);
    let u = utterances[0];
    assert_eq!(u["sampleRate"], 16_000);
    assert_eq!(u["stream"], "system");
    let samples = pcm::samples_from_base64(u["pcm"].as_str().unwrap()).unwrap();
    assert_eq!(
        samples.len() as i64,
        (u["endMs"].as_i64().unwrap() - u["startMs"].as_i64().unwrap()) * 16
    );
}

#[test]
fn a_language_that_is_neither_on_device_nor_cloud_is_an_error_with_exit_code_2() {
    let (session, out) = session(FakeProvider::new("x"));
    let code = session.run_meeting(
        "xx",
        None,
        Box::new(Scripted(vec![])),
        Box::new(Scripted(vec![])),
        &mut stdin(""),
    );
    assert_eq!(code, 2);
    let lines = out.lines();
    assert_eq!(of_type(&lines, "model")[0]["state"], "error");
    let last = lines.last().unwrap();
    assert_eq!(last["state"], "error");
    assert_eq!(last["message"], "model load failed for xx");
}

#[test]
fn a_model_that_fails_to_load_reports_why() {
    struct Broken;
    impl ModelProvider for Broken {
        fn load(
            &self,
            _: &str,
            _: &mut dyn FnMut(f64),
        ) -> Result<(Box<dyn Recognizer>, Timings), String> {
            Err("download of encoder.int8.onnx failed: offline".into())
        }
    }
    let (session, out) = session(Arc::new(Broken));
    let code = session.run_meeting(
        "en",
        None,
        Box::new(Scripted(vec![])),
        Box::new(Scripted(vec![])),
        &mut stdin(""),
    );
    assert_eq!(code, 2);
    let model = &out.lines()[1];
    assert_eq!(model["state"], "error");
    assert!(model["message"].as_str().unwrap().contains("offline"));
}

#[test]
fn download_progress_is_reported_in_steps() {
    let provider = Arc::new(FakeProvider {
        text: "x".into(),
        delay: Duration::ZERO,
        loads: AtomicUsize::new(0),
        progress: vec![0.0, 0.01, 0.3, 0.32, 0.9, 1.0],
    });
    let (session, out) = session(provider);
    session.run_meeting(
        "en",
        None,
        Box::new(Scripted(vec![])),
        Box::new(Scripted(vec![])),
        &mut stdin("stop\n"),
    );
    let steps: Vec<f64> = of_type(&out.lines(), "model")
        .iter()
        .filter(|m| m["state"] == "downloading")
        .map(|m| m["progress"].as_f64().unwrap())
        .collect();
    assert_eq!(steps, [0.0, 0.3, 0.9, 1.0]);
}

#[test]
fn vocab_and_language_lines_work_and_carriage_returns_are_ignored() {
    let (session, out) = session(FakeProvider::new("the slaw is late"));
    // A meeting that lives long enough for the commands, then the stop.
    let code = session.run_meeting(
        "en",
        None,
        Box::new(Scripted(vec![])),
        Box::new(Scripted(vec![])),
        &mut stdin("vocab [\"SLA\"]\r\nlanguage vi\r\nstop\r\n"),
    );
    assert_eq!(code, 0);
    // Give the language thread a moment (it only prints one line).
    std::thread::sleep(Duration::from_millis(100));
    let lines = out.lines();
    let models: Vec<_> = of_type(&lines, "model")
        .iter()
        .map(|m| {
            (
                m["language"].as_str().unwrap().to_string(),
                m["state"].as_str().unwrap().to_string(),
            )
        })
        .collect();
    assert_eq!(
        models,
        [("en".into(), "ready".into()), ("vi".into(), "ready".into())]
    );
}

#[test]
fn the_vocabulary_corrects_what_the_model_heard() {
    let (session, out) = session(FakeProvider::new("the slaw is late"));
    session.run_meeting(
        "en",
        Some("[\"SLA\"]"),
        Box::new(Scripted(one_sentence())),
        Box::new(Scripted(vec![])),
        &mut stdin("stop\n"),
    );
    let texts: Vec<_> = of_type(&out.lines(), "segment")
        .iter()
        .map(|s| s["text"].as_str().unwrap().to_string())
        .collect();
    assert!(!texts.is_empty());
    assert!(texts.iter().all(|t| t == "the SLA is late"), "{texts:?}");
}

#[test]
fn end_of_input_ends_the_meeting_like_stop() {
    let (session, out) = session(FakeProvider::new("x"));
    let code = session.run_meeting(
        "en",
        None,
        Box::new(Scripted(vec![])),
        Box::new(Scripted(vec![])),
        &mut stdin(""),
    );
    assert_eq!(code, 0);
    assert_eq!(out.lines().last().unwrap()["state"], "stopped");
}

#[test]
fn without_capture_the_meeting_says_so_and_loads_nothing() {
    let provider = FakeProvider::new("x");
    let (session, out) = session(provider.clone());
    let code = session.run_meeting(
        "en",
        None,
        Box::new(Unavailable),
        Box::new(Unavailable),
        &mut stdin("vocab []\r\nstop\r\n"),
    );
    assert_eq!(code, 0);
    assert_eq!(provider.loads.load(Ordering::SeqCst), 0);
    let lines = out.lines();
    assert_eq!(states(&lines), ["loading", "error", "stopped"]);
    let message = lines[1]["message"].as_str().unwrap();
    assert_eq!(message, NOT_YET);
    assert!(!message.starts_with("system audio") && !message.starts_with("microphone"));
}

#[test]
fn a_stream_that_cannot_start_is_named_and_the_meeting_goes_on() {
    let (session, out) = session(FakeProvider::new("x"));
    session.run_meeting(
        "en",
        None,
        Box::new(Failing("no output device")),
        Box::new(Scripted(one_sentence())),
        &mut stdin("stop\n"),
    );
    let lines = out.lines();
    let errors: Vec<_> = of_type(&lines, "status")
        .into_iter()
        .filter(|s| s["state"] == "error")
        .map(|s| s["message"].as_str().unwrap().to_string())
        .collect();
    assert_eq!(errors, ["system audio: no output device"]);
    assert!(of_type(&lines, "segment")
        .iter()
        .any(|s| s["stream"] == "mic"));
}

#[test]
fn file_mode_runs_every_recording_and_ends_with_stopped() {
    let (session, out) = session(FakeProvider::new("from a file"));
    let code = session.run_files(
        "en",
        None,
        &[tone(2000), tone(1500)],
        &FileOptions::default(),
    );
    assert_eq!(code, 0);
    let lines = out.lines();
    assert_eq!(states(&lines), ["loading", "ready", "stopped"]);
    let finals: Vec<_> = of_type(&lines, "segment")
        .into_iter()
        .filter(|s| s["partial"] == false)
        .collect();
    assert_eq!(finals.len(), 2);
    assert!(finals.iter().all(|s| s["stream"] == "system"));
    assert_eq!(of_type(&lines, "stats").len(), 1);
    assert!(of_type(&lines, "bench").is_empty());
}

#[test]
fn file_mode_with_bench_adds_one_summary_line() {
    let (session, out) = session(FakeProvider::new("x"));
    session.run_files(
        "en",
        None,
        &[tone(2000), tone(2000), tone(2000)],
        &FileOptions {
            bench: true,
            realtime: false,
        },
    );
    let lines = out.lines();
    let bench = of_type(&lines, "bench");
    assert_eq!(bench.len(), 1);
    assert_eq!(bench[0]["files"], 3);
    assert_eq!(bench[0]["finals"]["count"], 3);
    assert_eq!(bench[0]["sentences"]["count"], 3);
    assert!(bench[0]["partials"]["count"].is_u64());
    assert!(bench[0]["load"]["totalMs"].is_u64());
    assert_eq!(lines.last().unwrap()["state"], "stopped");
}

#[test]
fn file_mode_in_a_cloud_language_prints_utterances() {
    let (session, out) = session(FakeProvider::new("unused"));
    session.run_files("ko", None, &[tone(2000)], &FileOptions::default());
    assert_eq!(of_type(&out.lines(), "utterance").len(), 1);
}

#[test]
fn switching_models_keeps_the_old_one_until_the_new_one_is_ready() {
    struct Slow {
        release: Mutex<Receiver<()>>,
        started: Mutex<Sender<()>>,
    }
    impl ModelProvider for Slow {
        fn load(
            &self,
            language: &str,
            _: &mut dyn FnMut(f64),
        ) -> Result<(Box<dyn Recognizer>, Timings), String> {
            if language == "second" {
                self.started.lock().unwrap().send(()).unwrap();
                self.release.lock().unwrap().recv().unwrap();
            }
            Ok((
                Box::new(Fake {
                    text: language.into(),
                    delay: Duration::ZERO,
                }),
                Timings::default(),
            ))
        }
    }
    let (release_tx, release_rx) = channel();
    let (started_tx, started_rx) = channel();
    let transcriber = Arc::new(Transcriber::new(Arc::new(Slow {
        release: Mutex::new(release_rx),
        started: Mutex::new(started_tx),
    })));
    transcriber.load("first", &mut |_| {}).unwrap();
    let loading = {
        let transcriber = transcriber.clone();
        std::thread::spawn(move || transcriber.load("second", &mut |_| {}).unwrap())
    };
    started_rx.recv().unwrap();
    // The second model is still loading: the first keeps answering.
    assert_eq!(transcriber.transcribe(&[0.0; 100]).unwrap().text, "first");
    assert_eq!(transcriber.language().as_deref(), Some("first"));
    release_tx.send(()).unwrap();
    loading.join().unwrap();
    assert_eq!(transcriber.transcribe(&[0.0; 100]).unwrap().text, "second");
    assert_eq!(transcriber.language().as_deref(), Some("second"));
}

#[test]
fn short_utterances_are_padded_to_one_second() {
    struct Measure(Arc<AtomicUsize>);
    impl Recognizer for Measure {
        fn recognize(&mut self, samples: &[f32]) -> Result<String, String> {
            self.0.store(samples.len(), Ordering::SeqCst);
            Ok(String::new())
        }
    }
    struct P(Arc<AtomicUsize>);
    impl ModelProvider for P {
        fn load(
            &self,
            _: &str,
            _: &mut dyn FnMut(f64),
        ) -> Result<(Box<dyn Recognizer>, Timings), String> {
            Ok((Box::new(Measure(self.0.clone())), Timings::default()))
        }
    }
    let seen = Arc::new(AtomicUsize::new(0));
    let transcriber = Transcriber::new(Arc::new(P(seen.clone())));
    transcriber.load("en", &mut |_| {}).unwrap();
    transcriber.transcribe(&[0.1; 4000]).unwrap();
    assert_eq!(seen.load(Ordering::SeqCst), 16_000);
    transcriber.transcribe(&[0.1; 20_000]).unwrap();
    assert_eq!(seen.load(Ordering::SeqCst), 20_000);
}

#[test]
fn transcribing_before_a_model_is_loaded_is_an_error_not_a_crash() {
    let transcriber = Transcriber::new(FakeProvider::new("x"));
    assert!(transcriber.transcribe(&[0.0; 16_000]).is_err());
}

#[test]
fn mic_off_closes_the_microphone_and_mic_on_reopens_it_once() {
    let (session, out) = session(FakeProvider::new("hello"));
    let (starts, stops) = (Arc::new(AtomicUsize::new(0)), Arc::new(AtomicUsize::new(0)));
    let mic = CountingMic {
        starts: starts.clone(),
        stops: stops.clone(),
        fail_reopen: false,
    };
    let code = session.run_meeting(
        "en",
        None,
        Box::new(Scripted(vec![])),
        Box::new(mic),
        &mut stdin("mic off\r\nmic off\r\nmic on\r\nmic on\r\nstop\r\n"),
    );
    assert_eq!(code, 0);
    let lines = out.lines();
    let muted: Vec<bool> = of_type(&lines, "mic")
        .iter()
        .map(|line| line["muted"].as_bool().unwrap())
        .collect();
    // Every command is answered, but the device is only touched when the state really changes.
    assert_eq!(muted, [true, true, false, false]);
    assert_eq!(starts.load(Ordering::SeqCst), 2);
    // Closed by `mic off`, and again when the meeting ends.
    assert_eq!(stops.load(Ordering::SeqCst), 2);
}

#[test]
fn a_microphone_that_cannot_reopen_reports_the_error_and_never_claims_to_be_on() {
    let (session, out) = session(FakeProvider::new("hello"));
    let mic = CountingMic {
        starts: Arc::new(AtomicUsize::new(0)),
        stops: Arc::new(AtomicUsize::new(0)),
        fail_reopen: true,
    };
    session.run_meeting(
        "en",
        None,
        Box::new(Scripted(vec![])),
        Box::new(mic),
        &mut stdin("mic off\r\nmic on\r\nstop\r\n"),
    );
    let lines = out.lines();
    let muted: Vec<bool> = of_type(&lines, "mic")
        .iter()
        .map(|line| line["muted"].as_bool().unwrap())
        .collect();
    assert_eq!(muted, [true]);
    assert!(of_type(&lines, "status").iter().any(
        |s| s["state"] == "error" && s["message"].as_str().unwrap().starts_with("microphone: ")
    ));
}

/// A microphone that speaks one sentence every time it is opened.
struct ReplayMic(Vec<Vec<i16>>);

impl Capture for ReplayMic {
    fn start(&mut self, mut sink: SampleSink) -> Result<(), CaptureError> {
        for chunk in &self.0 {
            sink(chunk);
        }
        Ok(())
    }
    fn stop(&mut self) {}
}

#[test]
fn the_microphone_is_recognised_again_after_it_was_switched_off_and_on() {
    let (session, out) = session(FakeProvider::new("hello"));
    let code = session.run_meeting(
        "en",
        None,
        Box::new(Scripted(vec![])),
        Box::new(ReplayMic(one_sentence())),
        &mut stdin("mic off\r\nmic on\r\nstop\r\n"),
    );
    assert_eq!(code, 0);
    let lines = out.lines();
    let finals: Vec<&Value> = of_type(&lines, "segment")
        .into_iter()
        .filter(|s| s["stream"] == "mic" && s["partial"] == false)
        .collect();
    // One sentence before the switch-off and one after the switch-on: the second is not lost.
    assert_eq!(finals.len(), 2, "{lines:?}");
    // The second keeps its place on the timeline, after the first.
    assert!(finals[1]["startMs"].as_i64() >= finals[0]["endMs"].as_i64());
}

#[test]
fn a_microphone_that_never_opened_is_not_reported_as_on() {
    let (session, out) = session(FakeProvider::new("hello"));
    session.run_meeting(
        "en",
        None,
        Box::new(Scripted(vec![])),
        Box::new(Failing("no device")),
        &mut stdin("mic on\r\nstop\r\n"),
    );
    let lines = out.lines();
    // `mic on` tried again, failed again and said so; it never claimed the microphone was on.
    assert!(of_type(&lines, "mic").is_empty(), "{lines:?}");
    let errors = of_type(&lines, "status")
        .iter()
        .filter(|s| s["state"] == "error")
        .count();
    assert_eq!(errors, 2);
}
