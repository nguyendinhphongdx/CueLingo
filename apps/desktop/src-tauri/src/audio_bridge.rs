//! Runs the Swift `cuelingo-audio` sidecar and forwards its JSON lines to the webview as Tauri events.
//! Protocol: apps/docs/docs/05-engineering/scaffold/07-native-swift.md
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{Arc, Mutex};

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

/// The sidecar run that only downloads a model (onboarding, Settings). It never runs at the same time as a
/// meeting, and there is at most one of it.
#[derive(Default)]
pub struct ModelDownload {
    running: Arc<Mutex<Option<Child>>>,
}

pub(crate) fn download_command(path: PathBuf, language: &str) -> Command {
    let mut command = hidden_command(path);
    command
        .arg("--download-model")
        .env("CUELINGO_LANGUAGE", language);
    command
}

/// Routes the lines of one download run. A run that ends without saying `ready` or `error` (the sidecar
/// crashed or was killed) gets one `error` event, so a screen never waits for a download that is gone.
pub(crate) fn forward_download_lines(
    lines: impl Iterator<Item = String>,
    language: &str,
    emit: &mut dyn FnMut(&'static str, Value),
) {
    let mut finished = false;
    for line in lines {
        let Some((event, payload)) = route_line(&line) else {
            continue;
        };
        let is_model = payload.get("type").and_then(Value::as_str) == Some("model");
        let state = payload.get("state").and_then(Value::as_str);
        if event == "audio-model" && is_model && matches!(state, Some("ready" | "error")) {
            finished = true;
        }
        emit(event, payload);
    }
    if !finished {
        emit(
            "audio-model",
            serde_json::json!({
                "type": "model",
                "language": language,
                "state": "error",
                "message": "download interrupted",
            }),
        );
    }
}

/// Follows the `model` events of one sidecar run, to know when a download the screens were showing is gone.
/// A meeting that is stopped while its sidecar is still fetching the model (it only reads `stop` after the
/// model is loaded) is killed, and nothing else would tell the screens the download ended.
#[derive(Default)]
pub(crate) struct ModelWatch {
    downloading: Option<String>,
}

impl ModelWatch {
    pub(crate) fn observe(&mut self, event: &str, payload: &Value) {
        if event != "audio-model" || payload.get("type").and_then(Value::as_str) != Some("model") {
            return;
        }
        let language = payload
            .get("language")
            .and_then(Value::as_str)
            .unwrap_or("");
        match payload.get("state").and_then(Value::as_str) {
            Some("downloading") => self.downloading = Some(language.to_string()),
            Some("ready" | "error") => self.downloading = None,
            _ => {}
        }
    }

    /// The `error` event to send when the run ended in the middle of a download; `None` otherwise.
    pub(crate) fn interrupted(&self) -> Option<Value> {
        self.downloading.as_ref().map(|language| {
            serde_json::json!({
                "type": "model",
                "language": language,
                "state": "error",
                "message": "download interrupted",
            })
        })
    }
}

/// Whether the child is still running; one that has exited is reaped and its slot freed.
fn alive(slot: &mut Option<Child>) -> bool {
    let exited = match slot.as_mut() {
        None => return false,
        Some(child) => !matches!(child.try_wait(), Ok(None)),
    };
    if exited {
        *slot = None;
    }
    !exited
}

impl ModelDownload {
    pub fn is_running(&self) -> bool {
        self.running
            .lock()
            .map(|mut slot| alive(&mut slot))
            .unwrap_or(false)
    }

    /// Starts downloading the model for `language`; progress and the end arrive as `audio-model` events.
    pub fn start(&self, app: &AppHandle, language: &str) -> Result<(), String> {
        let mut slot = self.running.lock().map_err(|e| e.to_string())?;
        if alive(&mut slot) {
            return Err("model_downloading".into());
        }
        let path = sidecar_path().ok_or("audio_sidecar_missing")?;
        let mut child = download_command(path, language)
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("audio_sidecar_failed: {e}"))?;
        let stdout = child.stdout.take().ok_or("audio_sidecar_failed")?;
        *slot = Some(child);
        drop(slot);

        let (app, running, language) = (app.clone(), self.running.clone(), language.to_string());
        std::thread::spawn(move || {
            let lines = BufReader::new(stdout).lines().map_while(Result::ok);
            forward_download_lines(lines, &language, &mut |event, payload| {
                let _ = app.emit(event, payload);
            });
            if let Ok(mut slot) = running.lock() {
                if let Some(mut child) = slot.take() {
                    let _ = child.wait();
                }
            }
        });
        Ok(())
    }

    /// Ends a download in progress (the app is quitting). A half-finished file is only ever a `.part`.
    pub fn stop(&self) {
        if let Ok(mut slot) = self.running.lock() {
            if let Some(mut child) = slot.take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

/// Where the sidecar binary lives: `CUELINGO_AUDIO_BIN`, next to the app executable (bundled), or the dev build.
pub(crate) fn sidecar_path() -> Option<PathBuf> {
    if let Ok(path) = std::env::var("CUELINGO_AUDIO_BIN") {
        return Some(PathBuf::from(path));
    }
    let name = format!("cuelingo-audio{}", std::env::consts::EXE_SUFFIX);
    let exe = std::env::current_exe().ok()?;
    let bundled = exe.parent()?.join(&name);
    if bundled.exists() {
        return Some(bundled);
    }
    let dev_dir = if cfg!(windows) {
        "../native/windows-audio/target/debug"
    } else {
        "../native/macos-audio/.build/debug"
    };
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join(dev_dir)
        .join(name);
    dev.exists().then_some(dev)
}

/// A sidecar process; on Windows it gets no console window of its own.
pub(crate) fn hidden_command(path: impl AsRef<std::ffi::OsStr>) -> Command {
    #[allow(unused_mut)]
    let mut command = Command::new(path);
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }
    command
}

/// Maps one sidecar line to `(event name, payload)`. Unknown or malformed lines are ignored.
pub fn route_line(line: &str) -> Option<(&'static str, Value)> {
    let value: Value = serde_json::from_str(line).ok()?;
    match value.get("type")?.as_str()? {
        "segment" => Some(("segment", value)),
        "status" => Some(("audio-status", value)),
        // Cloud languages: one finished utterance as base64 PCM, sent to the API by the TS layer.
        "utterance" => Some(("audio-utterance", value)),
        // Mic and system loudness, about 20 lines a second; only the main window draws it.
        "level" => Some(("audio-level", value)),
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
    let mut command = hidden_command(path);
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
            let mut watch = ModelWatch::default();
            for line in BufReader::new(stdout).lines().map_while(Result::ok) {
                if let Some((event, payload)) = route_line(&line) {
                    watch.observe(event, &payload);
                    // Utterance audio is about 1 MB and levels arrive ~20 times a second: main window only.
                    let _ = if event == "audio-utterance" || event == "audio-level" {
                        app.emit_to("main", event, payload)
                    } else {
                        app.emit(event, payload)
                    };
                }
            }
            // The meeting ended (or was stopped) while the model was still coming down.
            if let Some(payload) = watch.interrupted() {
                let _ = app.emit("audio-model", payload);
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

    fn run(lines: &[&str]) -> Vec<(&'static str, Value)> {
        let mut seen = Vec::new();
        let lines = lines.iter().map(|l| l.to_string());
        forward_download_lines(lines, "en", &mut |event, payload| {
            seen.push((event, payload))
        });
        seen
    }

    #[test]
    fn a_download_that_says_ready_adds_nothing() {
        let seen = run(&[
            r#"{"type":"model","language":"en","state":"downloading","progress":0.5}"#,
            r#"{"type":"model","language":"en","state":"ready"}"#,
        ]);
        assert_eq!(seen.len(), 2);
        assert!(seen.iter().all(|(event, _)| *event == "audio-model"));
    }

    #[test]
    fn a_download_that_ends_without_a_verdict_reports_an_error() {
        let seen =
            run(&[r#"{"type":"model","language":"en","state":"downloading","progress":0.2}"#]);
        let (event, last) = seen.last().unwrap();
        assert_eq!(*event, "audio-model");
        assert_eq!(last["state"], "error");
        assert_eq!(last["language"], "en");
        // A silent crash is the same.
        assert_eq!(run(&[]).len(), 1);
    }

    #[test]
    fn an_error_from_the_sidecar_is_the_verdict_and_nothing_is_added() {
        let seen =
            run(&[r#"{"type":"model","language":"en","state":"error","message":"offline"}"#]);
        assert_eq!(seen.len(), 1);
        assert_eq!(seen[0].1["message"], "offline");
    }

    #[test]
    fn lines_that_are_not_events_are_ignored() {
        let seen = run(&[
            "not json",
            r#"{"type":"level"}"#,
            r#"{"type":"model","state":"ready"}"#,
        ]);
        // The level line is a real event for the app (audio-level); only the verdict decides the end.
        assert!(seen.iter().any(|(_, p)| p["state"] == "ready"));
        assert_eq!(
            seen.iter().filter(|(_, p)| p["state"] == "error").count(),
            0
        );
    }

    #[test]
    fn the_download_command_asks_for_one_language_and_a_download_only() {
        let command = download_command("x".into(), "en");
        let args: Vec<_> = command.get_args().collect();
        assert_eq!(args, ["--download-model"]);
        assert_eq!(env_of(&command, "CUELINGO_LANGUAGE").as_deref(), Some("en"));
    }

    fn watched(events: &[&str]) -> Option<Value> {
        let mut watch = ModelWatch::default();
        for line in events {
            let (event, payload) = route_line(line).unwrap();
            watch.observe(event, &payload);
        }
        watch.interrupted()
    }

    #[test]
    fn a_run_that_ends_mid_download_reports_which_model_was_lost() {
        let lost =
            watched(&[r#"{"type":"model","language":"en","state":"downloading","progress":0.6}"#])
                .unwrap();
        assert_eq!(lost["type"], "model");
        assert_eq!(lost["language"], "en");
        assert_eq!(lost["state"], "error");
    }

    #[test]
    fn a_download_that_finished_or_failed_loses_nothing() {
        assert!(watched(&[
            r#"{"type":"model","language":"en","state":"downloading","progress":0.6}"#,
            r#"{"type":"model","language":"en","state":"ready"}"#,
        ])
        .is_none());
        assert!(watched(&[
            r#"{"type":"model","language":"en","state":"downloading","progress":0.6}"#,
            r#"{"type":"model","language":"en","state":"error","message":"offline"}"#,
        ])
        .is_none());
        // No model event at all, or only other events: nothing was being downloaded.
        assert!(watched(&[]).is_none());
        assert!(watched(&[r#"{"type":"level","stream":"mic","rms":0.1,"peak":0.2}"#]).is_none());
    }

    #[test]
    fn nothing_running_is_not_alive() {
        assert!(!alive(&mut None));
    }

    #[test]
    fn routes_segments_and_status() {
        let seg = r#"{"type":"segment","segmentId":"x","text":"hi"}"#;
        assert_eq!(route_line(seg).unwrap().0, "segment");
        let st = r#"{"type":"status","state":"ready"}"#;
        assert_eq!(route_line(st).unwrap().0, "audio-status");
    }

    #[test]
    fn routes_utterances_to_audio_utterance() {
        let line = r#"{"type":"utterance","segmentId":"x","stream":"mic","startMs":0,"endMs":900,"sampleRate":16000,"pcm":"AAA="}"#;
        let (event, payload) = route_line(line).unwrap();
        assert_eq!(event, "audio-utterance");
        assert_eq!(payload["stream"], "mic");
    }

    #[test]
    fn routes_levels_to_audio_level() {
        let line = r#"{"type":"level","stream":"system","rms":0.2,"peak":0.5}"#;
        let (event, payload) = route_line(line).unwrap();
        assert_eq!(event, "audio-level");
        assert_eq!(payload["stream"], "system");
        assert_eq!(payload["peak"], 0.5);
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
