---
title: Dựng bản app desktop
sidebar_position: 10
---

# Dựng bản app desktop

App desktop gồm hai phần: app Tauri (Rust + giao diện web) và **sidecar âm thanh** `cuelingo-audio` viết bằng Swift (thu âm hệ thống, nhận dạng giọng nói trên máy). Sidecar được đóng **vào bên trong** `CueLingo.app`, nên bản cài không cần biến môi trường hay file nào khác.

## Lệnh

| Việc                           | Lệnh                                                                |
| ------------------------------ | ------------------------------------------------------------------- |
| Dựng sidecar (chỉ khi chưa có) | `pnpm --filter @cuelingo/desktop sidecar`                           |
| Dựng lại sidecar từ đầu        | `pnpm --filter @cuelingo/desktop sidecar:rebuild`                   |
| Chạy khi phát triển            | `pnpm --filter @cuelingo/desktop tauri dev`                         |
| Dựng `.app` để thử             | `pnpm --filter @cuelingo/desktop tauri build --debug --bundles app` |

`tauri dev` và `tauri build` tự gọi `scripts/sidecar.mjs` trước: nếu chưa có `src-tauri/binaries/cuelingo-audio-<target>` thì nó chạy `swift build -c release` (khoảng 2 đến 3 phút lần đầu) rồi chép file vào đó. Thư mục `binaries/` không được commit.

## Sidecar nằm ở đâu

- Trong bundle: `CueLingo.app/Contents/MacOS/cuelingo-audio` (Tauri `bundle.externalBin`).
- `audio_bridge.rs` tìm theo thứ tự: biến `CUELINGO_AUDIO_BIN` (để thử bản khác), file cạnh app, bản debug của Swift.
- macOS gán quyền micro và âm thanh hệ thống cho **app** (tiến trình mẹ), nên hộp thoại xin quyền hiện là của CueLingo.

## CI

Job `desktop` chỉ biên dịch Rust, nên chạy `node scripts/sidecar.mjs --placeholder` để tạo file giả cho Tauri kiểm tra tồn tại. Dựng sidecar thật chỉ làm khi phát hành.

## Chưa có

Ký số, notarize và tự cập nhật (P2-09): cần tài khoản Apple Developer. Bản dựng hiện tại ký tạm (ad-hoc), nên mỗi lần dựng lại macOS có thể hỏi lại quyền.
