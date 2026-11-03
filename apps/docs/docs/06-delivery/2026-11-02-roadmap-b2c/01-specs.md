# roadmap-b2c — Lộ trình B2C-first và kế hoạch hoàn thiện tính năng

| Trạng thái | Loại  | Nhánh / PR         | Ước lượng → thực tế |
| ---------- | ----- | ------------------ | ------------------- |
| Kết quả    | chore | `docs/roadmap-b2c` | _0,5 ngày → ?_      |

**Phạm vi:** trong: `02-product/04-roadmap.md`, `06-backlog.md`, `01-features.md`, `05-business-model.md` (phần gói và chỉ số B2C) · ngoài: mọi code, migration, thay đổi contract; không bắt đầu làm tính năng nào trong kế hoạch.

## 1. Vấn đề

Chủ sản phẩm đã chốt **B2C trước** (câu hỏi mở "B2C trước hay pilot outsourcing" của `04-roadmap.md`). Tài liệu chưa phản ánh quyết định đó, và đang có ba vấn đề:

- **Hai cách gọi "Giai đoạn 2/3" mâu thuẫn.** `04-roadmap.md` dùng chúng cho Learn (Windows, extension, Speech Coach) và Coach (mobile, roleplay); `06-backlog.md` dùng cho đợt đưa tới tay người dùng thử và đa ngôn ngữ. Người và agent đọc ra hai kế hoạch khác nhau.
- **Lộ trình là danh sách tính năng, không có lời hứa với người dùng B2C** (vì sao mở app mỗi ngày, vì sao trả tiền). Khoảnh khắc giá trị cao nhất, chuẩn bị trước họp, đang nằm ở tháng 7–12. B2B (Team, glossary công ty, dashboard L&D, Windows theo yêu cầu khách) vẫn xếp ở vị trí cạnh tranh với việc hoàn thiện cho cá nhân.
- **Chưa có kế hoạch hoàn thiện gom một chỗ.** Việc còn dở nằm rải ở backlog (P2-04, P2-06, P2-09, P2-14, P2-15, P2-16, P2-20, P2-22 đến P2-25, P3-02, P3-08) và `01-features.md` không có cột trạng thái thật. Chưa có chỗ nào ghi việc B2C bắt buộc mà hiện chưa có: gói Free/Pro và paywall, kênh phân phối, đo chuyển đổi.

Người bị ảnh hưởng: chủ sản phẩm (không biết làm gì kế tiếp và vì sao), Claude/Codex (chọn task theo tài liệu mâu thuẫn).

- **Spec liên quan:** `02-product/03-mvp-scope.md`, `02-product/05-business-model.md`, `01-overview/02-vision.md`
- **Module chạm tới:** không có (chỉ tài liệu sản phẩm và delivery)

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                                                                                  | Kiểm chứng                                    |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| AC1 | WHEN đọc `04-roadmap.md` và `06-backlog.md` THE SYSTEM SHALL dùng một cách đặt tên đợt duy nhất; không còn tên nào mang hai nghĩa                                                                                                   | Tìm "Giai đoạn 2/3" trong cả hai file; review |
| AC2 | WHEN đọc một đợt trong `04-roadmap.md` THE SYSTEM SHALL thấy lời hứa với người dùng, nội dung, số đo và ngưỡng cổng đi tiếp                                                                                                         | Review theo bảng                              |
| AC3 | THE SYSTEM SHALL ghi B2C-first (kèm ngày chốt) ở câu hỏi mở của lộ trình, đẩy Team, glossary công ty, dashboard L&D, Windows xuống sau cổng B2C, và ghi điều kiện để mở lại B2B                                                     | Review; câu hỏi mở được đánh dấu              |
| AC4 | WHEN đọc `01-features.md` THE SYSTEM SHALL thấy mỗi tính năng có trạng thái (xong / đang làm / chưa) đúng với hiện trạng repo và hồ sơ delivery                                                                                     | Đối chiếu từng dòng với `06-delivery` và code |
| AC5 | WHEN đọc kế hoạch hoàn thiện trong `06-backlog.md` THE SYSTEM SHALL thấy mỗi việc chưa xong có ID, chủ (C/X/U), phụ thuộc, cỡ và cổng đợt; việc B2C bắt buộc chưa có (gói Free/Pro, paywall, đo chuyển đổi, phân phối) được liệt kê | Review; không có việc mồ côi trong danh sách  |
| AC6 | IF kế hoạch cần nhà cung cấp mới (thanh toán, email, analytics) THEN THE SYSTEM SHALL ghi rõ là cần ADR và hỏi người trước, không chọn thay                                                                                         | Review                                        |
| AC7 | WHEN chạy `pnpm docs:build` THE SYSTEM SHALL xanh, không link hỏng                                                                                                                                                                  | `pnpm docs:build`                             |
| AC8 | THE SYSTEM SHALL không đổi file nào ngoài `apps/docs/docs/`                                                                                                                                                                         | `git diff --stat`                             |

