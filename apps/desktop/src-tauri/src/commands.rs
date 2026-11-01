//! Tauri commands. The table lives in apps/docs/docs/04-modules/01-desktop/tauri-core.md.
//! Audio/STT arrive in the realtime phase; until then session commands only track state.
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::windows;

#[derive(Default)]
pub struct AppState {
    session_id: Mutex<Option<String>>,
    assist_level: Mutex<u8>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStartOpts {
    assist_level: u8,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionStartResult {
    session_id: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionsStatus {
    microphone: &'static str,
    screen_capture: &'static str,
}

#[tauri::command]
pub fn session_start(
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
    *current = Some(id.clone());
    Ok(SessionStartResult { session_id: id })
}

#[tauri::command]
pub fn session_stop(state: State<AppState>) -> Result<(), String> {
    *state.session_id.lock().map_err(|e| e.to_string())? = None;
    Ok(())
}

/// Real checks (TCC) arrive with the native audio package.
#[tauri::command]
pub fn permissions_status() -> PermissionsStatus {
    PermissionsStatus {
        microphone: "unknown",
        screen_capture: "unknown",
    }
}

#[tauri::command]
pub fn set_assist_level(state: State<AppState>, level: u8) -> Result<(), String> {
    if level > 5 {
        return Err("invalid_assist_level".into());
    }
    *state.assist_level.lock().map_err(|e| e.to_string())? = level;
    Ok(())
}

#[tauri::command]
pub fn toggle_overlay(app: AppHandle) -> bool {
    windows::toggle_overlay(&app)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn permissions_are_unknown_until_native_audio_lands() {
        let status = permissions_status();
        assert_eq!(status.microphone, "unknown");
        assert_eq!(status.screen_capture, "unknown");
    }
}
