//! Global shortcuts: ⌘⇧L overlay, ⌘⇧W recap, ⌘⇧S say-for-me (Ctrl+Shift on Windows).
use serde::Serialize;
use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Emitter, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::windows;

#[derive(Serialize, Clone)]
struct HotkeyPayload {
    action: &'static str,
}

/// ⌘ on macOS. On Windows the Win key is taken (Win+Shift+S is the Snipping Tool), so Ctrl.
fn mods() -> Modifiers {
    if cfg!(windows) {
        Modifiers::CONTROL | Modifiers::SHIFT
    } else {
        Modifiers::SUPER | Modifiers::SHIFT
    }
}

/// Tray menu text with the overlay shortcut as the person types it on this system.
pub fn overlay_menu_label() -> &'static str {
    if cfg!(windows) {
        "Hiện/ẩn overlay (Ctrl+Shift+L)"
    } else {
        "Hiện/ẩn overlay (⌘⇧L)"
    }
}

fn action_for(shortcut: &Shortcut) -> Option<&'static str> {
    [
        (Code::KeyL, "toggle_overlay"),
        (Code::KeyW, "recap"),
        (Code::KeyS, "say_for_me"),
    ]
    .into_iter()
    .find(|(code, _)| shortcut.matches(mods(), *code))
    .map(|(_, action)| action)
}

pub fn plugin() -> TauriPlugin<Wry> {
    tauri_plugin_global_shortcut::Builder::new()
        .with_handler(|app, shortcut, event| {
            if event.state() != ShortcutState::Pressed {
                return;
            }
            let Some(action) = action_for(shortcut) else {
                return;
            };
            if action == "toggle_overlay" {
                windows::toggle_overlay(app);
            }
            let _ = app.emit("hotkey", HotkeyPayload { action });
        })
        .build()
}

pub fn register(app: &AppHandle) -> tauri::Result<()> {
    for code in [Code::KeyL, Code::KeyW, Code::KeyS] {
        app.global_shortcut()
            .register(Shortcut::new(Some(mods()), code))
            .map_err(|e| tauri::Error::Anyhow(e.into()))?;
    }
    Ok(())
}
