//! cuelingo-audio for Windows: speaks the line protocol of `native/macos-audio` (one JSON object per line on
//! stdout, `stop` / `vocab` / `language` lines on stdin), so `src-tauri/src/audio_bridge.rs` runs it unchanged.
//! Protocol: apps/docs/docs/05-engineering/scaffold/07-native-swift.md
//!
//! This build has no capture or recognition yet (WASAPI loopback and Parakeet ONNX come after the Windows spike,
//! ADR 0020): a meeting reports one clear error and waits for `stop`. The one-shot probes answer for real where
//! Windows lets us (microphone consent), so onboarding shows the right state.
use std::io::{self, BufRead, Write};

mod permissions;

/// The error a meeting reports until capture lands. Not prefixed with `system audio`/`microphone`, so the
/// app does not point the person at a privacy setting that would not help.
const NOT_YET: &str = "windows: capture and captions are not available in this Windows build yet";

fn line(value: serde_json::Value) -> String {
    value.to_string()
}

fn status(state: &str, message: &str) -> String {
    line(serde_json::json!({ "type": "status", "state": state, "message": message }))
}

/// What one run prints for its arguments, before any stdin is read. `None` means: a meeting, keep reading stdin.
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

/// True when a stdin line ends the meeting. Windows pipes may carry `\r\n`.
fn is_stop(input: &str) -> bool {
    input.trim_end_matches(['\r', '\n']).trim() == "stop"
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let stdout = io::stdout();
    let mut out = stdout.lock();

    if let Some(lines) = one_shot(&args, permissions::microphone()) {
        for l in lines {
            let _ = writeln!(out, "{l}");
        }
        return;
    }

    let _ = writeln!(out, "{}", status("loading", "starting"));
    let _ = writeln!(out, "{}", status("error", NOT_YET));
    let _ = out.flush();
    // Stay until the app says stop (or closes the pipe), like a real session would.
    for input in io::stdin().lock().lines().map_while(Result::ok) {
        if is_stop(&input) {
            break;
        }
    }
    let _ = writeln!(out, "{}", status("stopped", ""));
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
    fn meeting_error_does_not_blame_a_permission() {
        let v = parse(&status("error", NOT_YET));
        let message = v["message"].as_str().unwrap();
        assert!(!message.starts_with("system audio"));
        assert!(!message.starts_with("microphone"));
    }

    #[test]
    fn stop_accepts_windows_line_endings() {
        assert!(is_stop("stop"));
        assert!(is_stop("stop\r"));
        assert!(!is_stop("vocab [\"SLA\"]"));
    }
}
