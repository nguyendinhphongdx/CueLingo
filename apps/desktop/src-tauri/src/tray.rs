//! Menu-bar icon: shows whether CueLingo is listening, without opening a window.
//! Design: apps/docs/docs/04-modules/01-desktop/tauri-core.md
use tauri::image::Image;
use tauri::menu::MenuItem;
use tauri::{AppHandle, Manager, Wry};

pub const TRAY_ID: &str = "main";

/// The items whose enabled state follows the meeting.
pub struct TrayMenu {
    pub stop: MenuItem<Wry>,
    pub quit: MenuItem<Wry>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Kind {
    Idle,
    Live,
    Warning,
}

impl Kind {
    pub fn parse(value: &str) -> Option<Kind> {
        match value {
            "idle" => Some(Kind::Idle),
            "live" => Some(Kind::Live),
            "warning" => Some(Kind::Warning),
            _ => None,
        }
    }
}

/// Fixed texts only: nothing from the meeting (text, title, names) reaches the menu bar.
pub fn tooltip(kind: Kind, problem: Option<&str>) -> &'static str {
    match (kind, problem) {
        (Kind::Idle, _) => "CueLingo",
        (Kind::Live, _) => "CueLingo · đang nghe",
        (Kind::Warning, Some("mic")) => "CueLingo · micro không mở được",
        (Kind::Warning, Some("system")) => "CueLingo · âm thanh hệ thống không mở được",
        (Kind::Warning, _) => "CueLingo · thu âm gặp sự cố",
    }
}

/// Elapsed time as h:mm, whole minutes, so the menu bar does not flicker every second.
pub fn title(kind: Kind, minutes: u32) -> String {
    match kind {
        Kind::Idle => String::new(),
        _ => format!(" {}:{:02}", minutes / 60, minutes % 60),
    }
}

fn icon(kind: Kind) -> Image<'static> {
    let bytes: &[u8] = match kind {
        Kind::Idle => include_bytes!("../icons/tray/idle.png"),
        Kind::Live => include_bytes!("../icons/tray/live.png"),
        Kind::Warning => include_bytes!("../icons/tray/warning.png"),
    };
    Image::from_bytes(bytes).expect("tray icon is a valid png")
}

pub fn apply(app: &AppHandle, kind: Kind, minutes: u32, problem: Option<&str>) -> Result<(), String> {
    let tray = app.tray_by_id(TRAY_ID).ok_or("tray_missing")?;
    let err = |e: tauri::Error| e.to_string();
    tray.set_icon(Some(icon(kind))).map_err(err)?;
    // Only the idle glyph is a template (it follows the menu bar's light/dark); the coloured ones keep their colour.
    tray.set_icon_as_template(kind == Kind::Idle).map_err(err)?;
    let text = title(kind, minutes);
    tray.set_title(if text.is_empty() { None } else { Some(text) })
        .map_err(err)?;
    tray.set_tooltip(Some(tooltip(kind, problem))).map_err(err)?;
    if let Some(menu) = app.try_state::<TrayMenu>() {
        // Quit stays off while a meeting runs, so its last sentences are never lost.
        menu.stop.set_enabled(kind != Kind::Idle).map_err(err)?;
        menu.quit.set_enabled(kind == Kind::Idle).map_err(err)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_only_known_states() {
        assert_eq!(Kind::parse("live"), Some(Kind::Live));
        assert_eq!(Kind::parse("idle"), Some(Kind::Idle));
        assert_eq!(Kind::parse("warning"), Some(Kind::Warning));
        assert_eq!(Kind::parse("<script>"), None);
    }

    #[test]
    fn idle_has_no_title_and_live_shows_whole_minutes() {
        assert_eq!(title(Kind::Idle, 90), "");
        assert_eq!(title(Kind::Live, 0), " 0:00");
        assert_eq!(title(Kind::Live, 75), " 1:15");
    }

    #[test]
    fn warning_names_the_failed_stream_with_fixed_text() {
        assert!(tooltip(Kind::Warning, Some("mic")).contains("micro"));
        assert!(tooltip(Kind::Warning, Some("system")).contains("hệ thống"));
        assert_eq!(tooltip(Kind::Warning, Some("evil text")), tooltip(Kind::Warning, None));
    }
}
