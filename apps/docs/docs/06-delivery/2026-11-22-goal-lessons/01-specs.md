# goal-lessons — Bài học chi tiết theo mục tiêu của người dùng

| Trạng thái | Loại    | Nhánh / PR                                                    | Ước lượng → thực tế |
| ---------- | ------- | ------------------------------------------------------------- | ------------------- |
| Làm        | feature | `feat/goal-lessons` (tách từ `feat/learning-path`, chưa push) | _? → ?_             |

**Phạm vi:** trong: người dùng chọn mục tiêu từ một danh sách có sẵn, hệ thống sinh bài học chi tiết cho mục tiêu đó bằng AI theo một khung cố định, người dùng học và được kiểm tra · ngoài: chấm phát âm và roleplay (Đợt 3–4), người soạn bài thủ công và công cụ giảng viên, bài kiểm tra có điểm và chứng chỉ, giao khoá cho nhóm (B2B Đợt 4), mục tiêu nhập tự do.

## 1. Vấn đề

Khoá "chuẩn bị họp" của [learning-path](../2026-11-21-learning-path/01-specs.md) chỉ là danh sách cụm từ lấy từ cuộc họp đã qua. Nó không **dạy** gì: không có tình huống, không có mẫu câu để nói, không có chỗ luyện, không có kiểm tra. Người dùng cũng không có cách nói "tôi cần làm được gì": họ có hạn chót rõ ràng (họp demo tuần sau, phỏng vấn, onsite) nhưng sản phẩm chỉ học được từ quá khứ. Người ít họp thì gần như không có gì để học.

Người chịu ảnh hưởng: kỹ sư/PM outsourcing có việc sắp tới, và người chuẩn bị onsite hay định cư với mốc thời gian ([users](../../01-overview/03-users.md)).

Ràng buộc cần giữ: bài phải sát người học (trình độ, thuật ngữ đã có), không biến CueLingo thành app khoá học chung chung; mọi lời gọi AI qua `@cuelingo/ai-gateway` với prompt có phiên bản; người dùng không phải đợi mới học được.

- **Spec liên quan:** [learning-path](../2026-11-21-learning-path/01-specs.md), [Phạm vi MVP](../../02-product/03-mvp-scope.md), [Lộ trình sản phẩm](../../02-product/04-roadmap.md) (Planner)
- **Module chạm tới (dự kiến, xác nhận ở plan):** `04-modules/03-api/courses.md`, `04-modules/03-api/learner.md`, `04-modules/03-api/tts.md`, `04-modules/05-packages/prompts.md`, `04-modules/05-packages/ai-gateway.md`, `04-modules/05-packages/learner-model.md`, `04-modules/02-web/review.md`, `04-modules/06-ml`

## 2. Tiêu chí chấp nhận (EARS)

| #    | AC                                                                                                                                                                                         | Test (dự kiến)                                        |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| AC1  | THE SYSTEM SHALL cho người dùng chọn một đến ba mục tiêu từ danh sách có sẵn (định nghĩa ở `@cuelingo/shared`) và tuỳ chọn một hạn chót; sửa hoặc xoá mục tiêu được bất cứ lúc nào.        | shared: schema mục tiêu; api: lưu và sửa              |
| AC2  | WHEN người dùng đặt một mục tiêu THE SYSTEM SHALL tạo một khoá gồm các bài sinh cho mục tiêu đó, có thứ tự, hiện ngay danh sách bài (tiêu đề) và sinh nội dung chi tiết từng bài khi cần.  | api: tạo khoá theo mục tiêu                           |
| AC3  | THE SYSTEM SHALL dựng mỗi bài theo đúng bốn phần: tình huống kèm mẫu câu, hội thoại mẫu có audio, phần luyện câu của chính người dùng, kiểm tra cuối bài.                                  | shared: schema bài; ui: render đủ bốn phần            |
| AC4  | WHEN AI sinh nội dung bài THE SYSTEM SHALL kiểm đầu ra theo schema Zod và loại bỏ hoặc sinh lại nội dung sai cấu trúc; không bao giờ hiện bài thiếu phần.                                  | ai-gateway: task có schema; api: bài hỏng không lộ ra |
| AC5  | THE SYSTEM SHALL cá nhân hoá bài theo trình độ nghe/nói và thuật ngữ trong Kho cụm từ của người dùng, và ghi phiên bản prompt đã dùng cho mỗi bài.                                         | prompts: có phiên bản; api: ghi vào bài               |
| AC6  | WHEN người dùng gõ một câu ở phần luyện THE SYSTEM SHALL trả góp ý (đúng/sai ngữ pháp, câu tự nhiên hơn, mức trang trọng) trong p95 ≤ 5 giây, qua `@cuelingo/ai-gateway`.                  | api: luyện câu; ai-gateway: task                      |
| AC7  | WHEN người dùng làm bài kiểm tra cuối bài THE SYSTEM SHALL ghi kết quả bằng event vào Learner Model và FSRS (cùng đường event hiện có), và đánh dấu bài xong khi đạt ngưỡng đã định.       | api: event, tiến độ; learner-model: ngưỡng            |
| AC8  | THE SYSTEM SHALL tính tiến độ khoá và hiện bài kế tiếp trong cùng khung "Lộ trình" hiện có, cạnh các khoá sinh từ cuộc họp, trên web và desktop.                                           | ui: panel hiện cả hai loại khoá                       |
| AC9  | WHEN hết hạn mức AI hoặc AI lỗi THE SYSTEM SHALL vẫn mở được các bài đã sinh và hàng đợi ôn như trước, báo bằng tiếng Việt rằng bài mới chưa sinh được, và không tính hạn mức cho lần lỗi. | api: lỗi AI không chặn; usage: không trừ              |
| AC10 | THE SYSTEM SHALL tính chi phí AI vào hạn mức theo người dùng và giới hạn số bài sinh mỗi ngày; mỗi nội dung đã sinh được lưu để dùng lại, không sinh lại khi mở lại bài.                   | usage: trừ đúng; api: dùng lại bản đã lưu             |
| AC11 | THE SYSTEM SHALL lọc mọi mục tiêu, khoá, bài, câu luyện và kết quả theo `userId` lấy từ auth context; người dùng A không đọc hay sửa được dữ liệu của B.                                   | api: test ranh giới người dùng                        |
| AC12 | THE SYSTEM SHALL xoá câu người dùng đã gõ và kết quả khi họ xoá dữ liệu cá nhân, và không ghi log nội dung câu, câu hỏi hay góp ý; chỉ ghi id, số lượng, trạng thái, độ trễ.               | api: xoá dữ liệu; log không có nội dung               |
| AC13 | THE SYSTEM SHALL có bộ eval cho task sinh bài (đúng cấu trúc, đúng mục tiêu, tiếng Anh đúng ngữ pháp, tiếng Việt tự nhiên) và không đổi prompt đã dùng mà không tăng phiên bản.            | `ml/eval`: bộ mẫu và ngưỡng                           |

