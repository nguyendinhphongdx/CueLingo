//! Tauri core — windows, global shortcuts, native ↔ webview bridge.
//! Design: apps/docs/docs/04-modules/01-desktop/tauri-core.md
mod audio_bridge;
mod auth;
mod commands;
mod hotkeys;
mod tray;
mod windows;

use tauri::image::Image;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager, WindowEvent};
use tauri_plugin_deep_link::DeepLinkExt;

pub fn run() {
    tauri::Builder::default()
        .plugin(hotkeys::plugin())
        .plugin(tauri_plugin_deep_link::init())
        .manage(commands::AppState::default())
        .manage(tray::TrayReport::default())
        .invoke_handler(tauri::generate_handler![
            commands::session_start,
            commands::session_set_language,
            commands::session_set_vocabulary,
            commands::calendar,
            commands::session_stop,
            commands::permissions_status,
            commands::check_system_audio,
            commands::open_external,
            commands::set_assist_level,
            commands::toggle_overlay,
            commands::hide_overlay,
            commands::tray_report,
            auth::auth_token_get,
            auth::auth_token_set,
            auth::auth_token_clear,
        ])
        .setup(|app| {
            hotkeys::register(app.handle())?;

            // Sign-in links: while running, and when a link is what launched the app.
            let handle = app.handle().clone();
            app.deep_link().on_open_url(move |event| {
                for url in event.urls() {
                    auth::handle_url(&handle, url.as_str());
                }
            });
            if let Ok(Some(urls)) = app.deep_link().get_current() {
                for url in urls {
                    auth::handle_url(app.handle(), url.as_str());
                }
            }
            windows::prepare_overlay(app.handle())?;

            let show = MenuItemBuilder::with_id("show", "Mở CueLingo").build(app)?;
            let stop = MenuItemBuilder::with_id("stop", "Dừng họp")
                .enabled(false)
                .build(app)?;
            let overlay =
                MenuItemBuilder::with_id("overlay", "Hiện/ẩn overlay (⌘⇧L)").build(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Thoát").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show, &stop, &overlay, &quit])
                .build()?;
            app.manage(tray::TrayMenu {
                stop: stop.clone(),
                quit: quit.clone(),
            });
            TrayIconBuilder::with_id(tray::TRAY_ID)
                .icon(Image::from_bytes(include_bytes!("../icons/tray/idle.png"))?)
                .icon_as_template(true)
                .tooltip("CueLingo")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => windows::show_main(app),
                    // The webview owns the meeting: it stops it exactly like the Stop button.
                    "stop" => {
                        let _ = app.emit_to("main", "tray-stop", ());
                    }
                    "overlay" => {
                        windows::toggle_overlay(app);
                    }
                    "quit" => tray::quit(app),
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
