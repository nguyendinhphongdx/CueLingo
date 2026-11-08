# server-picker — Chọn máy chủ trong app desktop

| Trạng thái | Loại    | Nhánh / PR                  | Ước lượng → thực tế |
| ---------- | ------- | --------------------------- | ------------------- |
| Spec       | feature | `feat/server-picker` / _PR_ | _0,5–1 ngày → ?_    |

**Phạm vi:** trong: app desktop (Tauri/React), hộp thoại chọn máy chủ dùng ở màn đăng nhập và Cài đặt → Nâng cao, một nơi duy nhất đọc địa chỉ API/web, kiểm tra kết nối, tài liệu · ngoài: link mở app `cuelingo://` (để sau), chọn máy chủ ở web/extension/mobile, đổi hạ tầng triển khai, ký lại bản cài.

## 1. Vấn đề

Địa chỉ API và web của app desktop được ghi cứng lúc build (`VITE_API_URL`, `VITE_WEB_URL`, mặc định `localhost`) và được đọc rải rác ở nhiều module. Người dùng cài xong không thể đổi hoặc chọn máy chủ. Trong giai đoạn beta, nơi đặt máy chủ chưa cố định, nên mỗi lần đổi địa chỉ phải build và phát hành lại bản `.dmg`, và người chưa đăng nhập được (vì máy chủ sai hoặc chưa chạy) không có cách nào tự khắc phục. Người bị ảnh hưởng: chủ sản phẩm và 30–50 tester của beta.

- **Spec liên quan:** `04-modules/01-desktop/settings.md`, `04-modules/01-desktop/tauri-core.md`, `08-adr/0017-beta-release.md`, `03-architecture/08-security-privacy.md`
- **Module chạm tới:** `apps/desktop` (đăng nhập, cài đặt, các client API), `packages/core-sdk` (chỉ đọc)

## 2. Tiêu chí chấp nhận (EARS)

| #    | AC                                                                                                                                                                             | Test                                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| AC1  | THE SYSTEM SHALL đọc địa chỉ API và web từ đúng một hàm; thứ tự ưu tiên: giá trị người dùng đã lưu, giá trị lúc build, mặc định                                                | `server-config.test.ts`              |
| AC2  | WHEN người dùng chưa đăng nhập THE SYSTEM SHALL cho mở hộp thoại chọn máy chủ từ màn đăng nhập                                                                                 | test màn đăng nhập                   |
| AC3  | WHEN người dùng đã đăng nhập THE SYSTEM SHALL cho mở cùng hộp thoại đó từ Cài đặt → Nâng cao                                                                                   | test màn Cài đặt                     |
| AC4  | THE SYSTEM SHALL hiện danh sách chọn sẵn gồm "CueLingo Beta (mặc định)" và "Tuỳ chỉnh…"; mục `localhost` chỉ hiện ở bản dev                                                    | test danh sách                       |
| AC5  | WHEN người dùng nhập địa chỉ tuỳ chỉnh THE SYSTEM SHALL chỉ chấp nhận `https://` (và `http://localhost`/`127.0.0.1` ở bản dev), từ chối địa chỉ khác kèm lý do bằng tiếng Việt | `server-config.test.ts` (bảng ca)    |
| AC6  | WHEN người dùng bấm "Kiểm tra kết nối" THE SYSTEM SHALL gọi `/health` của máy chủ đã chọn và báo "kết nối được" hoặc "không kết nối được" kèm nguyên nhân ngắn                 | test với máy chủ giả                 |
| AC7  | IF kiểm tra kết nối thất bại THEN THE SYSTEM SHALL chỉ lưu khi người dùng xác nhận rõ ràng sau cảnh báo                                                                        | test luồng lưu                       |
| AC8  | WHEN người dùng chọn một máy chủ khác máy chủ hiện tại THE SYSTEM SHALL cảnh báo rằng tài khoản và nội dung họp sẽ gửi tới đó, rồi đăng xuất phiên cũ trước khi áp dụng        | test đổi máy chủ khi đã đăng nhập    |
| AC9  | WHILE đang họp (phiên caption chạy) THE SYSTEM SHALL không cho đổi máy chủ                                                                                                     | test chặn đổi khi họp                |
| AC10 | WHEN người dùng bấm "Đặt lại mặc định" THE SYSTEM SHALL quay về địa chỉ lúc build                                                                                              | test đặt lại                         |
| AC11 | THE SYSTEM SHALL lưu lựa chọn trên máy (không gửi lên máy chủ) và giữ nguyên sau khi khởi động lại hoặc cập nhật app                                                           | test store                           |
| AC12 | THE SYSTEM SHALL giữ nguyên cơ chế kiểm chữ ký bản cập nhật, không phụ thuộc máy chủ API đã chọn                                                                               | rà soát cấu hình updater (không đổi) |
| AC13 | THE SYSTEM SHALL không ghi địa chỉ máy chủ tuỳ chỉnh vào log hay telemetry                                                                                                     | test telemetry                       |

## 3. Câu hỏi mở

- [ ] Danh sách chọn sẵn có cần thêm mục nào khác ngoài "CueLingo Beta" (ví dụ môi trường thử) không? Địa chỉ "CueLingo Beta" lấy từ biến lúc build (`CUELINGO_API_URL`), chưa có máy chủ thật nên mặc định tạm là địa chỉ build.
- [ ] Mục "Tuỳ chỉnh…" hiện cho mọi người hay ẩn sau cờ/chuỗi gõ? (đề xuất: hiện trong Cài đặt → Nâng cao và dưới liên kết nhỏ ở màn đăng nhập)
- [ ] Đổi máy chủ có cần xoá dữ liệu cục bộ của máy chủ cũ (cache cụm từ, hàng đợi đồng bộ) không, hay giữ cho tới khi đăng nhập lại?
- [ ] Link mở app `cuelingo://server?...` để sau, đồng ý?

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                             |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-08 | Spec | Mở hồ sơ. Chủ sản phẩm chọn đặt lựa chọn máy chủ ở cả màn đăng nhập và Cài đặt, có danh sách chọn sẵn; link mở app để sau |
