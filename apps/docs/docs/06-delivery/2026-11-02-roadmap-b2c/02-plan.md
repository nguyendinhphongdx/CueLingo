# Plan — roadmap-b2c

## 1. Bối cảnh code

Đây là task chỉ sửa tài liệu. Mình đã đối chiếu backlog với repo (nhánh `feat/m1-live-caption`, 118 commit trước `main`):

| Việc trong backlog            | Backlog ghi | Repo thực tế                                                                                                    | Cách ghi trong docs                |
| ----------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| P2-01 đăng nhập trong app     | chưa ✅     | Có `apps/desktop/src/auth`, `services/api/src/modules/device`                                                   | ◐ có mã, chưa xác nhận chạy thật   |
| P2-14 onboarding              | chưa ✅     | Có `apps/desktop/src/onboarding`                                                                                | ◐                                  |
| P2-15 cài đặt lưu bền         | chưa ✅     | Có `modules/settings`, `features/preferences`                                                                   | ◐                                  |
| P2-20 quan sát                | chưa ✅     | Có `modules/admin`, `features/admin` (trang metrics)                                                            | ◐                                  |
| P2-23 đăng nhập production    | chưa        | Google OAuth (`auth.ts`), magic link qua Resend/SMTP, CORS đã có; chưa có ADR cho Resend                        | ◐                                  |
| P3-02 API theo ngôn ngữ       | chưa ✅     | Commit `1a3bccb`                                                                                                | ✅                                 |
| P3-08 nhận ngôn ngữ + lịch    | ◐           | Có `desktop/src/calendar`, commit `5a133b7`                                                                     | ◐, ghi phần còn thiếu khi xác nhận |
| P2-04 thuật ngữ vào STT       | chưa        | Sidecar Swift đã xong và có test (`vocab`, `VocabularyCorrector`); thiếu lệnh Rust và phía desktop gửi glossary | ◐                                  |
| P2-06 nghe lại đoạn khó       | chưa        | Không có code cắt clip                                                                                          | chưa                               |
| P2-09 ký + notarize + updater | chưa        | Chỉ có `ci.yml`, không có `updater` trong `tauri.conf.json`                                                     | chưa                               |
| Thanh toán, gói, quota        | không có    | Không có code nào                                                                                               | chưa, việc mới                     |
| P2-16 debrief hoàn thiện      | chưa        | Bấm đoạn khó → đúng câu và tiến trình tạo đã có test; còn đính kèm/chia sẻ                                      | ◐                                  |

Quy ước ghi trạng thái: ✅ chỉ khi backlog đã ✅ hoặc có commit và test; ◐ khi có mã mà chưa ai chạy thật. Mình **không** đánh ✅ thay người chạy thử.

Quy ước áp dụng: [writing-docs](../../05-engineering/conventions/writing-docs.md) (bảng và code hơn văn xuôi, một chủ đề một chỗ). Không có module mẫu cần copy.

## 2. Phương án

| #   | Phương án                                                                                                                                             | Ưu                                                                                                       | Nhược                                                                                                   |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| A   | **Đợt theo vòng 24 giờ của cuộc họp** (Beta kín → Quanh cuộc họp → Trả tiền → Nói được → Mở rộng). Mỗi đợt có lời hứa với người dùng và một ngưỡng đo | Mỗi đợt kể được cho người dùng; tận dụng code sẵn có (compose, glossary, debrief, lịch); bám việc đã làm | Ngưỡng ban đầu là giả định, phải chỉnh sau beta                                                         |
| B   | **Đợt theo phễu kinh doanh** (Kích hoạt → Giữ chân → Trả tiền → Lan truyền)                                                                           | Gắn thẳng vào chỉ số B2C                                                                                 | Nội dung đợt là chỉ số chứ không phải tính năng; khó giao cho agent; trộn việc kỹ thuật không liên quan |
| C   | Chỉ sửa tên đợt và đánh dấu trạng thái, không thêm việc mới                                                                                           | Rẻ, ít tranh cãi                                                                                         | Không trả lời "hoàn thiện gì để B2C chạy được": thiếu gói Free/Pro, thanh toán, đo chuyển đổi, pháp lý  |

