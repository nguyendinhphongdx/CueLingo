//! The line protocol shared with `native/macos-audio`: one JSON object per line on stdout.
//! Contract: apps/docs/docs/04-modules/01-desktop/tauri-core.md (the app parses these with Zod).
use serde_json::{json, Value};
use std::io::Write;
use std::sync::{Arc, Mutex};

/// Where lines go. Cloning shares the same writer; lines from different threads never interleave.
#[derive(Clone)]
pub struct Out {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
}

impl Out {
    pub fn new(writer: Box<dyn Write + Send>) -> Self {
        Self {
            writer: Arc::new(Mutex::new(writer)),
        }
    }

    pub fn stdout() -> Self {
        Self::new(Box::new(std::io::stdout()))
    }

    /// Writes one event and flushes, so the app sees it at once. A closed pipe is not our problem to report.
    pub fn emit(&self, value: Value) {
        if let Ok(mut writer) = self.writer.lock() {
            let _ = writeln!(writer, "{value}");
            let _ = writer.flush();
        }
    }

    pub fn status(&self, state: &str, message: &str) {
        self.emit(status(state, message));
    }
}

pub fn status(state: &str, message: &str) -> Value {
    json!({ "type": "status", "state": state, "message": message })
}

/// The microphone was switched off (`muted`) or on again; the app shows it in both windows.
pub fn mic(muted: bool) -> Value {
    json!({ "type": "mic", "muted": muted })
}

pub fn level(stream: &str, rms: f32, peak: f32) -> Value {
    json!({ "type": "level", "stream": stream, "rms": f64::from(rms), "peak": f64::from(peak) })
}

pub fn segment(
    segment_id: &str,
    stream: &str,
    start_ms: i64,
    end_ms: i64,
    text: &str,
    partial: bool,
) -> Value {
    json!({
        "type": "segment", "segmentId": segment_id, "stream": stream,
        "startMs": start_ms, "endMs": end_ms, "text": text,
        "words": [], "partial": partial,
    })
}

pub fn utterance(segment_id: &str, stream: &str, start_ms: i64, end_ms: i64, pcm: &str) -> Value {
    json!({
        "type": "utterance", "segmentId": segment_id, "stream": stream,
        "startMs": start_ms, "endMs": end_ms, "sampleRate": 16_000, "pcm": pcm,
    })
}

pub fn model_downloading(language: &str, progress: f64) -> Value {
    json!({ "type": "model", "language": language, "state": "downloading", "progress": progress })
}

pub fn model_ready(language: &str) -> Value {
    json!({ "type": "model", "language": language, "state": "ready" })
}

pub fn model_error(language: &str, message: &str) -> Value {
    json!({ "type": "model", "language": language, "state": "error", "message": message })
}

pub fn stats(language: &str, count: usize, p50_ms: f64, p95_ms: f64) -> Value {
    json!({
        "type": "stats", "language": language, "count": count,
        "p50Ms": p50_ms.round(), "p95Ms": p95_ms.round(),
    })
}

/// Passes on download progress only when it moved by at least 5 points, so the pipe is not flooded.
#[derive(Default)]
pub struct ProgressGate {
    last: Option<f64>,
}

impl ProgressGate {
    pub fn should_report(&mut self, fraction: f64) -> bool {
        match self.last {
            Some(last) if last >= 1.0 => false,
            Some(last) if fraction < 1.0 && fraction - last < 0.05 => false,
            _ => {
                self.last = Some(fraction);
                true
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_mic_line_says_whether_the_microphone_is_off() {
        assert_eq!(mic(true), json!({ "type": "mic", "muted": true }));
        assert_eq!(mic(false), json!({ "type": "mic", "muted": false }));
    }

    #[test]
    fn progress_gate_passes_five_point_steps_and_the_end_once() {
        let mut gate = ProgressGate::default();
        assert!(gate.should_report(0.0));
        assert!(!gate.should_report(0.04));
        assert!(gate.should_report(0.05));
        assert!(!gate.should_report(0.09));
        assert!(gate.should_report(0.96));
        assert!(gate.should_report(1.0)); // the end is always worth saying
        assert!(!gate.should_report(1.0));
    }

    #[test]
    fn segment_line_has_the_fields_the_app_parses() {
        let v = segment("abc", "system", 10, 20, "hello", true);
        assert_eq!(v["type"], "segment");
        assert_eq!(v["segmentId"], "abc");
        assert_eq!(v["words"], serde_json::json!([]));
        assert_eq!(v["partial"], true);
    }

    #[test]
    fn utterance_line_says_16_khz() {
        let v = utterance("abc", "mic", 0, 1000, "AAA=");
        assert_eq!(v["sampleRate"], 16_000);
        assert_eq!(v["pcm"], "AAA=");
    }
}
