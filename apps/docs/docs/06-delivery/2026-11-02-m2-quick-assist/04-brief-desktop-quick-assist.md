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

- Đã làm Quick Assist trong `apps/desktop/src/quick-assist/`: API client tập trung, hook điều phối state/hotkey, popup tra từ, panel recap, form compose, teleprompter chọn câu và sao chép.
- Đã nối vào `CaptionOverlay`: từ tiếng Anh là đích tra cứu; toolbar có nút recap/compose; caption vẫn chỉ hiện 6 câu, store giữ tối đa 15 segment và recap chỉ lấy câu `system` final.
- Đã bổ sung nguồn `system | mic` cho transcript nội bộ phía desktop; không sửa Rust hay contract shared. Learning event lookup/recap gửi fire-and-forget khi thao tác; `compose_used` gửi khi chọn câu để có `chosenIndex` đúng contract.
- Test mới: API URL/auth/shared-schema/error; trạng thái loading/result/error/retry; từ có thể bấm; hotkey recap/compose; recap content; form và cỡ chữ teleprompter. Regression test session/store/overlay đã cập nhật.
- Verify:
  - `pnpm --filter @cuelingo/desktop exec tsc --noEmit`: xanh.
  - `pnpm exec vitest run apps/desktop/src`: 8 file, 29 test xanh.
  - `pnpm --filter @cuelingo/desktop build`: xanh (Vite production build, 207 module).
  - `pnpm verify`: xanh (29 file, 117 test; không có vi phạm dependency).
- Chưa chạy cuộc gọi Zoom/Meet thật vì môi trường không có backend/token/cuộc gọi; đã chạy production build và kiểm luồng mạng bằng fetch giả. Môi trường báo Node `22.14.0`, thấp hơn mức repo yêu cầu `22.19`, nhưng tất cả lệnh trên đều thành công.
- Không làm khác brief; không có câu hỏi mở.
