---
title: Brief P2-14 · onboarding lần đầu (desktop)
---

# Brief — P2-14 · Hướng dẫn lần đầu trong app desktop

> Nhánh `feat/p2-14-codex` · Worktree `.worktrees/p2-14-codex`

## Mục tiêu

Lần đầu mở app sau khi đăng nhập, hiện một luồng 4 bước thay cho trang chính; xong thì không hiện lại. Đặt trong `apps/desktop/src/onboarding/` (đã có `PermissionsStep.tsx`: dùng lại logic, đừng làm hỏng export hiện có).

1. **Chào:** logo, một câu về việc app làm (caption song ngữ khi họp, tra từ và soạn câu, debrief và ôn từ chính cuộc họp), nút "Bắt đầu".
2. **Quyền:** micro (`native.permissionsStatus`) và âm thanh hệ thống (nút "Thử nghe âm thanh" gọi `native.checkSystemAudio`, kèm nút mở Cài đặt hệ thống qua `native.openUrl(PRIVACY_PANES.*)`). Hiện trạng thái thật từng quyền, không chặn: có nút "Để sau".
3. **Thử caption mẫu:** hiện hai khối caption mẫu (dùng `overlay/sample.ts` và `overlay/CaptionBlock.tsx`) và nút "Hiện overlay thử" (`native.toggleOverlay`) để người dùng thấy overlay nổi lên; giải thích ⌘⇧L ẩn/hiện.
4. **Mức hỗ trợ:** `Segmented` của `@cuelingo/ui` với 4 mức (dùng `saveAssistLevel` của `settings/use-assist-settings`), mô tả từng mức một dòng, nút "Vào CueLingo".

Cờ đã xong lưu bằng `localStorage` khoá `cuelingo.onboarded.<userId hoặc 'dev'>` (try/catch quanh mọi đọc ghi). Trang Cài đặt có nút "Xem lại hướng dẫn" xoá cờ và mở lại luồng. Có thanh bước (1/4…), nút Quay lại, phím Enter/Esc hợp lý, `aria-current` cho bước hiện tại.

## AC

| #   | AC (EARS)                                                                                              | Test           |
| --- | ------------------------------------------------------------------------------------------------------ | -------------- |
| AC1 | WHEN đã đăng nhập và chưa có cờ onboarding THE SYSTEM SHALL hiện bước 1; sau bước 4 lưu cờ và hiện app | component test |
| AC2 | Bước quyền hiện đúng trạng thái micro (granted/denied/undetermined) và kết quả thử âm thanh hệ thống   | test           |
| AC3 | "Để sau" ở bước quyền vẫn đi tiếp được                                                                 | test           |
| AC4 | Chọn mức hỗ trợ ở bước 4 gọi `saveAssistLevel` đúng mức                                                | test           |
| AC5 | Có cờ rồi thì không hiện lại; "Xem lại hướng dẫn" ở Cài đặt mở lại                                     | test           |
| AC6 | Storage bị chặn (ném lỗi) không làm app hỏng                                                           | test           |

## Phạm vi file

Được sửa/tạo: `apps/desktop/src/onboarding/**`, `apps/desktop/src/app/App.tsx` (chỉ phần cổng onboarding và nút "Xem lại hướng dẫn" ở view `settings`). Không sửa Rust, `packages/**`, `services/**`.

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`, mục "Giai đoạn 2" trong `apps/docs/docs/02-product/06-backlog.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không sửa `packages/ui/src/lib/roadmap.ts`, `package.json`, `pnpm-lock.yaml` (lead sửa khi gộp). Giao diện: dùng `@cuelingo/ui` và các skill thiết kế trong `.claude/skills/` (màu chỉ cho dữ liệu, không gradient, không thẻ icon giống nhau, nhãn câu thường, chữ trong app nhỏ và gọn). Mọi chuỗi giao diện tiếng Việt. Chạy `pnpm verify` trước khi báo; điền mục Kết quả, nêu rõ cái gì chưa kiểm được.

## Kết quả _(implementer điền)_

- **Đã làm:** thêm cổng onboarding 4 bước trước `AppShell`; lưu cờ theo `cuelingo.onboarded.<userId|dev>` với mọi thao tác storage được bọc `try/catch`; thêm nút **Xem lại hướng dẫn** trong Cài đặt.
- **UI/luồng:** dùng lại `PermissionsStep`, `sampleTranscript`, `CaptionBlock`, `Segmented` và `saveAssistLevel`; có tiến trình 1/4–4/4, Quay lại, Enter/Esc, `aria-current="step"`, thử overlay và hướng dẫn ⌘⇧L.
- **File đổi/tạo:** `apps/desktop/src/app/App.tsx`; `apps/desktop/src/onboarding/{OnboardingFlow.tsx,OnboardingFlow.test.tsx,onboarding-storage.ts,PermissionsStep.tsx,PermissionsStep.test.tsx,index.ts}`.
- **Test:** thêm test cờ theo người dùng, xoá cờ để xem lại, storage ném lỗi, nội dung các bước/caption mẫu, bốn mức hỗ trợ và kết quả thử âm thanh hệ thống. `pnpm verify` xanh (72 file, 314 test); `pnpm --filter @cuelingo/desktop build` xanh.
- **Chạy thật:** chưa chạy được cửa sổ Tauri/quyền macOS/overlay thật vì sandbox chặn bind dev server (`listen EPERM 127.0.0.1:1420`). Cần lead thử lại luồng trong app desktop đã đóng gói, gồm cấp quyền, thử âm thanh và bật overlay.
- **Lưu ý môi trường:** các lệnh có cảnh báo Node 22.14.0 thấp hơn mức repo yêu cầu ≥22.19; không gây lỗi verify/build trong worktree này.
- **Khác brief/câu hỏi mở:** không có thay đổi phạm vi; không có câu hỏi mở.
