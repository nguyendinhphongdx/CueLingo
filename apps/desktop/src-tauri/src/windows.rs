//! Overlay and main-window helpers.
use tauri::{AppHandle, Manager};

const OVERLAY: &str = "overlay";

/// Overlay never appears in screen shares or recordings (NSWindow sharingType = none).
pub fn prepare_overlay(app: &AppHandle) -> tauri::Result<()> {
    if let Some(overlay) = app.get_webview_window(OVERLAY) {
        overlay.set_content_protected(true)?;
        overlay.set_ignore_cursor_events(false)?;
        overlay.center()?;
    }
    Ok(())
}

/// Returns whether the overlay is visible after the toggle.
pub fn toggle_overlay(app: &AppHandle) -> bool {
    let Some(overlay) = app.get_webview_window(OVERLAY) else {
        return false;
    };
    if overlay.is_visible().unwrap_or(false) {
        let _ = overlay.hide();
        false
    } else {
        let _ = overlay.show();
        true
    }
}

pub fn show_main(app: &AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.set_focus();
    }
}
