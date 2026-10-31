# Tauri core

> Phần: [Desktop app](README.md) · Code: `apps/desktop/src-tauri/src/`

Lớp Rust của app: cửa sổ, phím tắt toàn cục, cầu nối native ↔ webview, bảo mật token, cập nhật.

## Trách nhiệm

- Quản lý cửa sổ: overlay luôn nổi, không hiện khi chia sẻ màn hình (NSWindow sharingType = none), menu bar
- Phím tắt toàn cục: ⌘⇧L (bắt đầu/dừng), ⌘⇧W (recap), ⌘⇧S (nói giúp tôi)
- Nhận sự kiện từ `audio-capture`/`local-stt` và đẩy sang webview qua Tauri events
- Lưu token trong Keychain
- Auto-update, ký và notarize

## Phạm vi MVP

- Toàn bộ

## Interface

- Tauri commands: `session_start`, `session_stop`, `permissions_status`, `set_assist_level`
- Tauri events: `transcript`, `speech`, `hotkey`

## Phụ thuộc

- Tauri 2, plugins global-shortcut, updater

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- (chưa có)
