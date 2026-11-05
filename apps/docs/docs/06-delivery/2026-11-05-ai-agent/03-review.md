# Review — ai-agent (Lô 1)

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                                                                     | Chi tiết (lý do nếu khác plan)                                                                 |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| 🟢 ADDED    | ADR 0018, 0019; `packages/agent`; `agent.dto.ts`; gateway `chat()`; prompt `agent/v1`                                              | Đúng plan bước 1–6                                                                             |
| 🟢 ADDED    | migration `20261109090000_agent_conversations`, `20261110090000_agent_streaming_index`                                             | Migration thứ hai (index một phần cho tin `streaming`) do review đề xuất                       |
| 🟢 ADDED    | module `conversations`, `agent` (SSE, quota, plugin `core`); core-sdk `conversations`/`agent`/`stream()`; UI chat; web `assistant` | Đúng plan bước 7–13                                                                            |
| 🟡 MODIFIED | review/phrases (`context_text`), privacy (export/xoá/retention), `ai-calls` (token), `errors.ts`                                   | Chỗ rủi ro: SQL `COALESCE` và xoá dữ liệu. Đã chạy integration trên Postgres thật              |
| 🟡 MODIFIED | `roadmap.ts`: `assistant` web `ready`                                                                                              | Plan để `soon` tới bước 14; nav cần `ready`                                                    |
| 🟡 MODIFIED | khoá lượt theo **người dùng** (không theo hội thoại)                                                                               | Sửa lỗ quota song song do review tìm ra; kèm trần 8 lần gọi công cụ mỗi lượt                   |
| ➕ NGOÀI    | `4ff0161` nút "Tiếp theo" ở ôn tập trắc nghiệm                                                                                     | Người dùng báo không thấy cách sang câu; không thuộc hồ sơ này                                 |
| 🔴 HOÃN     | Lô 2 (registry bật/tắt, cầu dao, plugin `exercise`, admin) và Lô 3 (HTML/JS sandbox)                                               | Theo quyết định cổng PLAN. AC7–9, AC16–17 mới đạt phần cơ bản (đăng ký/gỡ, cô lập lỗi `setup`) |

**Docs đã cập nhật:** ADR 0018/0019, extension-points, `04-modules` (shared, ai-gateway, prompts, agent, core-sdk, ui, conversations, agent API, phrases-review, privacy, retention, web assistant), data-model, security-privacy, glossary.

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md): ✅ Ranh giới & bảo mật · ✅ Hợp đồng · ✅ Kiến trúc · ✅ AI · ✅ Test · ✅ Docs · ✅ Phạm vi (trừ commit nút "Tiếp theo")

```bash
pnpm verify          # xanh: 1358 test, depcruise sạch
pnpm test:int        # (Node 23.8) 18 file / 60 test xanh trên Postgres thật
```

Đã chạy thật (web + API + Gemini thật): chat stream, bước công cụ "Đã tạo thẻ", thẻ flashcard lật được, bảng Markdown, nhấp đúp vào từ → Tra nghĩa/Nghe/Lưu, "Lưu" vào Cụm từ (đang ôn) rồi hiện "Đã lưu", tải lại vẫn còn hội thoại. Migration up/down/up chạy được.

**Chưa thử tay:** nút Dừng giữa chừng, thông báo vượt quota, nút Nghe, chạy trên trình duyệt di động. Review độc lập (agent `code-reviewer`) đã chạy; mọi mục 🔴/🟡 đã sửa.

## Cho người review — đọc theo thứ tự

| #   | File                                                                  | Soi gì                                                                        |
| --- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | `services/api/src/modules/agent/agent.service.ts`                     | Khoá theo người dùng, quota trước khi stream, nhả khoá, lỗi không rò nội dung |
| 2   | `packages/agent/src/loop.ts`, `tools.ts`                              | Trần bước/công cụ, timeout, tool lỗi ra `ok:false`                            |
| 3   | `packages/ui/src/components/markdown-view.tsx`, `agent-card-view.tsx` | Không HTML thô, không ảnh ngoài, link an toàn                                 |
| 4   | `services/api/src/modules/privacy/privacy.repository.ts`              | Xoá sạch `agent_*`; xoá dữ liệu cũng đặt lại quota (đã ghi trong `agent.md`)  |
| 5   | `apps/web/src/features/assistant/use-chat.ts`                         | Chuyển địa chỉ chỉ sau khi lượt đầu xong                                      |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                    | Tìm ở              | Sửa                                                   |
| ---------------------------------------------------------------------- | ------------------ | ----------------------------------------------------- |
| Hội thoại mới: chuyển địa chỉ làm trang tải lại, huỷ stream giữa chừng | Chạy thật trên web | `onCreated` gọi sau khi lượt kết thúc (`use-chat.ts`) |
| Test migrations lỗi thời (thêm 2 bảng)                                 | `pnpm test:int`    | Cập nhật danh sách bảng và thêm ca rollback           |
| Tạo nhiều hội thoại gửi song song vượt trần quota                      | Review độc lập     | Khoá một lượt/người dùng + test song song             |
| Bấm Dừng sát lúc xong không bị tính token                              | Review độc lập     | Ghi token ước lượng khi abort                         |
| Đọc 500 tin cũ nhất thay vì mới nhất                                   | Review độc lập     | `ORDER BY seq DESC LIMIT 500` rồi đảo lại             |
| Công cụ đọc không có trần mỗi lượt                                     | Review độc lập     | `maxToolCalls = 8`                                    |
| Đóng kết nối sớm vẫn để lượt chạy                                      | Review độc lập     | Gắn listener trước `await`, huỷ stream nếu đã đóng    |

## Còn lại cho người

- `AGENT_ENABLED` mặc định `true`; production nên đặt `false` tới khi sẵn sàng mời tester.
- Cập nhật chính sách quyền riêng tư và mẫu đồng ý beta (có lưu hội thoại, gửi cho Gemini); chưa có trang chính sách trong repo.
- Đặt model có giá trong `MODEL_PRICES` (nếu không, trần USD không có tác dụng).
- Lô 2 và 3 chờ số liệu dùng thật.
