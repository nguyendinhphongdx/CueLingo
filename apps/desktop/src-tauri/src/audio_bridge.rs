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
        "model" | "stats" | "language-suggestion" => Some(("audio-model", value)),
        _ => None,
    }
}

/// JSON array of vocabulary terms. serde escapes quotes and control characters, so it is always one line.
/// Builds the sidecar command with its environment (language, detection list, vocabulary).
pub(crate) fn sidecar_command(
    path: PathBuf,
    language: &str,
    detect: &[String],
    vocabulary: &[String],
) -> Result<Command, String> {
    let mut command = Command::new(path);
    command
        .env("CUELINGO_LANGUAGE", language)
        .env("CUELINGO_DETECT", detect.join(","));
    if !vocabulary.is_empty() {
        command.env("CUELINGO_VOCAB", vocab_json(vocabulary)?);
    }
    Ok(command)
}

pub(crate) fn vocab_json(terms: &[String]) -> Result<String, String> {
    serde_json::to_string(terms).map_err(|_| "invalid_vocabulary".to_string())
}

/// The stdin line that replaces the sidecar's vocabulary: `vocab <json array>`.
pub(crate) fn vocab_line(terms: &[String]) -> Result<String, String> {
    Ok(format!("vocab {}", vocab_json(terms)?))
}

impl AudioBridge {
    /// `language` picks the recognition model the sidecar loads first (a short code such as `en` or `ja`).
    /// `vocabulary` (already cleaned) biases recognition toward those terms; it never leaves the process but the sidecar.
    pub fn start(
        &self,
        app: &AppHandle,
        language: &str,
        detect: &[String],
        vocabulary: &[String],
    ) -> Result<(), String> {
        let mut running = self.running.lock().map_err(|e| e.to_string())?;
        if running.is_some() {
            return Err("session_already_running".into());
        }
        let path = sidecar_path().ok_or("audio_sidecar_missing")?;
        let mut command = sidecar_command(path, language, detect, vocabulary)?;
        let mut child = command
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

    /// Replaces the recognition vocabulary while running.
    pub fn set_vocabulary(&self, terms: &[String]) -> Result<(), String> {
        let line = vocab_line(terms)?;
        let mut running = self.running.lock().map_err(|e| e.to_string())?;
        let sidecar = running.as_mut().ok_or("no_session_running")?;
        writeln!(sidecar.stdin, "{line}").map_err(|e| e.to_string())?;
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
    use std::ffi::OsStr;

    fn env_of(cmd: &Command, key: &str) -> Option<String> {
        cmd.get_envs()
            .find(|(k, _)| *k == OsStr::new(key))
            .and_then(|(_, v)| v.map(|v| v.to_string_lossy().into_owned()))
    }

    #[test]
    fn sidecar_command_sets_vocab_env_only_when_non_empty() {
        let vocab = vec!["Acme".to_string(), "say \"hi\\\"".to_string()];
        let cmd = sidecar_command("x".into(), "en", &["en".into(), "vi".into()], &vocab).unwrap();
        assert_eq!(env_of(&cmd, "CUELINGO_LANGUAGE").as_deref(), Some("en"));
        assert_eq!(env_of(&cmd, "CUELINGO_DETECT").as_deref(), Some("en,vi"));
        let json = env_of(&cmd, "CUELINGO_VOCAB").unwrap();
        let back: Vec<String> = serde_json::from_str(&json).unwrap();
        assert_eq!(back, vocab);

        let cmd = sidecar_command("x".into(), "en", &[], &[]).unwrap();
        assert!(env_of(&cmd, "CUELINGO_VOCAB").is_none());
        assert_eq!(env_of(&cmd, "CUELINGO_LANGUAGE").as_deref(), Some("en"));
    }

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
        let suggestion = r#"{"type":"language-suggestion","language":"ja","confidence":0.99}"#;
        assert_eq!(route_line(suggestion).unwrap().0, "audio-model");
    }

    #[test]
    fn vocab_line_escapes_quotes_and_stays_on_one_line() {
        let terms = vec!["say \"hi\"".to_string(), "back\\slash".to_string()];
        let line = vocab_line(&terms).unwrap();
        assert!(line.starts_with("vocab ["));
        assert!(!line.contains('\n') && !line.contains('\r'));
        let json = vocab_json(&terms).unwrap();
        assert!(!json.contains('\n'));
        let back: Vec<String> = serde_json::from_str(&json).unwrap();
        assert_eq!(back, terms);
        // A raw newline would still be escaped, never emitted as a line break.
        let nl = vocab_line(&["a\nb".to_string()]).unwrap();
        assert!(!nl.contains('\n'));
    }

    #[test]
    fn ignores_noise() {
        assert!(route_line("[INFO] model loaded").is_none());
        assert!(route_line(r#"{"type":"other"}"#).is_none());
    }
}
