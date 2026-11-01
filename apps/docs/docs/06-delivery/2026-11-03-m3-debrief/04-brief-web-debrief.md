---
title: Brief M3-04/06 · web debrief
---

# Brief — M3-04/06 · `apps/web` danh sách phiên + trang debrief

> Nhánh `feat/m3-web-codex` · Worktree `.worktrees/m3-web-codex`

## Mục tiêu

Trong `apps/web` (copy feature `glossary`: `src/features/glossary`, route `src/app/(app)/glossary`) thêm:

- `/sessions`: danh sách cuộc họp (tiêu đề hoặc ngày giờ, thời lượng, trạng thái; "Đang xử lý debrief…" khi `ended`).
- `/sessions/[id]`: 5 khối debrief (Tóm tắt, Quyết định & việc cần làm, Đoạn khó — bấm mở transcript song ngữ tại đoạn đó, Cụm từ nên lưu, Câu bạn nói → câu nên nói) + điểm hiểu (comprehensionPct) + transcript song ngữ đầy đủ. Mỗi khối có 👍/👎 gọi `POST /v1/debriefs/:id/feedback`. Nút **Xuất Markdown** tải file `.md` dựng ở client.
- Nút "Lưu" cạnh mỗi cụm từ gợi ý gọi `POST /v1/phrases` (SavePhraseRequest); trạng thái đã lưu.
- Thêm liên kết "Cuộc họp" vào menu của layout `(app)`.
- Trạng thái đang tải / lỗi / rỗng bằng tiếng Việt; đích bấm ≥ 44 px; dùng component `@cuelingo/ui` có sẵn.

API (đang được brief khác làm, hợp đồng ở `packages/shared/src/dto`): `GET /v1/sessions`, `GET /v1/sessions/:id`, `GET /v1/sessions/:id/debrief` (404 = chưa có), `POST /v1/debriefs/:id/feedback`, `POST /v1/phrases`. Gọi qua client có sẵn `src/lib/client.ts` và parse bằng schema shared.

## AC

| #   | AC (EARS)                                                                                                        | Test                        |
| --- | ---------------------------------------------------------------------------------------------------------------- | --------------------------- |
| AC1 | WHEN mở `/sessions` THE SYSTEM SHALL liệt kê cuộc họp mới nhất trước, rỗng thì hiện hướng dẫn                    | component test              |
| AC2 | WHEN debrief chưa sẵn sàng (404) THE SYSTEM SHALL hiện trạng thái đang xử lý và tự thử lại mỗi 5 s tối đa 2 phút | component test              |
| AC3 | WHEN có debrief THE SYSTEM SHALL hiện đủ 5 khối và điểm hiểu                                                     | component test              |
| AC4 | WHEN bấm "Xuất Markdown" THE SYSTEM SHALL tạo `.md` chứa tóm tắt, việc cần làm, cụm từ, câu gợi ý                | unit test hàm dựng Markdown |
| AC5 | WHEN bấm "Lưu" THE SYSTEM SHALL gọi `/v1/phrases` và đổi nút thành "Đã lưu"                                      | component test              |

## Phạm vi file

Được sửa/tạo: `apps/web/**`. Không sửa `packages/**`, `services/**`, `apps/desktop/**`. Chạy thêm `pnpm --filter @cuelingo/web build`.

Quy tắc chung: đọc `AGENTS.md` gốc và `AGENTS.md` của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không đổi hợp đồng trong `packages/shared/src/dto/{session,debrief,phrase}.dto.ts` (nếu thật sự thiếu, dừng và ghi câu hỏi). Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả _(implementer điền)_
