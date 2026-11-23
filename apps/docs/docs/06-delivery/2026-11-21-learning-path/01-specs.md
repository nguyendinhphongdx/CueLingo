# learning-path — Lộ trình học theo kiểu LMS, sinh từ cuộc họp

| Trạng thái | Loại    | Nhánh / PR                                   | Ước lượng → thực tế |
| ---------- | ------- | -------------------------------------------- | ------------------- |
| Xong       | feature | `feat/learning-path` (chưa có code, chưa PR) | _? → ?_             |

**Phạm vi:** trong: một lớp "lộ trình" mỏng phía trên Phrase Bank và ôn FSRS hiện có: khoá, bài, tiến độ hoàn thành, do hệ thống sinh từ cuộc họp và lịch của chính người dùng · ngoài: giáo trình biên soạn sẵn, bài kiểm tra có điểm và chứng chỉ, vai giảng viên/quản lý L&D, giao khoá cho nhóm (đó là LMS doanh nghiệp, hạng mục B2B Đợt 4), roleplay và chấm phát âm (Đợt 3–4).

## 1. Vấn đề

Phần học hiện là một vòng lặp rời rạc: lưu cụm từ vào Phrase Bank, ôn thẻ FSRS đến hạn, xem tiến độ theo tuần. Người dùng **không có đích đến hay cảm giác đi hết một chặng**: không biết hôm nay học gì để chuẩn bị cho cuộc họp sắp tới, một cuộc họp vừa xong "dạy" họ được gì, hay mình đã hoàn thành phần nào. Thẻ đến hạn không gắn với việc gì họ sắp phải làm. Kết quả dự kiến: số phiên ôn mỗi tuần thấp (giả thuyết H3 trong [Phạm vi MVP](../../02-product/03-mvp-scope.md)) vì không có điểm kết thúc và không thấy liên hệ với công việc.

Người chịu ảnh hưởng: persona gốc (kỹ sư/PM outsourcing họp hằng tuần với khách nước ngoài) và người chuẩn bị onsite có hạn chót rõ ràng ([users](../../01-overview/03-users.md)).

Giới hạn của sản phẩm cần giữ: nội dung học phải **lấy từ chính cuộc họp của người dùng**, không biến CueLingo thành app khoá học có giáo trình chung.

- **Spec liên quan:** [Phạm vi MVP](../../02-product/03-mvp-scope.md) (F5, F6), [Lộ trình sản phẩm](../../02-product/04-roadmap.md) (Planner, Daily Mix), [ADR README](../../08-adr/README.md)
- **Module chạm tới (dự kiến, xác nhận ở plan):** `04-modules/03-api/phrases-review.md`, `04-modules/03-api/learner.md`, `04-modules/05-packages/learner-model.md`, `04-modules/02-web/review.md`, `04-modules/02-web/progress.md`, `04-modules/02-web/debrief.md`

## 2. Tiêu chí chấp nhận (EARS)

| #    | AC                                                                                                                                                                                              | Test (dự kiến)                                |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| AC1  | WHEN debrief của một cuộc họp xong THE SYSTEM SHALL tạo một khoá (lộ trình) gắn với cuộc họp đó, gồm danh sách bài có thứ tự lấy từ cụm từ, đoạn khó và câu "nên nói" của chính họp.            | api: tạo khoá từ debrief                      |
| AC2  | WHEN lịch có cuộc họp sắp tới và người dùng đã bật gợi ý từ lịch THE SYSTEM SHALL gợi ý một khoá "chuẩn bị họp" từ thuật ngữ và các cuộc họp trước cùng chủ đề; không tự tạo nếu không có lịch. | api: gợi ý khoá theo lịch                     |
| AC3  | THE SYSTEM SHALL cho mỗi bài một trạng thái (`chưa học`, `đang học`, `xong`) và cho mỗi khoá tỷ lệ hoàn thành tính từ trạng thái các bài.                                                       | `learner-model` thuần: tính tiến độ khoá      |
| AC4  | WHEN người dùng hoàn thành một bài THE SYSTEM SHALL ghi kết quả qua cùng đường event hiện có để FSRS và Learner Model cập nhật; không tạo một bộ chấm điểm thứ hai.                             | api: bài xong sinh đúng event, FSRS đổi       |
| AC5  | THE SYSTEM SHALL dùng lại ba dạng bài ôn hiện có (nghe → chọn nghĩa, nghĩa → nói/gõ, nghe câu → điền từ) làm bài của khoá; dạng bài mới ngoài phạm vi.                                          | web: bài khoá render bằng ReviewCard          |
| AC6  | WHEN người dùng mở mục học THE SYSTEM SHALL hiện "việc nên làm tiếp" (bài kế tiếp của khoá đang học) và danh sách khoá cùng tiến độ, trên cả web và desktop từ một component dùng chung.        | web: trang lộ trình; ui: shared-ui test       |
| AC7  | THE SYSTEM SHALL lọc mọi khoá, bài và tiến độ theo `userId` lấy từ auth context; người dùng A không đọc hay sửa được khoá của B.                                                                | api: test ranh giới người dùng                |
| AC8  | WHEN người dùng xoá cuộc họp hoặc dữ liệu cá nhân THE SYSTEM SHALL xoá hoặc ẩn khoá và bài sinh từ nội dung đó, không để lại câu gốc.                                                           | api: xoá phiên kéo theo khoá                  |
| AC9  | IF việc sinh khoá cần gọi AI THEN THE SYSTEM SHALL qua `@cuelingo/ai-gateway` với prompt có phiên bản, tính vào hạn mức, và khi lỗi thì vẫn hiện Phrase Bank/ôn tập như trước.                  | ai-gateway: task có eval; api: lỗi không chặn |
| AC10 | THE SYSTEM SHALL không ghi log nội dung câu, audio hay tên người; chỉ ghi id, số lượng, trạng thái.                                                                                             | api: kiểm log                                 |

