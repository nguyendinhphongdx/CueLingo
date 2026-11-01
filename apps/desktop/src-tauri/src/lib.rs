//! Tauri core — windows, global shortcuts, native ↔ webview bridge.
//! Design: apps/docs/docs/04-modules/01-desktop/tauri-core.md
mod commands;
mod hotkeys;
mod windows;

use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::WindowEvent;

pub fn run() {
    tauri::Builder::default()
        .plugin(hotkeys::plugin())
        .manage(commands::AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::session_start,
            commands::session_stop,
            commands::permissions_status,
            commands::set_assist_level,
            commands::toggle_overlay,
        ])
        .setup(|app| {
            hotkeys::register(app.handle())?;
            windows::prepare_overlay(app.handle())?;

            let show = MenuItemBuilder::with_id("show", "Mở CueLingo").build(app)?;
            let overlay = MenuItemBuilder::with_id("overlay", "Hiện/ẩn overlay").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Thoát").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show, &overlay, &quit])
                .build()?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("window icon"))
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => windows::show_main(app),
                    "overlay" => {
                        windows::toggle_overlay(app);
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // The app lives in the menu bar: closing the main window only hides it.
            if window.label() == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running CueLingo");
}
