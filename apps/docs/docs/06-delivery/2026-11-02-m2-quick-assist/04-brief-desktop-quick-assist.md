---
title: Brief M2-03/04 · desktop quick-assist UI
---

# Brief — M2-03/04 · Quick Assist UI trong app desktop

> Giao cho: Codex · Nhánh `feat/m2-ui-codex` · Worktree `.worktrees/m2-ui-codex` · Quy tắc: `apps/docs/docs/05-engineering/agent-collaboration.md`

## Mục tiêu

Trong `apps/desktop/src/quick-assist/` làm UI cho ba việc, dùng hợp đồng `packages/shared/src/dto/assist.dto.ts` và `events.dto.ts` (đừng đổi):

1. **Tra từ:** click một từ trong caption tiếng Anh của overlay → popup nhỏ hiện nghĩa tiếng Việt, ví dụ, ghi chú (gọi `lookup` với `term` và câu chứa từ làm `context`).
2. **"Họ vừa nói gì?"** (⌘⇧W): nút/phím tắt gọi `recap` với tối đa 15 câu `system` gần nhất trong `transcript-store`, hiện tóm tắt + các ý.
3. **"Nói giúp"** (⌘⇧S): ô nhập tiếng Việt → gọi `compose` → hiện 2 câu tiếng Anh, bấm để chọn (chữ to, dạng teleprompter dễ đọc), nút sao chép.

Mỗi lần tra/recap/compose gửi một learning event qua `POST /v1/events` (fire-and-forget, lỗi bỏ qua, không chặn UI).

## AC

| #   | AC (EARS)                                                                                                                                                  | Test                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| AC1 | WHEN click từ trong caption THE SYSTEM SHALL hiện popup, trạng thái đang tải rồi kết quả; lỗi hiện thông báo tiếng Việt có nút thử lại                     | component test          |
| AC2 | WHEN nhận event hotkey `recap` THE SYSTEM SHALL mở panel recap với các câu gần nhất                                                                        | component test          |
| AC3 | WHEN nhận event hotkey `compose` THE SYSTEM SHALL mở ô nhập; Enter gửi; kết quả có chữ ≥ 20 px                                                             | component test          |
| AC4 | Mọi gọi mạng đi qua `assist-api.ts` (một chỗ): `fetch` tới `VITE_API_URL`, header `Authorization: Bearer ${VITE_REALTIME_TOKEN}`, parse bằng schema shared | unit test với fetch giả |
| AC5 | Không có từ/câu nào bị log; phím tắt đã có ở Rust phát event `hotkey` (xem `native.onHotkey`) — không sửa Rust                                             | review                  |

## Thiết kế

Copy phong cách `overlay/` và `session/` hiện có (hook + store + component nhỏ). Popup nằm trong cửa sổ overlay (overlay hiện là 520×520, có thể đổi cỡ); panel recap/compose cũng trong overlay, phủ lên vùng caption và có nút đóng. Màu chữ dùng kế thừa theme overlay (xem `CaptionOverlay.tsx`, `text-inherit!`). Văn bản giao diện tiếng Việt, đủ nhãn `aria-label`, đích bấm ≥ 44 px.

## Môi trường / phạm vi file

Không có mạng, không `pnpm add`, không cargo. Được sửa/tạo: `apps/desktop/src/**`. Không sửa `apps/desktop/src-tauri/**`, `packages/**`, `services/**`. Không commit/push. Chạy `pnpm --filter @cuelingo/desktop exec tsc --noEmit` và `pnpm verify`.

## Kết quả _(implementer điền)_
