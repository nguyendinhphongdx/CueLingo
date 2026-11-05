# beta-readiness — Sẵn sàng cho beta kín (Lô A, Đợt 0)

| Trạng thái | Loại    | Nhánh / PR            | Ước lượng → thực tế |
| ---------- | ------- | --------------------- | ------------------- |
| Spec       | feature | `feat/beta-readiness` | ~2 tuần → ?         |

**Phạm vi:** trong: mã mời, form phản hồi, đo kích hoạt và giữ chân, bản phát hành beta trên GitHub Releases (ký ad-hoc + tự cập nhật Tauri), nối thuật ngữ vào nhận dạng (P2-04), chia sẻ debrief (P2-16), dọn nợ họp tiếng Việt (W0-05), đăng nhập bằng console khi chưa có Resend · ngoài: ký và notarize bằng Apple Developer, khoá Google OAuth thật, Resend thật, thanh toán, mọi việc của Đợt 1 trở đi.

## 1. Vấn đề

Chủ sản phẩm muốn có một bản hoàn chỉnh để 30–50 người dùng thử rồi phản hồi. Hôm nay:

- Ai tải được app thì dùng được; không có cách giới hạn và biết ai là người được mời.
- Không có kênh phát hành: không có bản `.dmg` trên GitHub Releases, không có tự cập nhật, người dùng không biết cách mở app chưa được Apple công chứng.
- Không có chỗ để người thử gửi lỗi hay góp ý mà không phải đính transcript.
- Không đo được thời gian từ cài tới caption đầu tiên, số họp mỗi tuần, D1/D7, nên không biết beta có đạt cổng hay không.
- Thuật ngữ cá nhân chưa tới được bộ nhận dạng (sidecar xong, thiếu lệnh Rust và phía desktop), nên ≥ 95% thuật ngữ của MVP chưa đo được.
- Debrief chưa sao chép/chia sẻ được cả cuộc họp; họp tiếng Việt còn vài nợ (chặn `vi` ở assist/events, đổi Việt ↔ Anh giữa chừng).
- Chưa có Resend: đăng nhập bằng email phải chạy được trên máy dev bằng cách in link ra console.

- **Spec liên quan:** [Phạm vi MVP](../../02-product/03-mvp-scope.md), [backlog](../../02-product/06-backlog.md) (P2-04, P2-09, P2-16, P2-25, W0-02, W0-03, W0-05), [ADR 0015](../../08-adr/0015-email-provider-resend.md)
- **Module chạm tới:** `04-modules/` của desktop (`tauri-core`, session), api (`auth`, `events`, `admin`, module mới `invites`, `feedback`), web (`debrief`, `admin`, `download`), `@cuelingo/shared`, `@cuelingo/core-sdk`

## 2. Tiêu chí chấp nhận (EARS)

### Mã mời

| #   | AC                                                                                                                                                          | Test |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AC1 | WHEN một người chưa có tài khoản đăng nhập lần đầu THE SYSTEM SHALL yêu cầu mã mời hợp lệ, chưa dùng, chưa hết hạn trước khi tạo tài khoản                  |      |
| AC2 | IF mã sai, đã dùng hoặc hết hạn THEN THE SYSTEM SHALL từ chối bằng thông báo tiếng Việt, không tiết lộ mã đúng hay sai vì lý do nào, và không tạo tài khoản |      |
| AC3 | WHEN một tài khoản đã tồn tại đăng nhập lại THE SYSTEM SHALL không đòi mã mời                                                                               |      |
| AC4 | WHEN quản trị viên tạo mã THE SYSTEM SHALL lưu mã ở dạng băm, chỉ hiện bản rõ một lần, cho đặt số lần dùng và hạn                                           |      |
| AC5 | WHILE mã mời bị bắt buộc THE SYSTEM SHALL áp cả đường email lẫn Google và cả đăng nhập trong app desktop                                                    |      |

### Phản hồi và đo lường

