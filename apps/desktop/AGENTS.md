# AGENTS.md — apps/desktop

Tauri 2 + React + Swift (macOS). Thiết kế: [apps/docs/docs/04-modules/01-desktop](../docs/docs/04-modules/01-desktop/README.md), luồng [realtime](../docs/docs/03-architecture/04-realtime-pipeline.md).

| Thư mục                 | Ngôn ngữ   | Convention                                                                                                                                                                            | Agent             |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| `src/`                  | React/TS   | [web-feature](../docs/docs/05-engineering/conventions/web-feature.md)                                                                                                                 | `ts-engineer`     |
| `src-tauri/`            | Rust       | [native-desktop](../docs/docs/05-engineering/conventions/native-desktop.md)                                                                                                           | `native-engineer` |
| `native/macos-audio/`   | Swift      | [native-desktop](../docs/docs/05-engineering/conventions/native-desktop.md)                                                                                                           | `native-engineer` |
| `native/windows-audio/` | Rust       | [native-desktop](../docs/docs/05-engineering/conventions/native-desktop.md); cùng giao thức dòng JSON với sidecar Swift ([ADR 0020](../docs/docs/08-adr/0020-windows-capture-stt.md)) | `native-engineer` |
| `installer/windows/`    | Inno Setup | Bản cài Windows `CueLingo.iss` + `Vietnamese.isl` (bản 6.7.1 gốc, thêm BOM), dựng bằng `scripts/windows-installer.mjs` ([ADR 0021](../docs/docs/08-adr/0021-windows-release-inno.md)) | `native-engineer` |

- Chưa scaffold Tauri; tham khảo [anarlog](https://github.com/fastrepl/anarlog) (ADR-0002).
- Ranh giới native ↔ webview là bảng command/event trong [tauri-core](../docs/docs/04-modules/01-desktop/tauri-core.md).
- Mọi thay đổi audio/STT/overlay phải thử thật với một cuộc gọi Zoom/Meet.
- **Scaffold:** [desktop-tauri](../../apps/docs/docs/05-engineering/scaffold/06-desktop-tauri.md) · [native-swift](../../apps/docs/docs/05-engineering/scaffold/07-native-swift.md) (bắt đầu bằng spike).
