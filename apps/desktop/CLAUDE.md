# CLAUDE.md — apps/desktop

Tauri 2 + React + Swift (macOS). Thiết kế: [docs/03-parts/desktop](../../docs/03-parts/desktop/README.md), luồng [realtime](../../docs/02-architecture/realtime-pipeline.md).

| Thư mục               | Ngôn ngữ | Convention                                                                | Agent             |
| --------------------- | -------- | ------------------------------------------------------------------------- | ----------------- |
| `src/`                | React/TS | [web-feature](../../docs/05-engineering/conventions/web-feature.md)       | `ts-engineer`     |
| `src-tauri/`          | Rust     | [native-desktop](../../docs/05-engineering/conventions/native-desktop.md) | `native-engineer` |
| `native/macos-audio/` | Swift    | [native-desktop](../../docs/05-engineering/conventions/native-desktop.md) | `native-engineer` |

- Chưa scaffold Tauri; tham khảo [anarlog](https://github.com/fastrepl/anarlog) (ADR-0002).
- Ranh giới native ↔ webview là bảng command/event trong [tauri-core](../../docs/03-parts/desktop/tauri-core.md).
- Mọi thay đổi audio/STT/overlay phải thử thật với một cuộc gọi Zoom/Meet.