| #   | AC                                                                                                                                                            | Test |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AC6 | WHEN người dùng gửi phản hồi (lỗi/góp ý, tối đa 2000 ký tự) THE SYSTEM SHALL lưu kèm phiên bản app và hệ điều hành, và KHÔNG đính transcript, audio hay token |      |
| AC7 | THE SYSTEM SHALL ghi các event `app_installed_first_run`, `first_caption_shown`, `session_started` để tính thời gian tới caption đầu tiên, họp/tuần, D1 và D7 |      |
| AC8 | WHEN quản trị viên mở trang số liệu THE SYSTEM SHALL hiện thời gian tới caption đầu tiên (trung vị), họp/tuần/người, D1, D7 và số phản hồi                    |      |
| AC9 | THE SYSTEM SHALL lọc mọi truy vấn phản hồi và event theo người dùng; trang số liệu chỉ cho quản trị viên                                                      |      |

### Phát hành beta

| #    | AC                                                                                                                                                      | Test |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AC10 | WHEN gắn tag phiên bản THE SYSTEM SHALL dựng `.dmg` (Apple Silicon), ký ad-hoc, ký gói cập nhật bằng khoá updater của Tauri và đăng lên GitHub Releases |      |
| AC11 | WHEN có bản mới hơn THE SYSTEM SHALL để app hỏi và cập nhật qua updater; IF chữ ký gói không khớp THEN THE SYSTEM SHALL từ chối cài                     |      |
| AC12 | THE SYSTEM SHALL có trang `/download` trỏ tới bản mới nhất, kèm hướng dẫn gỡ chặn Gatekeeper và cấp lại quyền thu âm sau mỗi lần cập nhật               |      |

### Thuật ngữ, debrief, họp tiếng Việt

| #    | AC                                                                                                                                                    | Test |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AC13 | WHEN một phiên bắt đầu THE SYSTEM SHALL lấy glossary của người dùng và gửi `vocab` tới sidecar; WHEN glossary đổi giữa phiên THE SYSTEM SHALL gửi lại |      |
| AC14 | WHEN người dùng bấm sao chép/tải debrief THE SYSTEM SHALL cho Markdown của cả cuộc họp (không kèm audio)                                              |      |
| AC15 | THE SYSTEM SHALL từ chối `vi` ở DTO assist/events, tắt tra từ trên caption tiếng Việt, và giữ caption khi đổi Việt ↔ Anh giữa phiên                   |      |
| AC16 | WHILE chưa cấu hình nhà cung cấp email THE SYSTEM SHALL in link đăng nhập ra log của API (chỉ ở môi trường dev), không bao giờ ở production           |      |

## 3. Câu hỏi mở

- [x] **Mã mời:** mỗi mã dùng một lần cho một người, hay một mã chung dùng được N lần? Đề xuất: do quản trị viên tạo, mỗi mã có số lần dùng (mặc định 1) và hạn 30 ngày.
- [x] **Mã mời chạm DB schema** (bảng `invites`, cột người dùng) — nhạy cảm; đề xuất migration nhỏ, thêm file mới.
- [x] **Repo GitHub** chứa Releases là công khai hay riêng tư? Riêng tư thì người thử không tải được bản build nếu không có quyền repo. Đề xuất: repo riêng, Releases của một repo công khai chỉ chứa bản build (cần bạn tạo repo đó).
- [x] **Khoá ký updater (Tauri):** tôi tạo cặp khoá, bạn đặt khoá riêng vào GitHub secrets. Đồng ý?
- [x] **Giả định:** sidecar/Rust cho P2-04 giữ cách đã làm ở sidecar; đổi tên người nói không nằm trong lô này (hướng C đã chốt).
- [x] **Giả định:** chỉ build Apple Silicon (arm64) cho beta.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                     |
| ---------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-05 | Spec | Mở hồ sơ. Chủ sản phẩm chốt: kênh phát hành là GitHub Releases; mời bằng mã mời; chưa có Resend nên đăng nhập in ra console; ký ad-hoc, chưa dùng Apple Developer                                                                 |
| 2026-11-05 | Spec | Chủ sản phẩm duyệt cổng spec ("Đúng, qua cổng"); dùng đề xuất mặc định cho cả sáu câu hỏi mở (mã mới có số lần dùng mặc định 1 và hạn 30 ngày; repo công khai chỉ chứa bản build; tôi tạo khoá updater; migration nhỏ; chỉ arm64) |
