# ai-agent — Trợ lý AI dạng agent, giao diện sinh động, học không cần họp

| Trạng thái | Loại    | Nhánh / PR      | Ước lượng → thực tế |
| ---------- | ------- | --------------- | ------------------- |
| Spec       | feature | `feat/ai-agent` | ~3–4 tuần → ?       |

**Phạm vi:** trong: một trợ lý AI trò chuyện (web trước, desktop dùng lại), vòng lặp agent có công cụ và "đang nghĩ", đầu ra là Markdown hoặc giao diện tương tác do AI sinh ra chạy trong hộp cát, lưu hội thoại tự động, nhấp đúp vào từ để tra và lưu vào Cụm từ/Ôn tập, kiến trúc plugin ghép lúc chạy · ngoài: giọng nói hai chiều (voice mode), chấm phát âm, roleplay có chấm điểm, plugin của bên thứ ba chưa được duyệt, thanh toán, mọi thứ của Đợt 1 trở đi.

## 1. Vấn đề

Chủ sản phẩm chỉ ra: ôn tập hiện chỉ có nguồn là các cụm từ lưu sau cuộc họp. Người dùng không họp, hoặc ít họp, thì không có gì để học. Họ cần một chỗ để **chủ động học và hỏi**: trao đổi theo chủ đề mình chọn, được giải thích, được luyện, và lưu lại những gì đáng nhớ mà không phải rời cuộc trò chuyện.

Hôm nay:

- Không có nơi nào để hỏi AI tự do. AI chỉ xuất hiện trong khung hẹp: tra từ, tóm tắt 60 giây, soạn câu, debrief, follow-up. Mỗi tác vụ là một lời gọi một lần, không có bộ nhớ hội thoại, không có công cụ, không tự chọn bước tiếp theo.
- Đầu ra AI chỉ là văn bản cố định. Không thể cho ra một bài tập tương tác, bảng so sánh, thẻ từ, hay biểu đồ mà người dùng thao tác được.
- Thêm từ vào Cụm từ/Ôn tập chỉ làm được từ debrief hoặc Quick Assist trong họp; không có thao tác "nhấp đúp vào một từ rồi lưu" ở nơi người dùng đang đọc.
- Hạ tầng AI hiện tại (`@cuelingo/ai-gateway`) là từng tác vụ riêng, nên thêm khả năng mới nghĩa là sửa lõi, không phải cắm thêm.

- **Spec liên quan:** [Phạm vi MVP](../../02-product/03-mvp-scope.md) (F3 Quick Assist, F5 Phrase Bank + ôn tập; "roleplay", "voice mode" đang ngoài phạm vi), [ADR 0013](../../08-adr/0013-multi-language.md), [ai-gateway](../../04-modules/05-packages/ai-gateway.md)
- **Module chạm tới:** `ai-gateway`, `prompts`, `shared`, `core-sdk`, `ui`; api (module mới `agent`, `conversations`; `phrases-review`), web (`chat` mới, `phrase-bank`, `review`), desktop (dùng lại thành phần), DB (bảng hội thoại, tin nhắn). **Nhạy cảm:** schema DB, nhà cung cấp/tác vụ AI mới, chạy mã do AI sinh ra, dữ liệu người dùng (hội thoại), chi phí.

## 2. Tiêu chí chấp nhận (EARS)

### Hội thoại và agent