**Chọn A, lấy ngưỡng đo của B làm cổng.** Mỗi đợt đặt tên theo lời hứa với người dùng, còn cổng đi tiếp là chỉ số phễu. Lý do: A cho agent việc cụ thể để làm, B cho chủ sản phẩm biết khi nào đi tiếp. C bị loại vì không đáp ứng AC5.

Không cần ADR cho quyết định B2C-first: ghi trong lộ trình và decision log. **Mọi nhà cung cấp mới (thanh toán, email gửi hàng loạt, analytics) cần ADR riêng, làm ở đầu Đợt 2**; plan này chỉ đặt việc đó vào kế hoạch, không chọn thay bạn.

### Cấu trúc đợt đề xuất (sẽ viết vào `04-roadmap.md`)

| Đợt                    | Lời hứa với người dùng                | Nội dung                                                                                                                                                                                                            | Cổng đi tiếp (đề xuất, chốt sau beta)                                              |
| ---------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **0 · Beta kín**       | Hiểu được cuộc họp hôm nay            | Đóng việc dở: P2-09, P2-22 đến P2-25, xác nhận các việc ◐, P2-04, P2-16. Kênh phân phối cho 30–50 người                                                                                                             | H1–H3 đạt; p95 độ trễ đo thật; D7 ≥ mức chốt khi beta chạy                         |
| **1 · Quanh cuộc họp** | Vào họp tự tin, ra họp có việc để làm | W1-01 Briefing trước họp (lịch + thuật ngữ + họp trước), W1-02 Follow-up sau họp (soạn email/Slack tiếng Anh từ debrief), W1-03 Chỉ số độc lập hằng tuần, W1-04 Nhắc ôn qua thông báo macOS; xong P3-08             | ≥ 50% cuộc họp có mở briefing hoặc follow-up; D30 chốt khi đo                      |
| **2 · Trả tiền**       | Dùng đều thì trả tiền xứng đáng       | ADR thanh toán, gói Free/Pro + quota giờ Copilot, checkout + webhook, paywall + trang giá, trang chủ công khai, điều khoản + chính sách riêng tư + thông báo người dự họp                                           | Chuyển đổi free → trả phí đạt ngưỡng; chi phí AI/người dùng < doanh thu/người dùng |
| **3 · Nói được**       | Tuần này bạn cần AI ít hơn            | Nghe lại đoạn khó có đồng ý (P2-06), Speech Coach trên mic của chính bạn, shadowing, Dial đầy đủ, gợi ý câu trả lời                                                                                                 | Assist level giảm thật ở ≥ 30% người dùng sau 6 tuần                               |
| **4 · Mở rộng**        |                                       | Windows (khi có tín hiệu từ Đợt 0–2), mobile, extension, roleplay, ngôn ngữ thêm, voice mode (cuối cùng, có điều kiện). **Mở lại B2B khi**: có ≥ 3 công ty chủ động hỏi bản team, hoặc chuyển đổi cá nhân chạm trần | —                                                                                  |

Đa ngôn ngữ (P3-01 đến P3-08, [ADR 0013](../../08-adr/0013-multi-language.md)) không là một đợt riêng: phần đã xong giữ nguyên ✅, phần còn lại (P3-08) vào Đợt 1 vì nó nuôi Briefing.

### Quy ước đặt tên và mã việc

- Dùng **"Đợt"** thay "Giai đoạn" ở cả hai file. Phần "Giai đoạn 2/3" cũ của backlog đổi tiêu đề, giữ nguyên ID `P2-xx`/`P3-xx` để không mất dấu commit.
- Việc mới đặt mã `W<đợt>-<số>` (ví dụ `W1-01`). Có bảng đối chiếu "tên cũ → đợt mới" ở đầu `06-backlog.md`.
- Việc nào cần nhà cung cấp mới ghi cột Ghi chú: "cần ADR, hỏi người".

