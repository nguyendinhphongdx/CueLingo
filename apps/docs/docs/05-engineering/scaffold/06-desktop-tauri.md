---
title: Desktop (Tauri)
---

# Scaffold · Desktop (`apps/desktop`, Vite + React + Tauri 2)

**Kết quả:** `pnpm --filter @cuelingo/desktop tauri dev` mở app macOS gồm cửa sổ chính (onboarding/cài đặt), **cửa sổ overlay** trong suốt, luôn nổi, không bị quay khi chia sẻ màn hình, icon menu bar và phím tắt ⌘⇧L. UI React dùng `@cuelingo/ui` và `core-sdk`; Rust core có các command đầu tiên. Chưa có audio thật ([Native Swift](./07-native-swift.md) làm sau).

Quyết định: [ADR-0002](../../08-adr/0002-desktop-tauri-swift.md), [ADR-0007](../../08-adr/0007-ui-stack.md). Thiết kế: [desktop](../../04-modules/01-desktop/README.md), [tauri-core](../../04-modules/01-desktop/tauri-core.md).

## Điều kiện trước

- Rust ≥ 1.90 (Tauri 2.12+; repo ghim `stable` trong `src-tauri/rust-toolchain.toml`, chạy `rustup update stable`), Xcode Command Line Tools; [UI package](./05-ui-package.md) xong.
- Kiểm tra: `cargo --version`, `xcode-select -p`.

## 1. Vite + React trong `apps/desktop`

`apps/desktop/src/*` đã có các module khung, nên **không** chạy `create-tauri-app` (nó tạo dự án mới). Cài tay:

```bash
pnpm --filter @cuelingo/desktop add react react-dom @tanstack/react-query zustand @tauri-apps/api
pnpm --filter @cuelingo/desktop add -D vite @vitejs/plugin-react @tailwindcss/vite tailwindcss @tauri-apps/cli@^2
```

`vite.config.ts`: plugin `react()` + `tailwindcss()`; `server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**'] } }`.
`index.html` (cửa sổ chính) và `overlay.html` (cửa sổ overlay) là hai entry của Vite (`build.rollupOptions.input`). Script: `"dev": "vite"`, `"build": "vite build"`, `"tauri": "tauri"`.

## 2. Tauri

```bash
cd apps/desktop && pnpm tauri init
```

| Câu hỏi                | Trả lời                 |
| ---------------------- | ----------------------- |
| App name               | `CueLingo`              |
| Window title           | `CueLingo`              |
| Web assets location    | `../dist`               |
| Dev server URL         | `http://localhost:1420` |
| Frontend dev command   | `pnpm dev`              |
| Frontend build command | `pnpm build`            |

`init` tạo `src-tauri/` (`Cargo.toml`, `tauri.conf.json`, `src/main.rs`, `src/lib.rs`, `capabilities/`, `icons/`). Gộp nội dung stub cũ của `src-tauri/src/lib.rs` (comment trách nhiệm) vào file mới. Plugin phím tắt: `pnpm tauri add global-shortcut`.

## 3. Cửa sổ trong `tauri.conf.json`

| Cửa sổ    | Thuộc tính chính                                                                                                                                                                |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `main`    | `url: "index.html"`, kích thước thường, ẩn khi đóng (app sống ở menu bar)                                                                                                       |
| `overlay` | `url: "overlay.html"`, `transparent: true`, `decorations: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `contentProtected: true` (không bị quay màn hình), `visible: false` |

Cửa sổ trong suốt trên macOS cần bật `app.macOSPrivateApi`. Đối chiếu tên thuộc tính với schema `tauri.conf.json` của bản đã cài (editor có gợi ý theo `$schema`).

## 4. Rust core — command và event

```text
src-tauri/src/
├── lib.rs           run(): đăng ký plugin, command, menu bar, phím tắt
├── commands.rs      #[tauri::command] session_start, session_stop, permissions_status, set_assist_level
├── windows.rs       hiện/ẩn overlay, vị trí mặc định
└── hotkeys.rs       ⌘⇧L bật/tắt phiên, ⌘⇧W recap, ⌘⇧S nói giúp
```

Mỗi command/event thêm vào bảng trong [tauri-core](../../04-modules/01-desktop/tauri-core.md). Payload là JSON có schema Zod phía TS.

## 5. Phía TypeScript — `src/lib/native.ts`

Lớp duy nhất gọi Tauri. Bọc `invoke` (`@tauri-apps/api/core`) và `listen` (`@tauri-apps/api/event`) thành hàm có kiểu, **parse kết quả bằng Zod**:

```ts
export const native = {
  sessionStart: (opts: SessionStartInput) =>
    invoke('session_start', { opts }).then(SessionStartResult.parse),
  onTranscript: (cb: (e: TranscriptEvent) => void) =>
    listen('transcript', (e) => cb(TranscriptEvent.parse(e.payload))),
};
```

Module UI (`session`, `overlay`…) chỉ dùng `native` và `client`; không gọi `invoke` trực tiếp.

## Definition of Done

- [ ] `pnpm --filter @cuelingo/desktop tauri dev`: cửa sổ chính mở; ⌘⇧L hiện/ẩn overlay; overlay hiển thị một CaptionLine giả từ `@cuelingo/ui`.
- [ ] Bật chia sẻ màn hình (Zoom/Meet thử): overlay **không** xuất hiện trong bản chia sẻ.
- [ ] `pnpm verify` xanh; `cargo fmt --check` và `cargo clippy -- -D warnings` sạch trong `src-tauri`.
- [ ] `pnpm --filter @cuelingo/desktop tauri build` tạo được `.app` (chưa cần ký).
- [ ] Docs: bảng command/event trong tauri-core; [Tổ chức thư mục](../../03-architecture/03-folder-structure.md).

## Anti-pattern

- ❌ `invoke('…')` rải rác trong component.
- ❌ Logic sản phẩm (dịch, Learner Model) trong Rust.
- ❌ Overlay có viền/cửa sổ hệ thống hoặc lọt vào bản chia sẻ màn hình.

## Giới hạn đã gặp (2026-11-01)

- Agent trong sandbox không ghi được `~/.cargo`: `cargo fetch/build/clippy` và `tauri dev/build` chạy ngoài sandbox.
- Codex chỉ viết UI React (không có mạng, không chạy cargo); Rust và `native.ts` do lead giữ.
- Hai webview (main, overlay) không chung store: đồng bộ Assist level là việc còn mở.
