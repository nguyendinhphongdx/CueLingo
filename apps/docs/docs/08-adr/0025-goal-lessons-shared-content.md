# 0025 · Bài học theo mục tiêu: nội dung AI dùng chung, câu luyện gửi tới Gemini

**Trạng thái:** Accepted · 2026-11-22 (chủ sản phẩm đồng ý trong phiên làm việc)

## Bối cảnh

Khoá sinh từ cuộc họp ([hồ sơ learning-path](../06-delivery/2026-11-21-learning-path/01-specs.md)) chỉ liệt kê cụm từ, chưa phải bài học. Chủ sản phẩm muốn bài học chi tiết theo mục tiêu người dùng chọn, mỗi bài có tình huống kèm mẫu câu, hội thoại mẫu có audio, phần luyện câu của chính người dùng và kiểm tra cuối bài. Nội dung do AI sinh qua `@cuelingo/ai-gateway`. Hai điều mới so với hiện tại: nội dung AI **được lưu và dùng chung** giữa người dùng, và **câu người dùng gõ** được gửi đi để nhận góp ý. Chi tiết ở [hồ sơ goal-lessons](../06-delivery/2026-11-22-goal-lessons/02-plan.md).

## Quyết định

- **Bảng nội dung dùng chung `lesson_contents` không có `user_id`.** Khoá theo (mục tiêu, bài, trình độ, ngôn ngữ), kèm `prompt_version`, `model`, `revision`. Đầu vào của prompt sinh bản chung chỉ gồm khoá trong catalog, trình độ và ngôn ngữ (kiểm bằng type); không có dữ liệu người dùng.
- **Sinh khi người dùng mở bài lần đầu**, không dùng job nền. Người học ghim bản đã mở; đổi prompt tạo phiên bản mới, bản cũ vẫn phục vụ người đã ghim. Audio hội thoại cache chung.
- **Cá nhân hoá nông:** một lời gọi nhỏ thêm 2–3 câu ví dụ dùng thuật ngữ trong Kho cụm từ của người dùng. Phần này lưu ở bảng có `user_id` và bị xoá khi xoá dữ liệu cá nhân.
- **Câu người dùng gõ ở phần luyện** gửi tới Google Gemini qua `ai-gateway` (cùng nhà cung cấp với `assist.compose`, không thêm nhà cung cấp mới). **Không lưu, không log nội dung** (chỉ id, số lượng, độ trễ). Giao diện có dòng cảnh báo dưới ô gõ.
- **Kiểm soát chất lượng:** kiểm schema và nội dung, thử lại một lần, bài hỏng không lưu; bộ eval chặn trước khi bật; nút "Báo bài sai", từ 3 người báo thì loại bài.
- **Chi phí:** hai metric hạn mức mới theo ngày (`lessons_daily`, `lesson_practice_daily`), chỉ trừ sau khi AI chạy thành công, áp dụng [ADR 0022](./0022-usage-survives-data-delete.md).

## Phương án đã cân nhắc

| Phương án                                      | Vì sao không chọn                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A. Sinh riêng từng người lúc mở                | Đắt hơn khoảng 5 lần (khoảng 0,14 USD một khoá so với 0,025 USD), mỗi người mới chờ 15–25 giây, eval không phủ được       |
| C. Job nền sinh trước cả khoá khi đặt mục tiêu | Trả tiền cho bài không bao giờ mở, thêm job và trạng thái "đang sinh"; nếu chờ lần đầu thành vấn đề thì thêm job làm nóng |
| Soạn bài thủ công, AI chỉ chọn                 | Cần người soạn và công cụ quản lý, ngoài phạm vi (spec loại vai giảng viên)                                               |

## Hệ quả

- Thêm một migration (4 bảng, đổi `CHECK` của `usage_counters.metric`); chỉ thêm file mới.
- Xoá dữ liệu cá nhân xoá mục tiêu, tiến độ, ví dụ riêng và báo lỗi, nhưng **không** xoá `lesson_contents` vì đó không phải dữ liệu cá nhân.
- Trang chính sách quyền riêng tư phải nêu việc gửi câu luyện và thuật ngữ tới Gemini.
- Người đầu tiên mở mỗi ô chờ khoảng 15–25 giây; cá nhân hoá nông hơn phương án A.
- Giá TTS dùng để ước lượng là giá công khai, cần đối chiếu với `ai_call` thật sau khi chạy.
- Chỉ tiếng Anh, chỉ luyện gõ ở bản đầu; chấm phát âm và roleplay vẫn ở Đợt 3–4.
- Muốn đổi sang sinh riêng từng người hoặc thêm nhà cung cấp AI khác thì viết ADR mới thay ADR này.
