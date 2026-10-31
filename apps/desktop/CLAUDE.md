# CLAUDE.md — apps/desktop

Tauri 2 + React + Swift (macOS). Thiết kế: [apps/docs/docs/04-modules/01-desktop](../docs/docs/04-modules/01-desktop/README.md), luồng [realtime](../docs/docs/03-architecture/01-realtime-pipeline.md).

| Thư mục               | Ngôn ngữ | Convention                                                                  | Agent             |
| --------------------- | -------- | --------------------------------------------------------------------------- | ----------------- |
| `src/`                | React/TS | [web-feature](../docs/docs/05-engineering/conventions/web-feature.md)       | `ts-engineer`     |
| `src-tauri/`          | Rust     | [native-desktop](../docs/docs/05-engineering/conventions/native-desktop.md) | `native-engineer` |
| `native/macos-audio/` | Swift    | [native-desktop](../docs/docs/05-engineering/conventions/native-desktop.md) | `native-engineer` |

- Chưa scaffold Tauri; tham khảo [anarlog](https://github.com/fastrepl/anarlog) (ADR-0002).
- Ranh giới native ↔ webview là bảng command/event trong [tauri-core](../docs/docs/04-modules/01-desktop/tauri-core.md).
- Mọi thay đổi audio/STT/overlay phải thử thật với một cuộc gọi Zoom/Meet.
