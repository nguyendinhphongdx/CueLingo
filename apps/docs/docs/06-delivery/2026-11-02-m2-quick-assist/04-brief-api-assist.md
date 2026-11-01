---
title: Brief M2-01 · api/assist
---

# Brief — M2-01 · `api/assist` (lookup, recap, compose)

> Giao cho: Codex · Nhánh `feat/m2-assist-codex` · Worktree `.worktrees/m2-assist-codex` · Quy tắc: `apps/docs/docs/05-engineering/agent-collaboration.md`

## Mục tiêu

Ba endpoint `POST /v1/assist/lookup|recap|compose` theo hợp đồng đã có trong `packages/shared/src/dto/assist.dto.ts` (đừng đổi hợp đồng). Mỗi endpoint gọi một task AI qua `@cuelingo/ai-gateway`, prompt có phiên bản trong `@cuelingo/prompts` (copy cấu trúc `packages/prompts/src/translate/`).

## AC

| #   | AC (EARS)                                                                                                                                                                                                       | Test                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| AC1 | WHEN gọi `lookup` hợp lệ THE SYSTEM SHALL trả `LookupResponse` nghĩa tiếng Việt theo ngữ cảnh, kèm ví dụ ngắn                                                                                                   | `assist.test.ts`        |
| AC2 | WHEN gọi `recap` với các câu gần nhất THE SYSTEM SHALL trả tóm tắt tiếng Việt ≤ 2 câu và tối đa 5 ý                                                                                                             | `assist.test.ts`        |
| AC3 | WHEN gọi `compose` với ý tiếng Việt THE SYSTEM SHALL trả 2 lựa chọn tiếng Anh lịch sự, ngắn, dùng ngay được                                                                                                     | `assist.test.ts`        |
| AC4 | Mỗi task yêu cầu model trả JSON; IF JSON hỏng/không qua schema THEN thử lại một lần, vẫn hỏng THEN `502` mã lỗi mới `AssistFailed` (thêm vào ErrorCode + map status)                                            | `assist.test.ts`        |
| AC5 | IF body sai schema THEN `400` theo cách module glossary đang làm; không có session THEN `401`                                                                                                                   | `assist.test.ts`        |
| AC6 | Task AI có timeout 8 s (khai trong `tasks.ts`: `assist.lookup`, `assist.recap`, `assist.compose`), model mặc định `gemini-3.5-flash-lite`, ghi đè bằng `AI_ASSIST_MODEL`                                        | `gateway.test.ts`       |
| AC7 | Phát triển cục bộ: header `Authorization: Bearer <REALTIME_DEV_TOKEN>` được chấp nhận làm người dùng dev cho `/v1/assist/*` (và `/v1/events`), dùng cùng logic `verifyToken` của realtime; production không đổi | `app.test.ts`           |
| AC8 | Prompt kèm vài fixture trong `fixtures/` và test kiểm cấu trúc prompt (không gọi mạng)                                                                                                                          | `*.test.ts` của prompts |

## Thiết kế bắt buộc

- `ai-gateway`: thêm phương thức dùng chung để gọi task trả JSON (parse + validate bằng schema Zod truyền vào). Tái dùng đường gọi/timeout/fallback hiện có của `gateway.llm`. Đọc `packages/ai-gateway/src/gateway.ts`.
- Module mới `services/api/src/modules/assist/` (routes → service, không có repository vì chưa lưu DB), đăng ký trong `app.ts` qua `deps.assist?` giống `realtime`; `server.ts` nối gateway thật khi có `GEMINI_API_KEY`.
- Không import SDK AI trực tiếp; không log nội dung người dùng gửi lên.
- Doc: viết `apps/docs/docs/04-modules/03-api/assist.md` ngắn gọn (tiếng Việt).

## Môi trường

Không có mạng; dependency đã cài sẵn; không `pnpm add`; test dùng gateway giả.

## Phạm vi file

Được sửa/tạo: `packages/prompts/**`, `packages/ai-gateway/**`, `services/api/**` (module assist, `app.ts`, `server.ts`, `lib/auth.ts`, `lib/errors.ts`), `packages/shared/src/errors/error-code.ts` (chỉ thêm `AssistFailed`), doc module. Không sửa: `apps/**`, `infra/**`, `package.json`, `pnpm-lock.yaml`, `packages/shared/src/dto/*`. Không commit/push. Chạy `pnpm verify` trước khi báo.

## Kết quả _(implementer điền)_

### File đã đổi

- Thêm prompt phiên bản, fixture và test cho `lookup`, `recap`, `compose` trong `packages/prompts/src/`; export qua `packages/prompts/src/index.ts`.
- Thêm ba task Assist và phương thức `AiGateway.json()` dùng chung trong `packages/ai-gateway/src/`; JSON/schema sai được thử lại đúng một lần.
- Hoàn thiện `services/api/src/modules/assist/` theo luồng routes → service; đăng ký tùy chọn trong `app.ts` và nối gateway thật trong `server.ts`.
- Mở rộng auth dev trong `services/api/src/lib/auth.ts` cho `/v1/assist/*` và `/v1/events`, dùng chung hàm `verifyToken`; production không truyền verifier này.
- Thêm `ErrorCode.AssistFailed` và ánh xạ HTTP `502`; cập nhật `apps/docs/docs/04-modules/03-api/assist.md`.

### Test đã thêm

- Prompt: kiểm cấu trúc, fixture và schema đầu ra chặt hơn cho cả ba task.
- Gateway: model/timeout, `AI_ASSIST_MODEL`, parse + validate JSON, retry một lần và lỗi sau hai output sai.
- API: ba luồng thành công, body sai `400`, thiếu session `401`, output AI sai `502 ASSIST_FAILED` và token dev theo đúng phạm vi route.

### Kiểm chứng

- `pnpm verify`: xanh — 31 test files, 137 tests; typecheck 10 package; không có vi phạm dependency.
- `pnpm docs:build`: xanh — sinh static files thành công.
- Luồng thật trong tiến trình Fastify được chạy qua `app.inject`: lookup, recap, compose, auth session/dev token và lỗi retry; gateway dùng provider giả theo yêu cầu môi trường, không gọi mạng.
- Môi trường báo cảnh báo Node `22.14.0` thấp hơn mức repo yêu cầu `>=22.19`, nhưng toàn bộ lệnh trên kết thúc mã `0`.

### Khác brief / câu hỏi mở

- Không khác brief. Không có câu hỏi mở.
- Không commit hoặc push.
