# 0027 · Trợ lý cùng họp: một lần gọi có truy hồi tất định, nội dung họp gửi tới Gemini để hỏi đáp

**Trạng thái:** Accepted · 2026-11-27 · duyệt cùng [plan meeting-assistant](../06-delivery/2026-11-27-meeting-assistant/02-plan.md)

## Bối cảnh

Người dùng cần hỏi về khái niệm, tên riêng hay việc đã bàn ngay trong cuộc họp ([spec](../06-delivery/2026-11-27-meeting-assistant/01-specs.md)), chữ đầu tiên p95 ≤ 5 giây. Đây là **mục đích mới** khi gửi nội dung họp (gồm lời người khác) và dữ liệu cuộc họp cũ tới nhà cung cấp AI, và là một loại dữ liệu lưu mới. Harness agent ([ADR 0018](./0018-agent-harness.md)) cần ít nhất hai bước mô hình khi dùng công cụ.

## Quyết định

- **Một lời gọi stream, không công cụ** (task `meeting.ask`, qua `@cuelingo/ai-gateway`, vẫn là Google Gemini; không thêm nhà cung cấp). Server gom ngữ cảnh theo luật tất định; mô hình không chọn dữ liệu.
- **Dữ liệu gửi đi** (khoảng 6k token, đánh dấu là dữ liệu không tin cậy): câu hỏi; đoạn cuối và đoạn khớp của cuộc họp đang chạy; thuật ngữ, cụm từ khớp; trích đoạn khớp của tối đa 3 cuộc họp cũ chưa xoá; 3 cặp hỏi đáp trước. Không gửi audio.
- **Tìm cuộc họp cũ bằng khớp từ khoá trong Postgres** (có giới hạn và hạn giờ). Không embedding, không thêm extension.
- **Server kiểm nhãn nguồn:** chỉ hiện nguồn đã được lấy ra và được trích; không có thì ghi "Kiến thức chung (chưa kiểm chứng)".
- **Đồng ý riêng, lưu ở server**, kiểm trước mọi lời gọi, rút lại được.
- **Lưu hỏi đáp theo cuộc họp**: xoá cùng cuộc họp và cùng "Xoá dữ liệu", xuất khi client yêu cầu. Không đưa nội dung vào log hay `ai_call`.
- **Chi phí:** hạn mức ngày `meeting_ask_daily` theo gói; cờ `MEETING_ASSIST_ENABLED` mặc định tắt.

## Phương án đã cân nhắc

| Phương án                                    | Vì sao không chọn                                                                                |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Plugin trên harness agent                    | Hai bước mô hình, chậm và tốn gần gấp đôi; chỉ dẫn trong transcript lái được việc đọc dữ liệu cũ |
| Client tự gom 15 câu và kết quả tìm trên máy | Không đủ cả cuộc họp, không lưu được                                                             |
| Full-text Postgres hoặc `pg_trgm`            | Full-text không tách từ Nhật, Trung, Hàn; `pg_trgm` thêm extension, chưa cần ở quy mô beta       |
| Embedding (pgvector)                         | Thêm tác vụ AI và chi phí cho mọi câu; để dành khi từ khoá không đủ                              |

## Hệ quả

- Một migration (hai bảng, một ràng buộc đổi). Chính sách quyền riêng tư phải nêu việc gửi nội dung họp và cuộc họp cũ khi người dùng hỏi, và việc lưu hỏi đáp. Giao diện nhắc người dùng thông báo cho người dự họp.
- Tìm cuộc họp cũ chỉ ở mức từ khoá. Đổi sang embedding, tài liệu người dùng đưa vào hay tra web: mỗi thứ một ADR mới.
- Đồng ý là của người dùng, không phải của người dự họp khác.