| #   | AC                                                                                                                                                                                      | Test |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AC1 | WHEN người dùng gửi tin nhắn THE SYSTEM SHALL phát câu trả lời theo luồng (từng đoạn) và hiện trạng thái "đang nghĩ" trước khi có chữ đầu tiên                                          |      |
| AC2 | WHILE agent chạy THE SYSTEM SHALL cho phép dừng giữa chừng, và phần đã sinh ra được giữ lại                                                                                             |      |
| AC3 | WHEN agent cần thông tin hoặc hành động ngoài hội thoại (tra từ, đọc cụm từ đã lưu, lưu cụm từ, tạo bài tập) THE SYSTEM SHALL gọi một công cụ đã đăng ký và hiện bước đó cho người dùng |      |
| AC4 | IF một công cụ lỗi hoặc quá hạn THEN THE SYSTEM SHALL báo ngắn gọn bằng tiếng Việt, agent tiếp tục hoặc dừng có kiểm soát, và không lặp vô hạn (có trần số bước mỗi lượt)               |      |
| AC5 | THE SYSTEM SHALL giữ ngữ cảnh của hội thoại qua các lượt, và cắt bớt ngữ cảnh cũ theo một quy tắc xác định khi vượt ngân sách token                                                     |      |

### Đầu ra: Markdown và giao diện sinh động

| #   | AC                                                                                                                                                                                                                     | Test |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AC6 | THE SYSTEM SHALL hiển thị câu trả lời Markdown (tiêu đề, danh sách, bảng, mã) mà không chạy bất cứ thứ gì trong đó                                                                                                     |      |
| AC7 | WHEN agent trả về một khối giao diện tương tác (HTML/JS, ví dụ bài tập điền từ, thẻ lật, bảng so sánh) THE SYSTEM SHALL chạy nó trong hộp cát cách ly: không đọc được cookie, token, DOM của app, không gọi mạng tự do |      |
| AC8 | IF khối giao diện vi phạm hộp cát hoặc lỗi khi chạy THEN THE SYSTEM SHALL ngừng nó, hiện thông báo và nút "Xem mã nguồn", không làm hỏng phần còn lại của hội thoại                                                    |      |
| AC9 | WHEN khối giao diện cần dữ liệu hoặc hành động của app (lưu từ, đọc cụm từ) THE SYSTEM SHALL chỉ cho qua một cầu nối có danh sách thao tác cho phép, có xác nhận của người dùng với thao tác ghi                       |      |

### Lưu từ và công cụ trong lúc đọc

| #    | AC                                                                                                                                                           | Test |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| AC10 | WHEN người dùng nhấp đúp vào một từ trong tin nhắn THE SYSTEM SHALL mở menu ngữ cảnh gồm ít nhất: Tra nghĩa, Nghe phát âm, Lưu vào Cụm từ                    |      |
| AC11 | WHEN người dùng chọn "Lưu" THE SYSTEM SHALL lưu từ cùng câu chứa nó làm ngữ cảnh vào Cụm từ, đưa vào lịch ôn FSRS và hiện "Đã lưu" ngay, không rời hội thoại |      |
| AC12 | WHEN từ đã được lưu trước đó THE SYSTEM SHALL hiện "Đã lưu" thay vì "Lưu" và không tạo bản trùng                                                             |      |

### Lưu hội thoại, riêng tư, chi phí

| #    | AC                                                                                                                                                                | Test |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AC13 | THE SYSTEM SHALL lưu hội thoại tự động theo từng tin nhắn (không cần bấm lưu), liệt kê và mở lại được, và hội thoại chỉ đọc được bởi chủ của nó                   |      |
| AC14 | WHEN người dùng xoá một hội thoại hoặc xoá dữ liệu cá nhân THE SYSTEM SHALL xoá hội thoại cùng tin nhắn và khối giao diện của nó, theo cùng quy tắc xoá của US-15 |      |
| AC15 | THE SYSTEM SHALL giới hạn số lượt, số token và chi phí mỗi người mỗi ngày, ghi `ai_call` cho mỗi lần gọi mô hình, và IF vượt hạn THEN báo rõ thay vì lỗi chung    |      |

### Plugin và nền tảng agent