## 3. Câu hỏi mở

- [x] **Hướng:** lộ trình mỏng sinh từ cuộc họp, không phải LMS đầy đủ (người dùng chọn 2026-11-21).
- [x] **Thuộc đợt nào?** Xếp vào Đợt 1 của roadmap, không chen vào MVP beta (người dùng chọn 2026-11-21).
- [ ] **Một khoá dài bao nhiêu bài, bao lâu?** Đề xuất ở plan (ví dụ 5–10 bài, ≤ 15 phút mỗi lần); cần người dùng chốt ngưỡng.
- [ ] **Ai quyết thứ tự bài:** thuật toán thuần (FSRS + độ khó) hay AI? Ảnh hưởng chi phí và AC9.
- [ ] **Có cần ADR không?** Khoá/bài là thực thể dữ liệu mới (migration) và có thể là một điểm mở rộng mới; plan sẽ nêu ≥ 2 phương án và đề xuất ADR nếu không vừa ô nào trong [extension points](../../05-engineering/01-extension-points.md).
- [ ] **Hoàn thành khoá có "ăn mừng"/huy hiệu không**, hay chỉ tỷ lệ phần trăm? (Đề xuất: chỉ tỷ lệ, tránh game hoá khi chưa có số đo.)
- [ ] **Desktop:** có mục lộ trình trong app desktop ngay, hay web trước và desktop chỉ hiện "việc nên làm tiếp"?

## Decision log

| Ngày       | Pha     | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                                                                             |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-21 | Spec    | Mở hồ sơ theo yêu cầu "phần học giống một hệ thống LMS". Đã nêu bốn hướng; người dùng chọn lộ trình mỏng từ cuộc họp. Không làm giáo trình có sẵn, vai giảng viên hay chứng chỉ.                                                                                                                                                          |
| 2026-11-21 | Spec    | Cổng SPEC được duyệt. Người dùng chọn xếp vào Đợt 1, không làm trước beta. Các câu hỏi còn mở (độ dài khoá, ai quyết thứ tự bài, ADR, huy hiệu, desktop) giải ở plan.                                                                                                                                                                     |
| 2026-11-21 | Plan    | Cổng PLAN được duyệt: phương án B (khoá tính lúc đọc, không bảng mới, không AI, không ADR) và các mặc định của plan (3–10 bài mỗi khoá, tối đa 5 bài mỗi lần, thứ tự do thuật toán, chỉ hiện %, tab Lộ trình trên web và desktop, khoá chuẩn bị họp chỉ desktop, "Bắt đầu khoá" thêm cụm vào Kho cụm từ, đoạn khó chỉ đẩy cụm lên trước). |
| 2026-11-21 | Kết quả | Cổng RESULT được duyệt. Chấp nhận lệch AC8: sau khi xoá mềm phiên, câu gốc của cụm đã thêm vào Kho cụm từ còn tới khi `retention.sweep` chạy (tối đa 7 ngày), theo chính sách Phrase Bank hiện có. Chưa chạy integration test trên Postgres thật và chưa bấm thử UI.                                                                      |
