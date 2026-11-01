---
title: Brief M3 · desktop vòng đời phiên
---

# Brief — M3 · desktop tạo và kết thúc phiên trên API

> Nhánh `feat/m3-desktop-codex` · Worktree `.worktrees/m3-desktop-codex`

## Mục tiêu

Hiện app tự sinh `sessionId` cục bộ. Đổi `apps/desktop/src/session/`: khi bấm Bắt đầu gọi `POST /v1/sessions` (`{assistLevel}`) lấy `id` rồi dùng id đó cho `hello` của WebSocket; khi Dừng gọi `POST /v1/sessions/:id/end`. Dùng một client duy nhất `session/sessions-api.ts` (copy cách làm của `quick-assist/assist-api.ts`: `VITE_API_URL`, `Authorization: Bearer ${VITE_REALTIME_TOKEN}`, parse bằng schema shared). Sau khi dừng hiện liên kết "Xem debrief" mở `${VITE_WEB_URL}/sessions/:id` bằng trình duyệt hệ thống (thêm `VITE_WEB_URL` vào `.env.example`, mặc định `http://localhost:3000`; mở URL qua `native.ts` — nếu cần lệnh Rust mới, **dừng và ghi câu hỏi**, đừng sửa Rust).

## AC

| #   | AC (EARS)                                                                                                   | Test                         |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------------------------- |
| AC1 | WHEN bấm Bắt đầu THE SYSTEM SHALL tạo session trên API trước rồi mới mở WebSocket với id nhận được          | `session-controller.test.ts` |
| AC2 | IF tạo session thất bại THEN hiện lỗi tiếng Việt và không bắt đầu thu âm                                    | test                         |
| AC3 | WHEN bấm Dừng THE SYSTEM SHALL gọi `end` đúng một lần kể cả khi bấm hai lần; lỗi `end` không chặn việc dừng | test                         |
| AC4 | Sau khi dừng có nút "Xem debrief"                                                                           | component test               |

## Phạm vi file

Được sửa/tạo: `apps/desktop/src/**`, `apps/desktop/.env.example`. Không sửa `src-tauri/**`, `packages/**`, `services/**`.

Quy tắc chung: đọc `AGENTS.md` gốc và `AGENTS.md` của thư mục bạn sửa, `apps/docs/docs/05-engineering/agent-collaboration.md`. Không có mạng, không `pnpm add`, không commit/push; dependency đã cài sẵn. Không đổi hợp đồng trong `packages/shared/src/dto/{session,debrief,phrase}.dto.ts` (nếu thật sự thiếu, dừng và ghi câu hỏi). Chạy `pnpm verify` trước khi báo; điền mục Kết quả.

## Kết quả _(implementer điền)_

- Đã thêm `session/sessions-api.ts`: tạo/kết thúc phiên bằng bearer token, đổi URL `ws(s)` sang `http(s)` và parse request/response bằng schema `@cuelingo/shared`.
- Đã đổi session controller để lấy ID từ `POST /v1/sessions` trước khi bật native capture/WebSocket; lỗi tạo phiên không bật thu âm. `stop()` khóa lời gọi đồng thời, gọi API `end` đúng một lần và vẫn dừng native khi API lỗi.
- Sau khi dừng, `SessionPanel` hiện nút **Xem debrief**; URL `${VITE_WEB_URL}/sessions/:id` được mở qua `native.ts`. Đã thêm `VITE_WEB_URL=http://localhost:3000` vào `.env.example`; không cần sửa Rust.
- File đổi/tạo: `apps/desktop/.env.example`, `src/lib/native.ts`, `src/session/{sessions-api.ts,sessions-api.test.ts,session-controller.ts,session-controller.test.ts,use-session.ts,session-actions.ts,SessionPanel.tsx,SessionPanel.test.ts}`.
- Test thêm: client sessions (URL/auth/schema/lỗi HTTP), thứ tự API → native → WebSocket, lỗi create không thu âm, hai lần dừng chỉ end một lần, lỗi end không chặn dừng, nút/link debrief. Kết quả `pnpm verify`: xanh — 35 file test, 158 test; không có vi phạm dependency.
- Chạy thật trong phạm vi worktree: `pnpm --filter @cuelingo/desktop build` xanh (211 modules). Chưa chạy end-to-end với API thật vì module `api/sessions` thuộc brief/worktree song song và chưa có trên nhánh này.
- Khác brief: không có. Câu hỏi còn mở: không có. Lưu ý môi trường chạy Node `22.14.0` nên pnpm cảnh báo thấp hơn mức repo yêu cầu `>=22.19`, nhưng toàn bộ verify/build vẫn xanh.
