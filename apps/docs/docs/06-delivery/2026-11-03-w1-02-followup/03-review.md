# Review — w1-02-followup

**Trạng thái:** code xong, đã qua hai review độc lập và đã kiểm với Gemini thật ở tầng AI; **chưa chạy thật trên giao diện** (cần người dùng thử). Chưa push, chưa tạo PR.

## Thay đổi so với plan

| Dấu         | Phần                                                                        | Chi tiết (lý do nếu khác plan)                                                                                                                                                                   |
| ----------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🟢 ADDED    | `packages/shared` `followup.dto.ts`, mã lỗi `FOLLOWUP_FAILED`, `core-sdk`   | `FollowupRequest` {channel, tone}, `FollowupResponse` {subject\|null, body, language}; tiêu đề tối đa 200 ký tự, không xuống dòng (thêm sau review)                                              |
| 🟢 ADDED    | `packages/prompts/src/followup/v1.ts`, task `assist.followup` trong gateway | Dữ kiện debrief làm sạch rồi đưa vào khối `<facts>` dạng JSON; kiểm đầu ra (placeholder, độ dài chat, tiêu đề); hạn 8 giây, không gọi lại cùng một model. Khác plan: thêm kiểm đầu ra sau review |
| 🟢 ADDED    | `services/api/src/modules/followup`                                         | `POST /v1/sessions/:id/followup`; cùng một 404 cho phiên của người khác và chưa có debrief; thử lại một lần khi đầu ra không đạt; giới hạn tần suất áp sau khi kiểm phiên, có trần kích thước    |
| 🟢 ADDED    | `packages/ui` `FollowupComposer`, `KeepMounted`, bộ trạng thái thuần        | Bấm đúp không gọi hai lần, phản hồi cũ bị bỏ, bản nháp nhớ kênh/giọng đã soạn, giữ phần đã sửa khi đóng mở, hỏi trước khi "Soạn lại", sao chép dự phòng có cả tiêu đề                            |
| 🟡 MODIFIED | `apps/web/src/features/debrief`, `apps/desktop/src/session`                 | Nút "Soạn follow-up" ở trang debrief và thẻ "Cuộc họp vừa xong"; thông báo lỗi theo mã (429, 404, 401/403, `FOLLOWUP_FAILED`); hạn 20 giây ở desktop                                             |
| 🟡 MODIFIED | Docs                                                                        | `03-api/followup.md` (mới), `02-web/debrief`, `session-controller`, gói `ui`, `prompts`, `ai-gateway`, `shared`, `core-sdk`, `06-ai-architecture`, `ai-calls`, backlog W1-02                     |

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md):

