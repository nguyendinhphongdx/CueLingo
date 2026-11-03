# languages-ko-zh-ja — Họp tiếng Hàn, Trung, Nhật qua nhận dạng đám mây, chọn ngôn ngữ bằng dropdown

| Trạng thái | Loại    | Nhánh / PR             | Ước lượng → thực tế |
| ---------- | ------- | ---------------------- | ------------------- |
| Kết quả    | feature | `feat/m1-live-caption` | _1,5 ngày → ?_      |

**Phạm vi:** trong: thêm tiếng Hàn (`ko`) và tiếng Trung (`zh`), bật tiếng Nhật (`ja`), cả ba nhận dạng bằng đám mây theo đường của tiếng Việt ([ADR 0014](../../08-adr/0014-cloud-stt-for-vietnamese.md)); caption kèm bản dịch tiếng Việt; chọn ngôn ngữ bằng dropdown dùng chung; kiểm chất lượng nhanh bằng Gemini thật · ngoài: đưa tiếng Hàn và Trung vào ôn tập, bài đánh giá và Learner Model; chữ đọc (pinyin, romaja); tiếng Trung phồn thể riêng; nhận dạng ngôn ngữ liên tục giữa cuộc họp; model nhận dạng trên máy cho các ngôn ngữ này.

## 1. Vấn đề

Người dùng cần họp bằng tiếng Hàn, tiếng Trung và tiếng Nhật, không chỉ tiếng Anh và tiếng Việt. Hiện: tiếng Nhật có sẵn nhưng đang tắt (chờ đánh giá nhận dạng trên máy); tiếng Hàn và tiếng Trung chưa có. Bộ chọn ngôn ngữ là một thanh hai nút, không dùng được khi có nhiều ngôn ngữ.

- **Spec liên quan:** `apps/docs/docs/08-adr/0013-multi-language.md` (một ngôn ngữ mới là một mục registry cộng bộ kiểm chất lượng cộng xem lại prompt), `0014-cloud-stt-for-vietnamese.md`, `02-product/06-backlog.md` (P3-05, P3-08)
- **Module chạm tới:** `05-packages/shared.md`, `ui.md`, `prompts.md`, `01-desktop/local-stt.md`, `session-controller.md`, `02-web/debrief.md`

## 2. Tiêu chí chấp nhận (EARS)

| #    | AC                                                                                                                                                                                                                          | Test                                           |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| AC1  | WHEN người dùng chọn tiếng Hàn, Trung hoặc Nhật và bắt đầu họp THE SYSTEM SHALL nhận dạng bằng đám mây (sau khi đã đồng ý) và hiện caption gốc kèm bản dịch tiếng Việt                                                      | `session-controller.test.ts`, chạy thật        |
| AC2  | THE SYSTEM SHALL khai `ko` và `zh` trong `SUPPORTED_LANGUAGES` (`recognition: 'cloud'`, `translates: true`, `learnable: false`, `enabled: true`) và đổi `ja` sang `recognition: 'cloud'` và `enabled: true`                 | `languages.test.ts`                            |
| AC3  | WHILE ngôn ngữ họp là `ja`, `ko` hoặc `zh` THE SYSTEM SHALL không dùng model nhận dạng trên máy và sidecar không tải model                                                                                                  | test Swift (`SpeechModels.isCloud`), chạy thật |
| AC4  | WHEN người dùng mở bộ chọn ngôn ngữ THE SYSTEM SHALL hiện dropdown liệt kê mọi ngôn ngữ đang bật (tên bản ngữ và tên tiếng Việt), chọn được bằng bàn phím, hiện ngôn ngữ đang chọn; dùng chung ở phiên họp và các trang học | `language-switcher.test.tsx`                   |
| AC5  | WHEN một câu tiếng Hàn, Trung hoặc Nhật nhận dạng xong THE SYSTEM SHALL dịch sang tiếng Việt qua `translate.realtime` theo cặp ngôn ngữ, p95 ≤ 2,5 giây sau khi có văn bản                                                  | `realtime.test.ts`, đo thật                    |
| AC6  | WHEN người dùng bấm một từ trên caption tiếng Trung THE SYSTEM SHALL tách từ bằng bộ tách từ điển; với tiếng Hàn tách theo khoảng trắng                                                                                     | test tách từ                                   |
| AC7  | THE SYSTEM SHALL không đưa `ko`, `zh` vào các màn hình và endpoint học (ôn tập, cụm từ, thuật ngữ, tiến độ, bài đánh giá); `ja` vẫn như hiện tại                                                                            | `languages.test.ts`, test DTO                  |
| AC8  | WHEN họp tiếng Hàn hoặc Trung kết thúc THE SYSTEM SHALL tạo debrief tiếng Việt chỉ có tóm tắt, quyết định, việc cần làm; debrief họp tiếng Nhật giữ như hiện tại; trang debrief web ẩn các khối học theo `learnable`        | `debrief.test.ts`, `DebriefPage.test.tsx`      |
| AC9  | WHEN cuộc họp trên lịch có từ khoá hoặc tên miền gợi ý tiếng Hàn hoặc Trung THE SYSTEM SHALL đề xuất đổi ngôn ngữ như với tiếng Nhật                                                                                        | `languages.test.ts`, `calendar-hint.test.ts`   |
| AC10 | WHEN người dùng đã đồng ý gửi âm thanh một lần THE SYSTEM SHALL không hỏi lại khi đổi giữa các ngôn ngữ đám mây; lời đồng ý nêu rõ âm thanh gửi tới Google                                                                  | `session-controller.test.ts`                   |
| AC11 | BEFORE bật mỗi ngôn ngữ THE SYSTEM SHALL có kết quả kiểm nhanh bằng Gemini thật (nhận dạng và dịch ba câu mẫu mỗi ngôn ngữ, giọng tổng hợp) ghi trong `03-review.md`                                                        | `03-review.md`                                 |

