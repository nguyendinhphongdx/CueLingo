---
title: Brief B3 · Desktop UI
---

# Brief — foundation · B3 Desktop UI (React)

> Giao cho: Codex · Nhánh: `feat/foundation-desktop-codex` (tách từ `feat/foundation`) · Worktree: `.worktrees/foundation-desktop-codex`
> Quy tắc phối hợp: `apps/docs/docs/05-engineering/agent-collaboration.md`

## Mục tiêu

Lead đã dựng khung Tauri 2 (Rust core, cửa sổ `main` + `overlay`, phím tắt, tray) và cầu nối `apps/desktop/src/lib/native.ts`. Việc của bạn là **toàn bộ UI React** của hai cửa sổ:

- **`main`** (`index.html` → `src/main.tsx`): onboarding quyền + cài đặt Assist level + nút bắt đầu/dừng phiên.
- **`overlay`** (`overlay.html` → `src/overlay-main.tsx`): cửa sổ trong suốt hiện caption song ngữ bằng `CaptionLine` của `@cuelingo/ui`.

Chưa có audio/STT thật: overlay hiện **dữ liệu mẫu** cho tới khi nhận sự kiện `transcript` đầu tiên.

## AC phải đạt

| #   | AC (EARS)                                                                                                                                                                                                                                            | Test                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| AC1 | WHEN overlay chưa nhận sự kiện `transcript` nào THE SYSTEM SHALL hiện 3 dòng mẫu (một dòng `partial`) dùng `CaptionLine`                                                                                                                             | `src/overlay/CaptionOverlay.test.tsx`     |
| AC2 | WHEN overlay nhận `transcript` THE SYSTEM SHALL giữ tối đa 6 câu gần nhất; câu cùng `segmentId` được **thay thế** (partial → final), không nhân đôi                                                                                                  | `src/overlay/transcript-store.test.ts`    |
| AC3 | WHERE Assist level là 1 THE SYSTEM SHALL chỉ hiện bản dịch (ẩn câu gốc); level 3–4 hiện cả hai; level 0 ẩn overlay nội dung (chỉ khung trống)                                                                                                        | `CaptionOverlay.test.tsx`                 |
| AC4 | WHEN `permissionsStatus` trả `denied` hoặc `unknown` cho micro/ghi màn hình THE SYSTEM SHALL hiện hướng dẫn cấp quyền bằng tiếng Việt cho mục đó; WHEN cả hai `granted` THE SYSTEM SHALL hiện trạng thái sẵn sàng                                    | `src/onboarding/PermissionsStep.test.tsx` |
| AC5 | WHEN người dùng đổi Assist level (chọn 4/3/1) THE SYSTEM SHALL gọi `native.setAssistLevel`; WHEN bấm Bắt đầu THE SYSTEM SHALL gọi `native.sessionStart({ assistLevel })`, bấm Dừng gọi `native.sessionStop`; lỗi từ native hiện thông báo tiếng Việt | `src/session/SessionPanel.test.tsx`       |

## Môi trường (đọc kỹ)

**Codex không có mạng.** Lead đã `pnpm install` trong worktree này: `react react-dom zustand @tanstack/react-query zod @tauri-apps/api vite @vitejs/plugin-react tailwindcss @tailwindcss/vite vitest`. Vì vậy:

- **Không** chạy `pnpm install` / `pnpm add`; cần thêm dependency → dừng và ghi câu hỏi.
- **Không** build/chạy Tauri hay `cargo` (cần mạng/toolchain, lead làm). Kiểm bằng `pnpm verify` và `pnpm --filter @cuelingo/desktop build` (Vite build, không cần mạng).
- Test component bằng `renderToStaticMarkup` (`react-dom/server`) như `packages/ui`; **không** thêm jsdom/testing-library. Tách logic ra hàm/store thuần để test (không cần DOM).

## Đọc trước

- `AGENTS.md` (gốc), `apps/desktop/AGENTS.md`
- Convention: `apps/docs/docs/05-engineering/conventions/web-feature.md`, `naming.md` (áp dụng cho React của desktop)
- Mẫu feature React: `apps/web/src/features/glossary/` (component thuần, hook riêng, test `renderToStaticMarkup`)
- Thiết kế: `apps/docs/docs/04-modules/01-desktop/{overlay,onboarding,settings,session-controller}.md`
- Cầu nối native: `apps/desktop/src/lib/native.ts` (**chỉ đọc**) — UI chỉ gọi `native.*`, không bao giờ `invoke`/`listen` trực tiếp
- UI kit: `packages/ui/src/components/*` và `packages/ui/src/styles/globals.css` (`CaptionLine`, `Button`, `Card`, `Input`; dùng token Tailwind, không mã màu cứng)
- Web làm mẫu cho Providers: `apps/web/src/app/providers.tsx`

## Phạm vi file