## 3. Câu hỏi mở

- [x] **Mục tiêu:** chọn từ danh sách có sẵn (người dùng chọn 2026-11-22).
- [x] **Nguồn bài:** AI sinh theo mục tiêu, khung cố định (người dùng chọn 2026-11-22).
- [x] **Cấu trúc bài:** tình huống kèm mẫu câu, hội thoại mẫu có audio, luyện nói/gõ câu của mình, kiểm tra cuối bài (người dùng chọn 2026-11-22).
- [ ] **Danh sách mục tiêu ban đầu** gồm những gì? Đề xuất 6–8 mục tiêu gắn persona (họp stand-up, demo/trình bày, họp tiến độ với khách, đàm phán, phỏng vấn, onsite, small talk, viết email họp); cần người dùng chốt.
- [ ] **Sinh ở đâu và khi nào:** sinh nội dung chi tiết từng bài lúc người dùng mở lần đầu (chậm nhưng rẻ) hay sinh trước bằng job nền khi đặt mục tiêu (nhanh nhưng tốn hơn)? Đề xuất ở plan.
- [ ] **Bài dùng chung hay riêng từng người?** Cá nhân hoá hoàn toàn thì đắt và không tái dùng được; đề xuất khung dùng chung theo (mục tiêu × trình độ) rồi điền ví dụ riêng.
- [ ] **"Luyện nói":** MVP chỉ gõ câu, hay cho nói qua nhận dạng giọng nói có sẵn (chấm phát âm vẫn ngoài phạm vi)? Cần quyết trước khi plan.
- [ ] **Chất lượng nội dung AI:** có cần bước duyệt (người xem mẫu, cờ báo lỗi từ người dùng, bộ eval chặn trước khi phát hành)? Đề xuất tối thiểu là eval ở AC13 cộng nút "Báo bài sai".
- [ ] **Ngưỡng hoàn thành bài** (ví dụ ≥ 70% câu kiểm tra) và có cho làm lại không.
- [ ] **ADR:** bảng mới (mục tiêu, khoá, bài, kết quả), nội dung do AI sinh được lưu và có thể dùng chung giữa người dùng, và câu của người dùng gửi tới nhà cung cấp AI hiện có; plan sẽ nêu ≥ 2 phương án và dự thảo ADR.
- [ ] **Quyền riêng tư:** câu người dùng gõ gửi tới nhà cung cấp AI đã được chấp thuận (không thêm nhà cung cấp mới); cần xác nhận cách nói rõ điều này trong giao diện.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                                                            |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-22 | Spec | Mở hồ sơ sau khi người dùng nhận xét khoá của learning-path chưa phải bài học và đề nghị "lên plan tạo bài học theo mục tiêu, bài học cần chi tiết". Mở rộng phạm vi so với learning-path, vốn loại giáo trình soạn sẵn.                                                                                                 |
| 2026-11-22 | Spec | Người dùng chọn: mục tiêu từ danh sách có sẵn; AI sinh bài theo khung cố định; bài gồm tình huống + mẫu câu, hội thoại mẫu có audio, luyện câu của mình, kiểm tra cuối bài.                                                                                                                                              |
| 2026-11-22 | Spec | Cổng SPEC được duyệt. Các câu mở còn lại (danh sách mục tiêu, thời điểm sinh, dùng chung hay riêng, luyện nói, kiểm soát chất lượng, ngưỡng hoàn thành, ADR, cách nói về quyền riêng tư) do plan đề xuất phương án và mặc định, người dùng chốt ở cổng PLAN.                                                             |
| 2026-11-22 | Plan | Cổng PLAN được duyệt: phương án B (nội dung dùng chung, sinh khi mở lần đầu) và mọi mặc định của plan (8 mục tiêu × 6 bài chỉ tiếng Anh, chỉ gõ, đạt 4/6, Free 2 bài + 20 câu luyện mỗi ngày, không lưu câu đã gõ, chưa đưa mục tiêu vào xuất dữ liệu, trình độ mặc định lấy từ trình độ nghe). ADR 0025 được chấp nhận. |