- [x] Ranh giới & bảo mật: `userId` từ auth; phiên của người khác và chưa có debrief cùng một 404; log chỉ ghi id, kênh, giọng, độ dài; không lưu bản nháp; `ai_call` không chứa nội dung
- [x] Hợp đồng: `@cuelingo/shared` là nguồn duy nhất, có client `core-sdk`
- [x] Kiến trúc: module API dùng `debrief` và `sessions` qua `index.ts`; AI qua `ai-gateway`; prompt có phiên bản; UI dùng chung ở `@cuelingo/ui` (có kiểu riêng vì gói không phụ thuộc `shared`, đã ghi ở `ui.md`)
- [x] AI: dữ kiện và lời nói coi là dữ liệu không đáng tin; kiểm placeholder, độ dài chat, tiêu đề
- [x] Test: xem dưới
- [x] Docs: các trang module và bảng tác vụ AI
- [x] Phạm vi: đúng spec; ngoài phạm vi vẫn để sau (tự gửi, lưu, cụm từ đã lưu, ngôn ngữ khác ngôn ngữ họp)

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test   # 126 file, 744 test xanh
pnpm exec depcruise apps services packages --config .dependency-cruiser.cjs --exclude '(^|/)\.env'   # không vi phạm
pnpm docs:build   # xanh
```

**Không chạy trọn được:** `pnpm check:deps` nguyên bản đỏ trong sandbox vì không đọc được `apps/desktop/.env` (EPERM); đã chạy `depcruise` cùng cấu hình loại `.env`. `pnpm test:int` (cần Docker) chưa chạy.

**Đã chạy thật (tầng AI, bằng Gemini thật với một debrief mẫu):** năm bản nháp qua `gateway.json('assist.followup')`:

| Ngôn ngữ, kênh, giọng | Độ trễ  | Kết quả                                               |
| --------------------- | ------- | ----------------------------------------------------- |
| en, email, polite     | 1209 ms | Có tiêu đề tiếng Anh, chỉ dùng các việc trong debrief |
| en, chat, brief       | 983 ms  | 3 dòng, không tiêu đề                                 |
| vi, email, friendly   | 1293 ms | Tiêu đề tiếng Việt, đúng quyết định và việc cần làm   |
| vi, chat, brief       | 970 ms  | 4 dòng, không tiêu đề                                 |
| ja, email, polite     | 1344 ms | Tiêu đề và nội dung tiếng Nhật                        |

Cả năm đều qua `checkFollowupOutput`; không có người phụ trách nào ngoài "Nam" (đúng như debrief), không placeholder, không ngày hạn bịa. p95 ≤ 6 giây (AC1) đạt ở tầng AI với mẫu nhỏ; chưa đo toàn đường (mạng, API, giao diện).

## Cho người review — đọc theo thứ tự

| #   | File                                                                                            | Soi gì                                                              |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| 1   | `services/api/src/modules/followup/followup.service.ts`                                         | Ranh giới người dùng, thử lại, giới hạn tần suất, không lộ nội dung |
| 2   | `packages/prompts/src/followup/v1.ts`                                                           | Làm sạch dữ kiện, khối `<facts>`, kiểm đầu ra                       |
| 3   | `packages/ui/src/components/followup-composer.tsx` và bộ trạng thái                             | Trạng thái bản nháp, chống bấm đúp, sao chép dự phòng               |
| 4   | `apps/web/src/features/debrief/DebriefPage.tsx`, `apps/desktop/src/session/PostMeetingCard.tsx` | Chỉ hiện khi debrief sẵn sàng, giữ phần đã sửa                      |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                                                                                              | Tìm ở         | Sửa                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------- | ----------------------------------------------------------------------------------------- |
| Tiêu đề email dự phòng lấy tóm tắt tiếng Việt cho họp tiếng Anh hoặc Nhật; có thể rỗng                                                           | Cả hai review | Chỉ dùng cho họp tiếng Việt và khi không rỗng; còn lại dùng tiêu đề chung theo ngôn ngữ   |
| Dữ kiện debrief chèn thô vào prompt, xuống dòng giả được "quyết định" hoặc "người phụ trách"                                                     | Cả hai review | Làm sạch, JSON trong `<facts>`, coi là dữ liệu không đáng tin                             |
| Tin nhắn nhóm không bị giới hạn độ dài; placeholder lọt qua                                                                                      | Codex         | Kiểm đầu ra, thử lại một lần rồi 502                                                      |
| Hạn 10 giây và gọi lại cùng một model làm vượt ngân sách độ trễ                                                                                  | Cả hai review | Hạn 8 giây, bỏ lượt dự phòng trùng model                                                  |
| Giới hạn tần suất trừ lượt trước khi kiểm phiên, không có trần kích thước                                                                        | Cả hai review | Áp sau khi kiểm phiên, trần 5000 người dùng                                               |
| Bấm đúp gọi AI hai lần; bản nháp lệch kênh khi đổi kênh; mất phần đã sửa khi đóng mở; sao chép dự phòng thiếu tiêu đề; thông báo lỗi chung chung | Cả hai review | Cờ chặn, bản nháp nhớ kênh, giữ gắn kết, hỏi trước khi soạn lại, sao chép đủ, lỗi theo mã |

## Còn lại, chưa làm

- **Chạy thật trên giao diện (cần người dùng):** soạn từ trang debrief web và thẻ desktop; kiểm sao chép trong webview Tauri; đo p95 toàn đường.
- **Chưa kiểm bằng test:** bấm đúp thật, chuyển focus, hộp thoại xác nhận (không có DOM test trong gói); trần 5000 người dùng của bộ giới hạn.
- **Giới hạn thiết kế:** bộ giới hạn tần suất nằm trong bộ nhớ của từng tiến trình API; bản nháp luôn theo ngôn ngữ cuộc họp.
