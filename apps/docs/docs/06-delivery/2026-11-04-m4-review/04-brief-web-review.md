---
title: Brief M4-03/04 · web review + progress
---

# Brief — M4-03/04 · `apps/web` phiên ôn và tiến độ

> Nhánh `feat/m4-web-codex` · Worktree `.worktrees/m4-web-codex`

## Mục tiêu

Trong `apps/web` (copy cách làm của `features/sessions` và `features/glossary`) thêm:

- `/review`: phiên ôn 5–10 phút. Lấy `GET /v1/review/queue`; mỗi thẻ một màn hình: dạng **recognize** (hiện cụm tiếng Anh, chọn nghĩa) và **cloze** (câu có chỗ trống, chọn cụm). Chọn đúng/sai → hiện đáp án, `meaningVi`, `contextEn`; rồi bốn nút "Lại / Khó / Được / Dễ" (gợi ý sẵn: sai → Lại, đúng → Được) gửi `POST /v1/review/answer` (kèm `responseMs`). Thanh tiến độ "3/10", màn hình kết thúc (số đúng, số thẻ đến hạn còn lại, nút "Ôn tiếp" nếu `dueCount` còn). Hàng đợi rỗng: thông báo vui và liên kết tới Cuộc họp.
- `/progress`: các thẻ số (cụm đã lưu, đang ôn, đến hạn hôm nay, chuỗi ngày, số cuộc họp, % hiểu), biểu đồ cột 7 ngày ôn tập, và biểu đồ 4 tuần "số lần tra từ mỗi cuộc họp" (SVG tự vẽ đơn giản, có `aria-label` mô tả số liệu, không thêm thư viện).
- Thêm "Ôn tập" và "Tiến độ" vào menu của layout `(app)`; thêm trang `/phrases` liệt kê Phrase Bank (`GET /v1/phrases`) kèm nút xoá.
- Mọi phím tắt bàn phím: 1–4 chọn đáp án, Enter qua thẻ. Đích bấm ≥ 44 px; tiếng Việt; trạng thái tải/lỗi/rỗng.

API (brief khác làm, hợp đồng ở `packages/shared/src/dto/review.dto.ts`): `GET /v1/review/queue`, `POST /v1/review/answer`, `GET /v1/progress`, cùng `/v1/phrases` đã có. Gọi qua `src/lib/client.ts`, parse bằng schema shared.

## AC

| #   | AC (EARS)                                                                                    | Test           |
| --- | -------------------------------------------------------------------------------------------- | -------------- |
| AC1 | WHEN trả lời đúng thẻ recognize THE SYSTEM SHALL hiện nghĩa và ngữ cảnh rồi cho chấm bốn mức | component test |
| AC2 | WHEN chấm THE SYSTEM SHALL gọi `/v1/review/answer` đúng một lần rồi sang thẻ kế              | component test |
| AC3 | WHEN hết thẻ THE SYSTEM SHALL hiện tổng kết với số đúng/sai                                  | component test |
| AC4 | Hàng đợi rỗng hiện trạng thái rỗng                                                           | component test |
| AC5 | `/progress` hiện đủ chỉ số và biểu đồ có mô tả cho trình đọc màn hình                        | component test |
| AC6 | `pnpm --filter @cuelingo/web build` xanh                                                     | build          |

## Phạm vi file

Được sửa/tạo: `apps/web/**`. Không sửa `packages/**`, `services/**`, `apps/desktop/**`.

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không đổi `packages/shared/src/dto/review.dto.ts` (thiếu thì dừng và ghi câu hỏi). Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả

### Đã làm

- Thêm ba route được bảo vệ: `/review`, `/progress`, `/phrases`; cập nhật menu `AppShell` với đích bấm tối thiểu 44 px và tự xuống dòng trên màn hình hẹp.
- Mở rộng `src/lib/client.ts` cho queue/chấm review, progress và list/xoá phrase; mọi request/response đều parse bằng schema từ `@cuelingo/shared`.
- Review hỗ trợ recognize + cloze, phím `1–4`, Enter dùng mức gợi ý, khoá gửi lặp, tiến độ, đáp án/nghĩa/ngữ cảnh, tổng kết, ôn tiếp và trạng thái tải/lỗi/rỗng.
- Progress hiện sáu chỉ số, biểu đồ SVG 7 ngày và 4 tuần; mỗi biểu đồ có `role="img"` và `aria-label` chứa số liệu.
- Phrase Bank hiện danh sách, trạng thái ôn, nghĩa, xoá và trạng thái tải/lỗi/rỗng.

### File đã đổi

- `apps/web/src/lib/client.ts`, `apps/web/src/features/auth/AppShell.tsx`.
- `apps/web/src/features/review/**`, `apps/web/src/features/progress/**`, `apps/web/src/features/phrase-bank/**`.
- `apps/web/src/app/(app)/{review,progress,phrases}/page.tsx`.

### Kiểm chứng

- Thêm 7 component test cho AC1–AC5: tiết lộ đáp án, chấm một lần mỗi click, tổng kết, queue rỗng, đủ chỉ số/nhãn biểu đồ, danh sách và empty state Phrase Bank.
- `pnpm --filter @cuelingo/web build`: xanh; Next.js sinh đủ `/review`, `/progress`, `/phrases`.
- `pnpm verify`: xanh — 47 test file, 216 test; không có vi phạm dependency.
- Đã thử chạy thật bằng `pnpm --filter @cuelingo/web dev` và với hostname `127.0.0.1`; sandbox chặn mở cổng ở cả hai lần (`listen EPERM`), nên chưa thể kiểm tra trực tiếp trong trình duyệt tại worktree này.
- Môi trường báo Node `v22.14.0` thấp hơn engine `>=22.19`, nhưng build và toàn bộ verify vẫn hoàn tất thành công.

### Khác brief / câu hỏi còn mở

- Không thay đổi phạm vi hoặc hành vi so với brief.
- Lead cần smoke-test ba route trong trình duyệt ở môi trường cho phép mở cổng trước cổng RESULT.
