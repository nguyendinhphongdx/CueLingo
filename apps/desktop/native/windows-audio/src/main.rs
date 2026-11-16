//! cuelingo-audio for Windows: speaks the line protocol of `native/macos-audio` (one JSON object per line on
//! stdout, `stop` / `vocab` / `language` lines on stdin), so `src-tauri/src/audio_bridge.rs` runs it unchanged.
//! Protocol: apps/docs/docs/05-engineering/scaffold/07-native-swift.md
//!
//! Recognition (Parakeet ONNX) and `--file` work; WASAPI capture is the next step (ADR 0020), so a meeting
//! still reports one clear error and waits for `stop`. The one-shot probes answer for real where Windows lets
//! us (microphone consent), so onboarding shows the right state.
use cuelingo_audio::protocol::Out;
use cuelingo_audio::session::{FileOptions, Session, NOT_YET};
use cuelingo_audio::{capture, permissions, stt, wav};
use std::io::{self, Write};

fn line(value: serde_json::Value) -> String {
    value.to_string()
}

/// What one run prints for its arguments, before any stdin is read. `None` means: a meeting (or `--file`).
fn one_shot(args: &[String], microphone: &str) -> Option<Vec<String>> {
    if args.iter().any(|a| a == "--permissions") {
        return Some(vec![line(
            serde_json::json!({ "type": "permissions", "microphone": microphone }),
        )]);
    }
    // Calendar suggestions are macOS only (EventKit); print nothing so the app treats it as unavailable.
    if args.iter().any(|a| a.starts_with("--calendar-")) {
        return Some(vec![]);
    }
    if args.iter().any(|a| a == "--check-system-audio") {
        return Some(vec![line(
            serde_json::json!({ "type": "system-audio", "state": "error", "message": NOT_YET }),
        )]);
    }
    None
}

/// The values after every `--file`: several recordings run one after the other in one session (the model is
/// loaded once), which is what the benchmark needs.
fn file_arguments(args: &[String]) -> Vec<&str> {
    args.windows(2)
        .filter(|pair| pair[0] == "--file")
        .map(|pair| pair[1].as_str())
        .collect()
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();

    if let Some(lines) = one_shot(&args, permissions::microphone()) {
        let mut out = io::stdout().lock();
        for l in lines {
            let _ = writeln!(out, "{l}");
        }
        return;
    }

    let out = Out::stdout();
    let language = std::env::var("CUELINGO_LANGUAGE").unwrap_or_else(|_| "en".to_string());
    let vocabulary = std::env::var("CUELINGO_VOCAB").ok();
    let session = Session::new(out.clone(), stt::default_provider());

    let paths = file_arguments(&args);
    let code = if paths.is_empty() {
        let (system, mic) = capture::platform();
        session.run_meeting(
            &language,
            vocabulary.as_deref(),
            system,
            mic,
            &mut io::stdin().lock(),
        )
    } else {
        let mut recordings = Vec::new();
        for path in &paths {
            match std::fs::read(path)
                .map_err(|e| e.to_string())
                .and_then(|bytes| wav::read_16k_mono(&bytes))
            {
                Ok(samples) => recordings.push(samples),
                Err(e) => {
                    out.status("error", &format!("cannot read {path}: {e}"));
                    std::process::exit(1);
                }
            }
        }
        let options = FileOptions {
            bench: args.iter().any(|a| a == "--bench"),
            realtime: args.iter().any(|a| a == "--realtime"),
        };
        session.run_files(&language, vocabulary.as_deref(), &recordings, &options)
    };
    std::process::exit(code);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(l: &str) -> serde_json::Value {
        serde_json::from_str(l).unwrap()
    }

    #[test]
    fn permissions_probe_reports_the_microphone_state() {
        let lines = one_shot(&["--permissions".into()], "denied").unwrap();
        assert_eq!(lines.len(), 1);
        let v = parse(&lines[0]);
        assert_eq!(v["type"], "permissions");
        assert_eq!(v["microphone"], "denied");
    }

    #[test]
    fn calendar_probes_print_nothing() {
        assert_eq!(
            one_shot(&["--calendar-events".into()], "granted"),
            Some(vec![])
        );
    }

    #[test]
    fn system_audio_check_says_it_is_not_available() {
        let lines = one_shot(&["--check-system-audio".into()], "granted").unwrap();
        let v = parse(&lines[0]);
        assert_eq!(v["type"], "system-audio");
        assert_eq!(v["state"], "error");
    }

    #[test]
    fn a_meeting_is_not_a_one_shot() {
        assert_eq!(one_shot(&[], "granted"), None);
    }

    #[test]
    fn file_arguments_take_every_path_after_a_flag() {
        let args: Vec<String> = ["--bench", "--file", "a.wav", "--file", "b.wav"]
            .map(String::from)
            .to_vec();
        assert_eq!(file_arguments(&args), vec!["a.wav", "b.wav"]);
        assert!(file_arguments(&["--file".to_string()]).is_empty());
    }
}