| #    | AC                                                                                                                                                                                                        | Test |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AC16 | THE SYSTEM SHALL cho một plugin khai báo công cụ, kiểu thẻ giao diện và quyền cần có qua một interface duy nhất, và nạp hoặc gỡ nó lúc chạy mà không sửa lõi agent                                        |      |
| AC17 | IF một plugin lỗi khi nạp hoặc khi chạy THEN THE SYSTEM SHALL cô lập lỗi trong plugin đó và agent vẫn trả lời được bằng các công cụ còn lại                                                               |      |
| AC18 | THE SYSTEM SHALL tách rõ bốn phần của agent (mô hình, ngữ cảnh, công cụ, vòng lặp "nghĩ → gọi công cụ → trả lời") để thay mô hình hoặc thêm công cụ không chạm các phần còn lại, và có test cho từng phần |      |

## 3. Câu hỏi mở

- [ ] **Mô hình:** dùng Gemini (đã có khoá và `ai-gateway`), Claude, hay cả hai qua gateway? "Thinking" lấy từ tóm tắt suy luận của mô hình hay chỉ là các bước công cụ? Đề xuất: Gemini trước qua gateway, hiển thị các bước công cụ và một dòng trạng thái, chưa hiển thị suy luận thô.
- [ ] **Giao diện AI sinh ra:** cho phép HTML/JS tuỳ ý trong `iframe sandbox` không có mạng (như artifact của ChatGPT/Claude) hay chỉ một bộ thẻ có sẵn do AI điền dữ liệu (JSON → thành phần của `@cuelingo/ui`)? Đề xuất: làm **cả hai theo hai lớp**, bộ thẻ có sẵn là mặc định an toàn, HTML/JS tuỳ ý là lớp thứ hai trong hộp cát và bật sau, vì đây là rủi ro bảo mật lớn nhất.
- [ ] **Chủ đề "trao đổi":** trợ lý nói chuyện về gì? Chỉ tiếng Anh cho công việc (giải thích từ, luyện câu, chuẩn bị họp), hay chủ đề mở bất kỳ? Đề xuất: bắt đầu quanh học tiếng Anh công sở và chuẩn bị cuộc họp, có thể mở rộng sau.
- [ ] **Plugin:** chỉ plugin của chính CueLingo (đóng gói trong repo, nạp lúc chạy) hay cho người dùng/bên ngoài cài? Đề xuất: chỉ plugin nội bộ trước; thiết kế interface đủ để mở ra sau, **không** nạp mã từ bên ngoài trong lô này.
- [ ] **Nơi chạy:** web trước (đã có đăng nhập, chat dễ làm), desktop dùng lại thành phần `@cuelingo/ui`. Đồng ý?
- [ ] **Phạm vi MVP:** mục này không có trong [Phạm vi MVP](../../02-product/03-mvp-scope.md) và nằm gần mục "roleplay" đang bị loại. Có mở rộng phạm vi chính thức không, và nó thay thế hay đứng sau việc chuẩn bị beta?
- [ ] **Chi phí:** trần mặc định mỗi người mỗi ngày là bao nhiêu (token và USD)? Beta 30–50 người, đề xuất trần cứng theo ngày và công tắc tắt toàn cục cho quản trị viên.
- [ ] **Lưu hội thoại:** giữ bao lâu, có dùng để cải thiện gợi ý học không? Đề xuất: giữ đến khi người dùng xoá, không dùng huấn luyện, nhà cung cấp AI không giữ dữ liệu (như yêu cầu phi chức năng hiện có).

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                                                                                                   |
| ---------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-05 | Spec | Mở hồ sơ. Chủ sản phẩm nói: ôn tập không nên chỉ lấy từ họp; muốn một trợ lý AI agent làm trung tâm, trao đổi chủ đề, đầu ra có thể là Markdown hoặc giao diện thật có JS (như ChatGPT), tự lưu hội thoại, nhấp đúp vào từ có menu ngữ cảnh và bookmark, AI dựng như agent (model, context, tool, thinking, harness rõ ràng), tính năng là plugin ghép lúc chạy |
