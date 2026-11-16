//! A run of the sidecar: model loading, the two pipelines, the stdin command loop, the closing report.
//! Port of the second half of `Sources/Sidecar/main.swift`.
use crate::capture::{Capture, CaptureError};
use crate::pipeline::{FinalTiming, Pipeline, Shared};
use crate::protocol::{self, Out, ProgressGate};
use crate::stats::percentile;
use crate::stt::{self, ModelProvider, Timings, Transcriber};
use std::io::BufRead;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Instant;

/// The error a meeting reports while capture is not implemented. Not prefixed with `system audio`/
/// `microphone`, so the app does not point the person at a privacy setting that would not help.
pub const NOT_YET: &str =
    "windows: capture and captions are not available in this Windows build yet";

/// A finished sentence of up to 8 s of speech is at most this long in the buffer: speech, the 600 ms of
/// silence that ends it, and 200 ms of pre-roll.
const SENTENCE_BUFFER_MS: i64 = 8_800;

#[derive(Clone)]
pub struct Session {
    shared: Shared,
    /// Which time went where while the first model got ready (reported by `--bench`).
    load: Arc<Mutex<(Timings, u64)>>,
}

/// What `--file` was asked to do beyond the line protocol.
#[derive(Default)]
pub struct FileOptions {
    /// Print one extra `bench` line at the end with numbers for the S2 measurement.
    pub bench: bool,
}

impl Session {
    pub fn new(out: Out, provider: Arc<dyn ModelProvider>) -> Self {
        Self {
            shared: Shared {
                out,
                transcriber: Arc::new(Transcriber::new(provider)),
                cloud: Arc::new(AtomicBool::new(false)),
                finals: Arc::new(Mutex::new(Vec::new())),
            },
            load: Arc::new(Mutex::new((Timings::default(), 0))),
        }
    }

    fn out(&self) -> &Out {
        &self.shared.out
    }

    /// Loads the model for a language, reporting download progress. False when it could not.
    pub fn load_model(&self, language: &str) -> bool {
        let out = self.out();
        if !stt::is_supported(language) && !stt::is_cloud(language) {
            out.emit(protocol::model_error(language, "unsupported language"));
            return false;
        }
        if stt::is_cloud(language) {
            // Nothing to download or load; utterances go out as audio at once.
            self.shared.cloud.store(true, Ordering::Release);
            out.emit(protocol::model_ready(language));
            return true;
        }
        let mut gate = ProgressGate::default();
        let started = Instant::now();
        let result = self.shared.transcriber.load(language, &mut |fraction| {
            if gate.should_report(fraction) {
                out.emit(protocol::model_downloading(language, fraction));
            }
        });
        match result {
            Ok(timings) => {
                if let Ok(mut load) = self.load.lock() {
                    if load.1 == 0 {
                        *load = (timings, started.elapsed().as_millis() as u64);
                    }
                }
                self.shared.cloud.store(false, Ordering::Release);
                out.emit(protocol::model_ready(language));
                true
            }
            Err(message) => {
                out.emit(protocol::model_error(language, &message));
                false
            }
        }
    }

    /// `["SLA", ...]` as JSON; anything else is ignored.
    pub fn apply_vocabulary(&self, json: &str) {
        if let Ok(terms) = serde_json::from_str::<Vec<String>>(json) {
            self.shared.transcriber.set_vocabulary(&terms);
        }
    }

    /// Recognition time per language, reported once at the end so slow models show up in a real run.
    fn report_latency(&self) {
        for (language, count, p50, p95) in self.shared.transcriber.latency_summary() {
            self.out().emit(protocol::stats(&language, count, p50, p95));
        }
    }

