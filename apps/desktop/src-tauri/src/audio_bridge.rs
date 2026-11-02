//! Runs the Swift `cuelingo-audio` sidecar and forwards its JSON lines to the webview as Tauri events.
//! Protocol: apps/docs/docs/05-engineering/scaffold/07-native-swift.md
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::Mutex;

use serde_json::Value;
use tauri::{AppHandle, Emitter};

pub struct Sidecar {
    child: Child,
    stdin: ChildStdin,
}

#[derive(Default)]
pub struct AudioBridge {
    running: Mutex<Option<Sidecar>>,
}

/// Where the sidecar binary lives: `CUELINGO_AUDIO_BIN`, next to the app executable (bundled), or the dev build.
pub(crate) fn sidecar_path() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("CUELINGO_AUDIO_BIN") {
        return Some(PathBuf::from(path));
    }
    let exe = std::env::current_exe().ok()?;
    let bundled = exe.parent()?.join("cuelingo-audio");
    if bundled.exists() {
        return Some(bundled);
    }
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../native/macos-audio/.build/debug/cuelingo-audio");
    dev.exists().then_some(dev)
}

/// Maps one sidecar line to `(event name, payload)`. Unknown or malformed lines are ignored.
pub fn route_line(line: &str) -> Option<(&'static str, Value)> {
    let value: Value = serde_json::from_str(line).ok()?;
    match value.get("type")?.as_str()? {
        "segment" => Some(("segment", value)),
        "status" => Some(("audio-status", value)),
        "model" | "stats" => Some(("audio-model", value)),
        _ => None,
    }
}

impl AudioBridge {
    /// `language` picks the recognition model the sidecar loads first (a short code such as `en` or `ja`).
    pub fn start(&self, app: &AppHandle, language: &str) -> Result<(), String> {
        let mut running = self.running.lock().map_err(|e| e.to_string())?;
        if running.is_some() {
            return Err("session_already_running".into());
        }
        let path = sidecar_path().ok_or("audio_sidecar_missing")?;
        let mut child = Command::new(path)
            .env("CUELINGO_LANGUAGE", language)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("audio_sidecar_failed: {e}"))?;
        let stdout = child.stdout.take().ok_or("audio_sidecar_failed")?;
        let stdin = child.stdin.take().ok_or("audio_sidecar_failed")?;

        let app = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Some((event, payload)) = route_line(&line) {
                    let _ = app.emit(event, payload);
                }
            }
        });
        *running = Some(Sidecar { child, stdin });
        Ok(())
    }

    /// Switches the recognition model while running; captions continue on the old one until it is ready.
    pub fn set_language(&self, language: &str) -> Result<(), String> {
        let mut running = self.running.lock().map_err(|e| e.to_string())?;
        let sidecar = running.as_mut().ok_or("no_session_running")?;
        writeln!(sidecar.stdin, "language {language}").map_err(|e| e.to_string())?;
        sidecar.stdin.flush().map_err(|e| e.to_string())
    }

    pub fn stop(&self) -> Result<(), String> {
        let mut running = self.running.lock().map_err(|e| e.to_string())?;
        if let Some(mut sidecar) = running.take() {
            let _ = writeln!(sidecar.stdin, "stop");
            let _ = sidecar.stdin.flush();
            // Give the sidecar a moment to flush the last sentence, then make sure it is gone.
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_secs(3));
                let _ = sidecar.child.kill();
                let _ = sidecar.child.wait();
            });
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn routes_segments_and_status() {
        let seg = r#"{"type":"segment","segmentId":"x","text":"hi"}"#;
        assert_eq!(route_line(seg).unwrap().0, "segment");
        let st = r#"{"type":"status","state":"ready"}"#;
        assert_eq!(route_line(st).unwrap().0, "audio-status");
    }

    #[test]
    fn routes_model_progress_and_latency_stats() {
        let model = r#"{"type":"model","language":"ja","state":"downloading","progress":0.4}"#;
        assert_eq!(route_line(model).unwrap().0, "audio-model");
        let stats = r#"{"type":"stats","language":"ja","count":9,"p50Ms":210,"p95Ms":480}"#;
        assert_eq!(route_line(stats).unwrap().0, "audio-model");
    }

    #[test]
    fn ignores_noise() {
        assert!(route_line("[INFO] model loaded").is_none());
        assert!(route_line(r#"{"type":"other"}"#).is_none());
    }
}
