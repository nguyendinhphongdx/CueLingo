//! Menu-bar icon: shows whether CueLingo is listening, without opening a window.
//! Design: apps/docs/docs/04-modules/01-desktop/tauri-core.md
//!
//! Live is decided here, not by the webview: a native session that still runs is live whatever the
//! webview says (it may have reloaded, crashed or ended its meeting in an error state). The webview
//! adds what only it knows: the cloud drain after Stop, the elapsed minutes, a failed stream.
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::image::Image;
use tauri::menu::MenuItem;
use tauri::{AppHandle, Manager, Wry};

use crate::commands::AppState;

pub const TRAY_ID: &str = "main";
/// How long "Dừng họp và thoát" waits for the meeting to wrap up before it leaves anyway.
const QUIT_GRACE: Duration = Duration::from_secs(20);

/// The items whose text and enabled state follow the meeting.
pub struct TrayMenu {
    pub stop: MenuItem<Wry>,
    pub quit: MenuItem<Wry>,
}

/// What the webview last reported.
#[derive(Default, Clone, Debug, PartialEq)]
pub struct Report {
    /// A meeting is still running on its side (also while the last sentences are being sent).
    pub active: bool,
    pub minutes: u32,
    /// `mic` or `system`; anything else counts as an unnamed capture problem.
    pub problem: Option<String>,
}

#[derive(Default)]
pub struct TrayReport(pub Mutex<Report>);

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Kind {
    Idle,
    Live,
    Warning,
}

/// Idle only when neither the native session nor the webview has a meeting.
pub fn kind_for(native_running: bool, report: &Report) -> Kind {
    if !native_running && !report.active {
        Kind::Idle
    } else if report.problem.is_some() {
        Kind::Warning
    } else {
        Kind::Live
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

/// Elapsed time as h:mm, whole minutes, so the menu bar does not flicker every second. Only the
/// webview knows the start of the meeting, so there is no time when it is not reporting one.
pub fn title(kind: Kind, report: &Report) -> String {
    if kind == Kind::Idle || !report.active {
        return String::new();
    }
    format!(" {}:{:02}", report.minutes / 60, report.minutes % 60)
}

/// (text of "Dừng họp" enabled, text of the quit item).
pub fn menu_for(kind: Kind) -> (bool, &'static str) {
    match kind {
        Kind::Idle => (false, "Thoát"),
        _ => (true, "Dừng họp và thoát"),
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

fn native_running(app: &AppHandle) -> bool {
    app.try_state::<AppState>()
        .map(|state| state.is_running())
        .unwrap_or(false)
}

fn report_of(app: &AppHandle) -> Report {
    app.try_state::<TrayReport>()
        .and_then(|report| report.0.lock().ok().map(|r| r.clone()))
        .unwrap_or_default()
}

/// A meeting exists as far as the menu bar is concerned.
pub fn is_live(app: &AppHandle) -> bool {
    kind_for(native_running(app), &report_of(app)) != Kind::Idle
}

/// Redraws the icon and menu from the native session and the last webview report.
pub fn refresh(app: &AppHandle) -> Result<(), String> {
    let report = report_of(app);
    let kind = kind_for(native_running(app), &report);
    let tray = app.tray_by_id(TRAY_ID).ok_or("tray_missing")?;
    let err = |e: tauri::Error| e.to_string();
    tray.set_icon(Some(icon(kind))).map_err(err)?;
    // Only the idle glyph is a template (it follows the menu bar's light/dark); the coloured ones keep their colour.
    tray.set_icon_as_template(kind == Kind::Idle).map_err(err)?;
    let text = title(kind, &report);
    tray.set_title(if text.is_empty() { None } else { Some(text) })
        .map_err(err)?;
    tray.set_tooltip(Some(tooltip(kind, report.problem.as_deref())))
        .map_err(err)?;
    if let Some(menu) = app.try_state::<TrayMenu>() {
        let (stop_enabled, quit_text) = menu_for(kind);
        menu.stop.set_enabled(stop_enabled).map_err(err)?;
        menu.quit.set_text(quit_text).map_err(err)?;
    }
    Ok(())
}

/// Stores what the webview reports, then redraws.
pub fn report(app: &AppHandle, next: Report) -> Result<(), String> {
    if let Some(slot) = app.try_state::<TrayReport>() {
        *slot.0.lock().map_err(|e| e.to_string())? = next;
    }
    refresh(app)
}

/// "Thoát": leaves at once when idle; during a meeting asks the webview to stop it and leaves once
/// it is over, or after a grace period so a dead webview never keeps the app from quitting.
pub fn quit(app: &AppHandle) {
    use tauri::Emitter;
    if !is_live(app) {
        app.exit(0);
        return;
    }
    let _ = app.emit_to("main", "tray-stop", ());
    let app = app.clone();
    std::thread::spawn(move || {
        let started = Instant::now();
        while is_live(&app) && started.elapsed() < QUIT_GRACE {
            std::thread::sleep(Duration::from_millis(200));
        }
        app.exit(0);
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn report(active: bool, minutes: u32, problem: Option<&str>) -> Report {
        Report {
            active,
            minutes,
            problem: problem.map(String::from),
        }
    }

    #[test]
    fn a_running_native_session_is_live_whatever_the_webview_says() {
        // The webview reloaded (idle) or ended in an error state: capture still runs.
        assert_eq!(kind_for(true, &report(false, 0, None)), Kind::Live);
        assert_eq!(
            kind_for(true, &report(false, 0, Some("mic"))),
            Kind::Warning
        );
    }

    #[test]
    fn the_cloud_drain_stays_live_after_the_native_session_ended() {
        assert_eq!(kind_for(false, &report(true, 5, None)), Kind::Live);
        assert_eq!(kind_for(false, &report(false, 0, None)), Kind::Idle);
        assert_eq!(kind_for(false, &report(false, 0, Some("mic"))), Kind::Idle);
    }

    #[test]
    fn idle_has_no_title_and_live_shows_whole_minutes() {
        assert_eq!(title(Kind::Idle, &report(true, 90, None)), "");
        assert_eq!(title(Kind::Live, &report(true, 0, None)), " 0:00");
        assert_eq!(title(Kind::Live, &report(true, 75, None)), " 1:15");
        // No webview report of a meeting, so no made-up time.
        assert_eq!(title(Kind::Live, &report(false, 0, None)), "");
    }

    #[test]
    fn stop_is_enabled_and_quit_waits_for_the_meeting_only_while_live() {
        assert_eq!(menu_for(Kind::Idle), (false, "Thoát"));
        assert_eq!(menu_for(Kind::Live), (true, "Dừng họp và thoát"));
        assert_eq!(menu_for(Kind::Warning), (true, "Dừng họp và thoát"));
    }

    #[test]
    fn warning_names_the_failed_stream_with_fixed_text() {
        assert!(tooltip(Kind::Warning, Some("mic")).contains("micro"));
        assert!(tooltip(Kind::Warning, Some("system")).contains("hệ thống"));
        assert_eq!(
            tooltip(Kind::Warning, Some("evil text")),
            tooltip(Kind::Warning, None)
        );
    }

    #[test]
    fn the_tray_icons_decode() {
        for kind in [Kind::Idle, Kind::Live, Kind::Warning] {
            assert_eq!(icon(kind).width(), 44);
        }
    }
}