| Tác động                            | Có?   | Chi tiết                                                                                        |
| ----------------------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| DB migration                        | Không | Chỉ tài liệu. Các việc trong kế hoạch (quota, gói) sẽ có migration khi làm, qua task-loop riêng |
| Contract (`@cuelingo/shared`)       | Không |                                                                                                 |
| Event / Learner Model               | Không | Chỉ liệt kê event cần thêm (kích hoạt, mở briefing) trong mô tả việc                            |
| Prompt / model AI                   | Không | Chỉ nêu cần task AI cho W1-01, W1-02                                                            |
| Quyền riêng tư / dữ liệu người dùng | Không | Ghi rủi ro: audio clip (P2-06) mặc định tắt, thông báo người dự họp (W2-06)                     |

## 3. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                                                                                                                                                                     | File                                              | Điểm mở rộng |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------- | ------------ |
| 1   | Đối chiếu trạng thái với repo, đổi tên đợt, thêm bảng "tên cũ → đợt mới", cập nhật dấu ✅/◐ cho việc đã có                                                               | `apps/docs/docs/02-product/06-backlog.md`         | Docs         |
| 2   | Thêm các đợt 0–4 và việc `W*` mới (ID, chủ, phụ thuộc, cỡ, ghi chú) vào backlog; xếp lại P2-06 sang Đợt 3                                                                | `06-backlog.md`                                   | Docs         |
| 3   | Viết lại lộ trình theo đợt, lời hứa, cổng; chốt câu hỏi mở B2C-first kèm ngày; điều kiện mở lại B2B; bỏ kế hoạch 12 tuần cũ khỏi vị trí trung tâm (giữ làm lịch sử ngắn) | `02-product/04-roadmap.md`                        | Docs         |
| 4   | Thêm cột Trạng thái (xong / ◐ / chưa) và Đợt vào bản đồ tính năng                                                                                                        | `02-product/01-features.md`                       | Docs         |
| 5   | Cập nhật gói Free/Pro theo B2C (giả định, chốt sau H5), chỉ số B2C (kích hoạt, D7/D30, chuyển đổi), Team chuyển xuống sau cổng                                           | `02-product/05-business-model.md`                 | Docs         |
| 6   | `pnpm docs:build`, `pnpm format:check`, tự review theo checklist, điền `03-review.md`                                                                                    | `06-delivery/2026-11-02-roadmap-b2c/03-review.md` | Docs         |

Không làm: sửa `packages/ui/src/lib/roadmap.ts` (đó là code, ngoài phạm vi AC8; trang "Sắp ra mắt" của app không đổi trong task này).

## 4. Rủi ro

| Rủi ro                                                                                                      | Giảm thiểu                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Đánh dấu sai trạng thái (docs nói xong mà chưa chạy thật)                                                   | ◐ cho mọi việc chưa ai chạy; ✅ chỉ khi backlog đã ✅ hoặc có commit + test                                                 |
| Ngưỡng cổng là giả định, dễ bị hiểu như cam kết                                                             | Ghi "đề xuất, chốt sau beta" và ghi ngày chốt dự kiến                                                                       |
| Nhánh `docs/roadmap-b2c` cắt từ `feat/m1-live-caption`, cách `main` 118 commit; PR docs sẽ kéo cả phần code | Chỉ commit file trong `apps/docs/docs/`; khi tạo PR dùng cherry-pick sang nhánh cắt từ `main`, hoặc đợi merge nhánh feature |
| Việc `W*` mới không có chủ sản phẩm duyệt phạm vi                                                           | Cổng PLAN này hỏi lại: có vào phạm vi không                                                                                 |
| Thanh toán, email, analytics là nhà cung cấp mới nhận dữ liệu                                               | Chỉ ghi "cần ADR, hỏi người" ở W2-01; không chọn thay                                                                       |
| Yêu cầu pháp lý ghi âm (Nghị định 13/2023, thông báo người dự họp) nằm ở rủi ro cao của business-model      | Đặt W2-06 trước khi mở công khai, ghi cần người có chuyên môn pháp lý xem                                                   |

> Bảng đối chiếu ở §1 đã sửa sau review độc lập (P2-04, P2-16, P2-23); xem `03-review.md`.
