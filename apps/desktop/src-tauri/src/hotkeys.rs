//! Global shortcuts: ⌘⇧L overlay, ⌘⇧W recap, ⌘⇧S say-for-me.
use serde::Serialize;
use tauri::plugin::TauriPlugin;
use tauri::{AppHandle, Emitter, Wry};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

use crate::windows;

#[derive(Serialize, Clone)]
struct HotkeyPayload {
    action: &'static str,
}

fn mods() -> Modifiers {
    Modifiers::SUPER | Modifiers::SHIFT
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