## 3. Câu hỏi mở

- [x] **Giá và giới hạn gói Free** (giờ Copilot mỗi tháng, giới hạn debrief): chốt trong spec này hay đợi số chi phí AI/giờ họp (H5) từ beta? Đề xuất: ghi khoảng giả định, chốt sau đo. Chốt: ghi khoảng giả định, quyết định sau khi có H5 từ beta.
- [x] **Nhà cung cấp thanh toán** cho B2C (ví dụ Stripe, Paddle, Lemon Squeezy; Paddle/Lemon Squeezy làm merchant of record, đỡ lo thuế): là nhà cung cấp mới nhận dữ liệu nên cần ADR. Lập ADR cùng đợt này hay để đợt sau? Chốt: ADR là việc W2-01, chưa chọn nhà cung cấp.
- [ ] **Kênh phân phối B2C đầu tiên** (cộng đồng dev Việt, waitlist, Product Hunt, giới thiệu): bạn đã có kênh nào chưa? Tác động tới việc làm trang chủ và đo chuyển đổi.
- [x] **Chỉ macOS làm hẹp tệp B2C.** Giữ macOS-only đến hết cổng B2C, hay đưa Windows lên sớm hơn nếu beta cho thấy nhu cầu? Chốt: giữ macOS-only, Windows xét sau cổng Đợt 2.
- [x] **Quyết định B2C-first có cần ADR riêng** không (chiến lược, khó đảo ngược), hay ghi trong lộ trình là đủ? Chốt: không cần ADR; ghi trong lộ trình và decision log.
- [x] **Ba việc mới đề xuất đưa lên sớm** (Briefing trước họp, Follow-up sau họp, chỉ số độc lập hằng tuần) có được vào phạm vi không, hay chỉ sắp xếp lại việc đã có? Chốt: vào phạm vi (W1-01 đến W1-03, thêm W1-04).
- [ ] Hỗ trợ tối thiểu macOS 13 hay 14.4 (đang mở từ trước, ảnh hưởng độ phủ B2C).

## Decision log

| Ngày       | Pha     | Quyết định / lý do bị từ chối                                                                                                                                                                                   |
| ---------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-02 | Spec    | Mở hồ sơ. Chủ sản phẩm chốt B2C trước, cần kế hoạch hoàn thiện tính năng                                                                                                                                        |
| 2026-11-02 | Spec    | Chủ sản phẩm duyệt spec ("Đúng, qua cổng")                                                                                                                                                                      |
| 2026-11-02 | Plan    | Chọn phương án A (đợt theo vòng 24 giờ, cổng theo phễu B2C); chủ sản phẩm duyệt ("Ổn, bắt đầu làm"). Mặc định cho 5 câu hỏi mở nêu ở cổng Plan được giữ nguyên; còn mở: kênh phân phối (W0-03), macOS tối thiểu |
| 2026-11-02 | Kết quả | Review độc lập tìm 3 lỗi chặn (P2-04 và P2-23 ghi sai hiện trạng, tiếng Nhật ✅ sai) và vài điểm nên sửa; đã sửa, xem `03-review.md`                                                                            |