| Được sửa / tạo                                                                                                                                                                                          | Không được sửa                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src/**` **trừ** `src/lib/native.ts`; `apps/docs/docs/04-modules/01-desktop/{overlay,onboarding,settings,session-controller}.md` (cập nhật Interface/Phụ thuộc); mục Kết quả của brief này | `apps/desktop/{src-tauri,native,index.html,overlay.html,vite.config.ts,tsconfig.json,package.json}`, `packages/**`, `services/**`, `apps/{web,docs}` (trừ các trang module ở bên trái), config gốc, `pnpm-lock.yaml`, `.github/**` |

Không commit, không push.

## Các bước

1. `src/styles.css`: `@import "tailwindcss";` + `@import "@cuelingo/ui/globals.css";` (kiểm `globals.css` đã có `@source` cho `apps/desktop/src`). Nền `html, body, #root` của overlay phải trong suốt (xem style trong `overlay.html`); cửa sổ main dùng token `bg-background`.
2. `src/main.tsx` + `src/app/{App,providers}.tsx`: QueryClientProvider; App có ba phần xếp dọc: `PermissionsStep`, `AssistSettings`, `SessionPanel`; dòng chữ đầu trang "CueLingo". Tiếng Việt cho mọi chuỗi giao diện.
3. `src/onboarding/`: `PermissionsStep` (dùng `useQuery` + `native.permissionsStatus`, nút "Kiểm tra lại"); hàm thuần `describePermission(name, state)` trả chuỗi hướng dẫn (test).
4. `src/settings/`: `AssistSettings` — chọn Assist level 4 (Đầy đủ), 3 (Gợi ý), 1 (Tối thiểu) bằng `Button`; lưu level trong store zustand `useSettings` (không lưu bền ở bước này); mỗi lần đổi gọi `native.setAssistLevel`.
5. `src/session/`: `SessionPanel` — nút Bắt đầu/Dừng (`useMutation` bọc `native.sessionStart/sessionStop`), nút "Hiện/ẩn overlay" (`native.toggleOverlay`), hiển thị phím tắt ⌘⇧L / ⌘⇧W / ⌘⇧S; hàm `describeNativeError(err)` map mã lỗi (`session_already_running`, `invalid_assist_level`, khác) sang tiếng Việt (test).
6. `src/overlay/`: `transcript-store.ts` (store thuần/zustand: `push(event)` thay theo `segmentId`, giữ 6 câu cuối), `CaptionOverlay.tsx` (đọc store + level từ `useSettings`… **lưu ý**: overlay là webview khác với main nên không chung store; cho `CaptionOverlay` nhận `level` qua prop, mặc định 4, và để TODO ghi rõ việc đồng bộ level giữa hai cửa sổ ở mục Câu hỏi mở), hook `useTranscript` gọi `native.onTranscript` và dọn listener khi unmount; `src/overlay-main.tsx` mount overlay. Dữ liệu mẫu = hằng trong `overlay/sample.ts`.
7. Overlay trông như thanh caption: nền bán trong suốt (`bg-black/60`, bo góc), chữ trắng, không viền cửa sổ, kéo được bằng `data-tauri-drag-region` ở dải trên cùng.
8. Test AC1–AC5; cập nhật các trang module desktop (Interface: component/hook đã có; Câu hỏi mở: đồng bộ level giữa hai cửa sổ, lưu cài đặt bền).
9. Chạy `pnpm verify` rồi `pnpm --filter @cuelingo/desktop build` ở gốc worktree; cả hai phải xanh.

## Definition of Done

- [ ] AC1–AC5 có test và xanh
- [ ] `pnpm verify` xanh; `pnpm --filter @cuelingo/desktop build` ra `dist/index.html` và `dist/overlay.html`
- [ ] Không `invoke`/`listen` ngoài `src/lib/native.ts`; không import `apps/web`
- [ ] Trang module desktop cập nhật; không commit, không push

## Ngoài phạm vi · Dừng và hỏi khi

- Ngoài phạm vi: Rust/Swift, audio, đăng nhập/đồng bộ với API (`core-sdk`), Quick Assist, lưu cài đặt bền, i18n, icon riêng.
- Dừng và ghi câu hỏi nếu: cần sửa file ngoài danh sách (kể cả `native.ts`) · cần thêm command/event mới trong Rust · cần dependency mới.

## Kết quả _(implementer điền)_

- File đã đổi:
  - Entry/app/style: `apps/desktop/src/{main.tsx,overlay-main.tsx,styles.css}`, `apps/desktop/src/app/{App.tsx,providers.tsx}`
  - Onboarding: `apps/desktop/src/onboarding/{PermissionsStep.tsx,index.ts}`
  - Settings: `apps/desktop/src/settings/{AssistSettings.tsx,use-assist-settings.ts,settings-store.ts,index.ts}`
  - Session: `apps/desktop/src/session/{SessionPanel.tsx,session-actions.ts,index.ts}`
  - Overlay: `apps/desktop/src/overlay/{CaptionOverlay.tsx,use-transcript.ts,transcript-store.ts,sample.ts,index.ts}`
  - Docs: `apps/docs/docs/04-modules/01-desktop/{overlay,onboarding,settings,session-controller}.md` và brief này
- Test đã thêm:
  - `PermissionsStep.test.tsx`: trạng thái denied/unknown/granted (AC4)
  - `AssistSettings.test.ts`: gửi level 4/3/1 tới native (AC5)
  - `SessionPanel.test.ts`: start/stop/toggle và ánh xạ lỗi native (AC5)
  - `transcript-store.test.ts`: thay segment cùng id, giới hạn 6 câu (AC2)
  - `CaptionOverlay.test.tsx`: dữ liệu mẫu, partial và level 0/1/3/4 (AC1, AC3)
- `pnpm verify` / `desktop build`:
  - `pnpm verify`: xanh — 21 file test, 62 test; không có vi phạm dependency
  - `pnpm --filter @cuelingo/desktop build`: xanh — có `dist/index.html` và `dist/overlay.html`
  - `pnpm docs:build`: xanh
  - Các lệnh có cảnh báo runner dùng Node `22.14.0`, thấp hơn engine `>=22.19`; không ảnh hưởng kết quả
- Đã chạy thật: đã chạy typecheck, test và Vite production build; không chạy app Tauri/Cargo theo giới hạn môi trường của brief, nên chưa thử cửa sổ native với cuộc gọi thật
- Khác brief (và lý do): không có thay đổi implementation ngoài brief
- Câu hỏi còn mở:
  - Đồng bộ Assist level giữa hai webview `main` và `overlay` bằng event hay đọc từ Tauri state?
  - Lưu cài đặt bền ở local hay đồng bộ qua API?