## 3. Câu hỏi mở

- [x] **Tiếng Nhật qua đám mây ngay bây giờ**, và bật lại model trên máy sau khi có bộ đánh giá riêng (khi đó viết ADR mới)? Đề xuất: đồng ý, ghi rõ trong ADR 0014 mục hệ quả. Chốt: đồng ý (ADR 0016).
- [x] **Tiếng Trung giản thể** là mặc định; phồn thể (Đài Loan) để sau? Chốt: giản thể mặc định, phồn thể để sau.
- [x] **Hàn và Trung chỉ dùng cho họp** (không học) ở giai đoạn này, đúng chưa? Chốt: chỉ họp, không học.
- [x] **Chữ đọc** (pinyin, romaja) bỏ qua ở bước này, đúng chưa? Chốt: bỏ qua.
- [x] **Dropdown:** dùng cho mọi chỗ chọn ngôn ngữ, hay chỉ ở phiên họp và giữ thanh hai nút cho các trang học khi chỉ có hai ngôn ngữ học được? Đề xuất: dropdown ở mọi chỗ cho đồng nhất. Chốt: dropdown ở mọi chỗ chọn ngôn ngữ.
- [x] Ngôn ngữ nào tiếp theo (Thái, Indonesia, Pháp, Đức…)? Không làm trong task này. Để sau, không làm trong task này.

## Decision log

| Ngày       | Pha     | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-03 | Spec    | Mở hồ sơ. Chủ sản phẩm chọn "Hàn, Trung, Nhật qua đám mây + dropdown"                                                                                                                                                                                                                                                                                                                                                                                        |
| 2026-11-03 | Spec    | Chủ sản phẩm duyệt spec ("Đúng, qua cổng"), dùng mặc định cho các câu hỏi mở                                                                                                                                                                                                                                                                                                                                                                                 |
| 2026-11-03 | Plan    | Chọn phương án A (theo registry); chủ sản phẩm duyệt ("Ổn, bắt đầu làm"). Không thêm `.tw` làm gợi ý lịch cho tiếng Trung (tên miền Đài Loan thường là chữ phồn thể, ngoài phạm vi)                                                                                                                                                                                                                                                                          |
| 2026-11-03 | Kết quả | Review độc lập (Claude và Codex): sửa phiên server bị bỏ rơi khi bắt đầu lại từ trạng thái lỗi; gợi ý lịch báo nhầm với tiêu đề tiếng Việt (bỏ từ khoá trần "hàn", "trung", "nhật"); lời đồng ý cũ (nói về tiếng Việt) không còn áp dụng cho ngôn ngữ mới (nâng phiên bản khoá đồng ý); bài đánh giá chỉ liệt kê ngôn ngữ có nội dung; prompt `debrief/v3` coi lời thoại là dữ liệu không đáng tin; test đồng ý, tải lên, dịch, tách từ cho Hàn, Trung, Nhật |
