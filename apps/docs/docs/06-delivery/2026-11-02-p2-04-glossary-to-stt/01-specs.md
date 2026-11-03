# p2-04-glossary-to-stt — Nối thuật ngữ cá nhân vào nhận dạng giọng nói

| Trạng thái | Loại    | Nhánh / PR             | Ước lượng → thực tế |
| ---------- | ------- | ---------------------- | ------------------- |
| Spec       | feature | `feat/glossary-to-stt` | _1 ngày → ?_        |

**Phạm vi:** trong: desktop lấy thuật ngữ của người dùng và đưa cho bộ nhận dạng trên máy trong lúc họp; cập nhật khi thuật ngữ đổi; trang module desktop. · ngoài: thay đổi API glossary, đổi thuật toán sửa từ trong sidecar Swift (đã xong), chọn bộ thuật ngữ trước họp, thuật ngữ nhiều ngôn ngữ ngoài ngôn ngữ của cuộc họp hiện tại.

## 1. Vấn đề

Người dùng thêm thuật ngữ riêng (SLA, tên sản phẩm, tên đồng nghiệp) ở trang Thuật ngữ để caption nghe và dịch đúng. Hiện chỉ nửa đường chạy: prompt dịch đã nhận glossary, còn bộ nhận dạng trên máy thì **không bao giờ nhận được danh sách này** dù sidecar đã có lệnh `vocab` và bộ sửa `VocabularyCorrector` (có test). Kết quả: từ viết tắt và tên riêng vẫn bị nghe sai ở caption tiếng Anh gốc, rồi dịch sai theo. Tính năng "Nhận dạng giọng nói sửa đúng các từ này" ở trang Thuật ngữ đang hứa điều chưa có. Ảnh hưởng mọi người dùng có glossary, và chỉ tiêu "≥ 95% thuật ngữ glossary đúng" của MVP không đạt được.

- **Spec liên quan:** `apps/docs/docs/02-product/03-mvp-scope.md` (US-09), `apps/docs/docs/02-product/06-backlog.md` (P2-04)
- **Module chạm tới:** `apps/docs/docs/04-modules/01-desktop/local-stt.md`, `apps/docs/docs/04-modules/01-desktop/tauri-core.md`, `apps/docs/docs/04-modules/03-api/glossary.md`

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                                                                                                 | Test                                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| AC1 | WHEN một phiên họp bắt đầu và người dùng đã đăng nhập THE SYSTEM SHALL lấy thuật ngữ của ngôn ngữ cuộc họp và gửi tới sidecar trước khi xử lý audio đầu tiên, chờ tối đa 1,5 giây (quá hạn thì bắt đầu với danh sách rỗng và áp dụng khi tải xong) | `session-controller.test.ts` › gửi `vocab` trước khi bắt đầu                             |
| AC2 | WHEN người dùng thêm, sửa hoặc xoá thuật ngữ trong lúc họp THE SYSTEM SHALL gửi danh sách mới tới sidecar trong 5 giây mà không dừng thu âm                                                                                                        | `session-controller.test.ts` › làm mới khi đổi glossary                                  |
| AC3 | WHEN ngôn ngữ cuộc họp đổi giữa chừng THE SYSTEM SHALL thay hẳn danh sách cũ ngay (tiếng Anh: danh sách glossary; ngôn ngữ khác: danh sách rỗng, vì bộ sửa chỉ được kiểm chứng cho tiếng Anh)                                                      | `session-controller.test.ts` › đổi ngôn ngữ                                              |
| AC4 | IF lấy thuật ngữ thất bại hoặc chưa đăng nhập THEN THE SYSTEM SHALL vẫn bắt đầu phiên bình thường với danh sách rỗng và không báo lỗi chặn người dùng                                                                                              | `session-controller.test.ts` › lỗi lấy glossary                                          |
| AC5 | THE SYSTEM SHALL không ghi nội dung thuật ngữ vào log hoặc thông báo lỗi                                                                                                                                                                           | test: mã lỗi Rust không chứa thuật ngữ; không có lệnh log trong module (kiểm khi review) |
| AC6 | WHEN lệnh Rust nhận danh sách thuật ngữ THE SYSTEM SHALL chuyển cho sidecar theo giao thức `vocab [...]` sau khi cắt khoảng trắng và bỏ mục rỗng, mục có ký tự điều khiển hoặc dài quá 120 ký tự, và từ chối danh sách nhận về có hơn 200 mục      | `cargo test` trong `src-tauri`                                                           |
| AC7 | WHEN người dùng có thuật ngữ "SLA" và nói câu chứa từ này trong một cuộc họp thật THE SYSTEM SHALL cho caption tiếng Anh hiện đúng "SLA" (kiểm tay trên bản `.app`, ghi kết quả)                                                                   | chạy thật, ghi vào `03-review.md`                                                        |

## 3. Câu hỏi mở

- [x] **Giới hạn danh sách:** số thuật ngữ và độ dài tối đa gửi cho sidecar (đề xuất 200 mục, mỗi mục ≤ 64 ký tự); `VocabularyCorrector` có chạm giới hạn hiệu năng nào không? Chốt: 200 mục, mỗi mục ≤ 120 ký tự (theo DTO glossary).
- [x] **Cụm nhiều từ:** backlog nhắc "thêm cụm nhiều từ vào bộ sửa". `VocabularyCorrector` hiện xử lý được cụm chưa, hay phải mở rộng? Nếu phải sửa Swift thì task này có phạm vi native. Chốt: không hỗ trợ; `VocabularyCorrector` bỏ cụm nhiều từ, việc riêng nếu cần.
- [x] **Chỉ sửa kết quả `final`, hay cả `partial`?** (ảnh hưởng độ nhấp nháy của caption). Chốt: cả partial lẫn final đã được sửa sẵn trong sidecar.
- [x] **Chọn bộ thuật ngữ trước họp** (đã ghi ở trang Thuật ngữ) đang ngoài phạm vi; xác nhận là việc riêng. Chốt: ngoài phạm vi, việc riêng.

## Decision log

| Ngày       | Pha     | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                                                                                            |
| ---------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-02 | Spec    | Mở hồ sơ. Việc đầu tiên của Đợt 0 ([backlog](../../02-product/06-backlog.md)); sidecar đã xong, thiếu Rust + desktop                                                                                                                                                                                                                                     |
| 2026-11-02 | Plan    | Chủ sản phẩm duyệt plan. Ba điểm lệch so với spec được chấp nhận: chờ glossary tối đa 1,5 giây (AC1), chỉ gửi cho `en` (AC3), 200 mục × 120 ký tự                                                                                                                                                                                                        |
| 2026-11-02 | Kết quả | Review độc lập (Claude `code-reviewer` và Codex) tìm 🔴: một thuật ngữ có tab/xuống dòng làm hỏng mọi lần bắt đầu họp; danh sách cũ ghi đè danh sách mới; giới hạn 200 mục kiểm sau khi bỏ mục rỗng. Đổi AC6 từ "từ chối cả danh sách" sang "bỏ mục lỗi, chỉ từ chối khi nhận về hơn 200 mục"; AC5 kiểm bằng mã lỗi không chứa thuật ngữ thay vì bắt log |