    /// A meeting: both captures, commands from `input` until `stop` or end of input. Returns the exit code.
    pub fn run_meeting(
        &self,
        language: &str,
        vocabulary: Option<&str>,
        mut system: Box<dyn Capture>,
        mut mic: Box<dyn Capture>,
        input: &mut dyn BufRead,
    ) -> i32 {
        let out = self.out();
        out.status("loading", "loading speech model");
        if let Err(CaptureError::Unavailable) = system.available().and(mic.available()) {
            // Do not download a model that nothing can feed.
            out.status("error", NOT_YET);
            wait_for_stop(input, |_| {});
            out.status("stopped", "");
            return 0;
        }
        if !self.load_model(language) {
            out.status("error", &format!("model load failed for {language}"));
            return 2;
        }
        if let Some(json) = vocabulary {
            self.apply_vocabulary(json);
        }
        let system_pipe = Arc::new(Pipeline::new("system", self.shared.clone()));
        let mic_pipe = Arc::new(Pipeline::new("mic", self.shared.clone()));
        let sink = |pipeline: &Arc<Pipeline>| {
            let pipeline = pipeline.clone();
            Box::new(move |samples: &[i16]| pipeline.feed(samples)) as crate::capture::SampleSink
        };
        if let Err(e) = system.start(sink(&system_pipe)) {
            out.status("error", &format!("system audio: {e}"));
        }
        if let Err(e) = mic.start(sink(&mic_pipe)) {
            out.status("error", &format!("microphone: {e}"));
        }
        out.status("ready", "");

        wait_for_stop(input, |command| {
            if let Some(json) = command.strip_prefix("vocab ") {
                self.apply_vocabulary(json);
            } else if let Some(target) = command.strip_prefix("language ") {
                let target = target.trim().to_string();
                let session = self.clone();
                // Off the input loop so "stop" is never stuck behind a model download.
                std::thread::spawn(move || {
                    session.load_model(&target);
                });
            }
        });
        system.stop();
        mic.stop();
        system_pipe.finish();
        mic_pipe.finish();
        self.report_latency();
        out.status("stopped", "");
        0
    }

    /// `--file x.wav ...` (16 kHz mono Int16 in memory): runs recordings through the same pipeline, for tests
    /// and demos. Returns the exit code.
    pub fn run_files(
        &self,
        language: &str,
        vocabulary: Option<&str>,
        files: &[Vec<i16>],
        options: &FileOptions,
    ) -> i32 {
        let out = self.out();
        out.status("loading", "loading speech model");
        if !self.load_model(language) {
            out.status("error", &format!("model load failed for {language}"));
            return 2;
        }
        if let Some(json) = vocabulary {
            self.apply_vocabulary(json);
        }
        let pipeline = Pipeline::new("system", self.shared.clone());
        out.status("ready", "");
        let mut audio_ms = 0i64;
        for samples in files {
            for chunk in samples.chunks(3200) {
                pipeline.feed(chunk);
            }
            // Trailing silence closes the last sentence.
            pipeline.feed(&[0i16; 16_000]);
            audio_ms += (samples.len() / 16) as i64;
        }
        pipeline.finish();
        self.report_latency();
        if options.bench {
            out.emit(self.bench(files.len(), audio_ms));
        }
        out.status("stopped", "");
        0
    }

    /// Numbers for the S2 measurement; a development aid that the app never asks for.
    fn bench(&self, files: usize, audio_ms: i64) -> serde_json::Value {
        let finals: Vec<FinalTiming> = self
            .shared
            .finals
            .lock()
            .map(|f| f.clone())
            .unwrap_or_default();
        let summary = |items: &[FinalTiming]| {
            let times: Vec<f64> = items.iter().map(|t| t.elapsed_ms).collect();
            serde_json::json!({
                "count": items.len(),
                "p50Ms": percentile(&times, 50.0).map(f64::round),
                "p95Ms": percentile(&times, 95.0).map(f64::round),
                "maxAudioMs": items.iter().map(|t| t.audio_ms).max(),
            })
        };
        let sentences: Vec<FinalTiming> = finals
            .iter()
            .copied()
            .filter(|t| t.audio_ms <= SENTENCE_BUFFER_MS)
            .collect();
        let (timings, total_ms) = self.load.lock().map(|l| *l).unwrap_or_default();
        serde_json::json!({
            "type": "bench",
            "files": files,
            "audioMs": audio_ms,
            "load": {
                "totalMs": total_ms,
                "downloadMs": timings.download_ms,
                "verifyMs": timings.verify_ms,
                "createMs": timings.create_ms,
            },
            "finals": summary(&finals),
            "sentences": summary(&sentences),
            "peakWorkingSetMb": crate::memory::peak_working_set_mb(),
            "cpus": std::thread::available_parallelism().map_or(0, |n| n.get()),
        })
    }
}

/// Reads command lines until `stop` or the end of the input (the app closing the pipe); `other` gets the
/// rest, trimmed. A Windows pipe may deliver `\r\n`.
fn wait_for_stop(input: &mut dyn BufRead, mut other: impl FnMut(&str)) {
    let mut raw = Vec::new();
    loop {
        raw.clear();
        match input.read_until(b'\n', &mut raw) {
            Ok(0) | Err(_) => return,
            Ok(_) => {}
        }
        let line = String::from_utf8_lossy(&raw);
        let command = line.trim();
        if command == "stop" {
            return;
        }
        other(command);
    }
}
