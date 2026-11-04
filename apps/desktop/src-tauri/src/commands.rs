//! Tauri commands. The table lives in apps/docs/docs/04-modules/01-desktop/tauri-core.md.
//! Audio/STT arrive in the realtime phase; until then session commands only track state.
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::audio_bridge::AudioBridge;
use crate::windows;

#[derive(Default)]
pub struct AppState {
    pub audio: AudioBridge,
    session_id: Mutex<Option<String>>,
    assist_level: Mutex<u8>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStartOpts {
    assist_level: u8,
    /// Meeting language; the sidecar loads the matching recognition model. English when left out.
    language: Option<String>,
    /// Other languages to listen for in the first seconds; the sidecar suggests a switch if one fits better.
    detect: Option<Vec<String>>,
    /// Terms (glossary, names) the recognizer should favor. Cleaned before it reaches the sidecar.
    #[serde(default)]
    vocabulary: Option<Vec<String>>,
}

const MAX_VOCAB_TERMS: usize = 200;
const MAX_VOCAB_TERM_CHARS: usize = 120;

/// Rejects only oversized raw lists; silently drops empty, control-character or overlong terms.
/// Errors never carry term text (terms come from the user's own glossary and are private).
pub(crate) fn clean_vocabulary(terms: Vec<String>) -> Result<Vec<String>, String> {
    if terms.len() > MAX_VOCAB_TERMS {
        return Err("vocabulary_too_large".into());
    }
    Ok(terms
        .into_iter()
        .map(|t| t.trim().to_string())
        .filter(|t| {
            !t.is_empty()
                && !t.chars().any(char::is_control)
                && t.chars().count() <= MAX_VOCAB_TERM_CHARS
        })
        .collect())
}

/// A language code is two or three lowercase letters; anything else never reaches the sidecar.
fn valid_language(code: &str) -> bool {
    (2..=3).contains(&code.len()) && code.bytes().all(|b| b.is_ascii_lowercase())
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStartResult {
    session_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionsStatus {
    /// `granted`, `denied`, `undetermined` or `unknown` (sidecar missing).
    microphone: String,
    /// macOS cannot report this one; it stays `unknown` until `check_system_audio` proves it.
    system_audio: String,
}

#[tauri::command]
pub fn session_start(
    app: AppHandle,
    state: State<AppState>,
    opts: SessionStartOpts,
) -> Result<SessionStartResult, String> {
    let mut current = state.session_id.lock().map_err(|e| e.to_string())?;
    if current.is_some() {
        return Err("session_already_running".into());
    }
    let id = format!(
        "local-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|e| e.to_string())?
            .as_millis()
    );
    *state.assist_level.lock().map_err(|e| e.to_string())? = opts.assist_level.min(5);
    let language = opts.language.as_deref().unwrap_or("en");
    if !valid_language(language) {
        return Err("invalid_language".into());
    }
    let detect = opts.detect.unwrap_or_default();
    if !detect.iter().all(|code| valid_language(code)) {
        return Err("invalid_language".into());
    }
    let vocabulary = clean_vocabulary(opts.vocabulary.unwrap_or_default())?;
    state.audio.start(&app, language, &detect, &vocabulary)?;
    // The captions live in the overlay, so a new meeting brings it up instead of waiting for the shortcut.
    windows::show_overlay(&app);
    *current = Some(id.clone());
    Ok(SessionStartResult { session_id: id })
}

/// Switches the running meeting's recognition model (for example when the speakers change language).
#[tauri::command]
pub fn session_set_language(state: State<AppState>, language: String) -> Result<(), String> {
    if !valid_language(&language) {
        return Err("invalid_language".into());
    }
    state.audio.set_language(&language)
}

/// Replaces the running meeting's recognition vocabulary.
#[tauri::command]
pub fn session_set_vocabulary(state: State<AppState>, terms: Vec<String>) -> Result<(), String> {
    state.audio.set_vocabulary(&clean_vocabulary(terms)?)
}

#[tauri::command]
pub fn session_stop(state: State<AppState>) -> Result<(), String> {
    *state.session_id.lock().map_err(|e| e.to_string())? = None;
    state.audio.stop()
}

/// Runs the sidecar in a one-shot mode and returns the JSON line whose `type` is `kind`.
fn probe_sidecar(flag: &str, kind: &str) -> Option<serde_json::Value> {
    let path = crate::audio_bridge::sidecar_path()?;
    let output = std::process::Command::new(path).arg(flag).output().ok()?;
    String::from_utf8_lossy(&output.stdout)
        .lines()
        .filter_map(|line| serde_json::from_str::<serde_json::Value>(line).ok())
        .find(|value| value.get("type").and_then(|t| t.as_str()) == Some(kind))
}

fn probe_field(value: &Option<serde_json::Value>, key: &str) -> String {
    value
        .as_ref()
        .and_then(|v| v.get(key))
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string()
}

/// The microphone state comes from macOS (via the sidecar, so the answer is for the app's own bundle).
#[tauri::command]
pub async fn permissions_status() -> PermissionsStatus {
    let probe =
        tauri::async_runtime::spawn_blocking(|| probe_sidecar("--permissions", "permissions"))
            .await
            .ok()
            .flatten();
    PermissionsStatus {
        microphone: probe_field(&probe, "microphone"),
        system_audio: "unknown".to_string(),
    }
}

/// Runs the sidecar's calendar mode (`status`, `request` or `events`) and returns its JSON line, or null.
/// The sidecar reads the calendar on this machine only and cuts attendees down to their domains.
#[tauri::command]
pub async fn calendar(mode: String) -> Option<serde_json::Value> {
    let flag = match mode.as_str() {
        "status" => "--calendar-status",
        "request" => "--calendar-request",
        "events" => "--calendar-events",
        _ => return None,
    };
    tauri::async_runtime::spawn_blocking(move || probe_sidecar(flag, "calendar"))
        .await
        .ok()
        .flatten()
}

/// Plays a short system sound and reports `granted`, `silent` (no permission or muted) or `error`.
#[tauri::command]
pub async fn check_system_audio() -> String {
    let probe = tauri::async_runtime::spawn_blocking(|| {
        probe_sidecar("--check-system-audio", "system-audio")
    })
    .await
    .ok()
    .flatten();
    probe_field(&probe, "state")
}

/// Which URLs the app may open outside itself: web pages and the macOS privacy panes it points people to.
fn is_openable(url: &str) -> bool {
    url.starts_with("https://")
        || url.starts_with("http://")
        || matches!(
            url,
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
                | "x-apple.systempreferences:com.apple.preference.security?Privacy_AudioCapture"
                | "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
                | "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars"
        )
}

/// Opens a web page or a privacy settings pane with the system handler.
#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    if !is_openable(&url) {
        return Err("url_not_allowed".into());
    }
    std::process::Command::new("/usr/bin/open")
        .arg(&url)
        .spawn()
        .map(|_| ())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_assist_level(state: State<AppState>, level: u8) -> Result<(), String> {
    if level > 5 {
        return Err("invalid_assist_level".into());
    }
    *state.assist_level.lock().map_err(|e| e.to_string())? = level;
    Ok(())
}

/// The overlay follows the meeting: it appears when a session starts and the client hides it when the session is over.
#[tauri::command]
pub fn hide_overlay(app: AppHandle) {
    windows::hide_overlay(&app);
}

/// The menu-bar icon follows the meeting. `minutes` is the elapsed whole minutes; `problem` is `mic` or `system`.
#[tauri::command]
pub fn tray_set_state(
    app: AppHandle,
    state: String,
    minutes: Option<u32>,
    problem: Option<String>,
) -> Result<(), String> {
    let kind = crate::tray::Kind::parse(&state).ok_or("invalid_tray_state")?;
    crate::tray::apply(&app, kind, minutes.unwrap_or(0), problem.as_deref())
}

#[tauri::command]
pub fn toggle_overlay(app: AppHandle) -> bool {
    windows::toggle_overlay(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_short_lowercase_codes_are_languages() {
        assert!(valid_language("en"));
        assert!(valid_language("ja"));
        assert!(!valid_language(""));
        assert!(!valid_language("EN"));
        assert!(!valid_language("en; rm"));
        assert!(!valid_language("english"));
    }

    #[test]
    fn vocabulary_is_trimmed_and_empties_dropped() {
        let out = clean_vocabulary(vec!["  foo ".into(), "".into(), "   ".into(), "bar".into()]);
        assert_eq!(out.unwrap(), vec!["foo", "bar"]);
    }

    #[test]
    fn vocabulary_drops_bad_entries_instead_of_failing() {
        let out = clean_vocabulary(vec!["a\tb".into(), "valid".into()]).unwrap();
        assert_eq!(out, vec!["valid"]);
        for bad in ["secret\nterm", "secret\u{0}term", "secret\rterm", "x\ny"] {
            assert!(clean_vocabulary(vec![bad.into()]).unwrap().is_empty());
        }
        let out = clean_vocabulary(vec!["s".repeat(121), "ok".into(), "s".repeat(120)]).unwrap();
        assert_eq!(out.len(), 2);
        assert_eq!(out[0], "ok");
    }

    #[test]
    fn vocabulary_size_limits() {
        let too_many: Vec<String> = (0..201).map(|i| format!("secret{i}")).collect();
        let err = clean_vocabulary(too_many).unwrap_err();
        assert_eq!(err, "vocabulary_too_large");
        assert!(!err.contains("secret"));

        assert!(clean_vocabulary(vec![String::new(); 201]).is_err());
        let mut raw = vec![String::new(); 200];
        raw.push("valid".into());
        assert_eq!(clean_vocabulary(raw).unwrap_err(), "vocabulary_too_large");

        let max: Vec<String> = (0..200).map(|i| format!("{i:0>120}")).collect();
        assert_eq!(clean_vocabulary(max).unwrap().len(), 200);
    }

    #[test]
    fn only_web_pages_and_privacy_panes_open() {
        assert!(is_openable("https://cuelingo.app/sessions/1"));
        assert!(is_openable(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"
        ));
        assert!(is_openable(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars"
        ));
        assert!(!is_openable("file:///etc/passwd"));
        assert!(!is_openable(
            "x-apple.systempreferences:com.apple.preference.general"
        ));
        assert!(!is_openable("javascript:alert(1)"));
    }

    #[test]
    fn probe_field_defaults_to_unknown() {
        assert_eq!(probe_field(&None, "microphone"), "unknown");
        let value = Some(serde_json::json!({ "microphone": "granted" }));
        assert_eq!(probe_field(&value, "microphone"), "granted");
        assert_eq!(probe_field(&value, "state"), "unknown");
    }
}
