# pages-landing — Trang tải về công khai trên GitHub Pages

| Trạng thái | Loại    | Nhánh / PR                  | Ước lượng → thực tế |
| ---------- | ------- | --------------------------- | ------------------- |
| Spec       | feature | `feat/pages-landing` / _PR_ | _1 ngày → ?_        |

**Phạm vi:** trong: một trang tĩnh (trang chủ + hướng dẫn cài) đặt trên GitHub Pages, nút tải trỏ tới bản `.dmg` mới nhất ở repo bản build, workflow tự deploy, tài liệu · ngoài: đổi workflow `release.yml`, thêm Windows/Linux, tên miền riêng, công chứng Apple, đổi cơ chế tự cập nhật.

## 1. Vấn đề

Người thử bên ngoài chưa có một đường dẫn công khai để vào đọc giới thiệu và tải CueLingo. Bản cài và cơ chế tự cập nhật đã có (ADR 0017), nhưng trang `/download` nằm trong app web cần API và chưa được triển khai công khai, nên không đưa nguyên lên máy chủ tĩnh được. Chủ sản phẩm cần gửi một đường dẫn là người nhận tải và cài được, về sau app tự cập nhật.

- **Spec liên quan:** `08-adr/0017-beta-release.md`, `apps/docs/docs/04-modules/` (web landing, desktop updater)
- **Module chạm tới:** `apps/web/src/features/landing`, `.github/workflows/`, `apps/desktop` (chỉ đọc)

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                         | Test                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| AC1 | WHEN ai đó mở địa chỉ GitHub Pages THE SYSTEM SHALL hiện trang giới thiệu và nút "Tải cho macOS" mà không cần đăng nhập hay API            | build tĩnh + kiểm HTML có nút và không gọi mạng    |
| AC2 | THE SYSTEM SHALL trỏ nút tải tới `https://github.com/<repo bản build>/releases/latest/download/CueLingo-macOS-arm64.dmg`                   | test đọc href từ cấu hình                          |
| AC3 | WHEN chưa cấu hình repo bản build THEN THE SYSTEM SHALL hiện nút "Sắp có bản tải" bị khoá thay vì link hỏng                                | test hai trạng thái                                |
| AC4 | THE SYSTEM SHALL nêu yêu cầu macOS 14.2+, Apple Silicon, các bước gỡ chặn Gatekeeper và cấp quyền như `/download` hiện có, bằng tiếng Việt | test nội dung                                      |
| AC5 | WHEN push lên nhánh chính có đổi nội dung trang THE SYSTEM SHALL tự build và deploy bằng workflow, không cần thao tác tay                  | workflow chạy được `actionlint`; chạy thật cần H1  |
| AC6 | THE SYSTEM SHALL dùng lại `@cuelingo/ui` và nội dung chung với `/download`, không sao chép hai bản                                         | depcruise/ `pnpm verify` xanh, không trùng văn bản |
| AC7 | THE SYSTEM SHALL không chứa token, khoá hay địa chỉ API riêng tư trong bản build tĩnh                                                      | bước quét chuỗi nhạy cảm trong workflow            |
| AC8 | THE SYSTEM SHALL nói rõ trên trang rằng app tự kiểm tra và hỏi cập nhật khi có bản mới                                                     | test nội dung                                      |

## 3. Câu hỏi mở

- [ ] Tên repo bản build công khai (`CUELINGO_RELEASES_REPO`) là gì, đã tạo chưa? Pages đặt cùng repo đó cho gọn, hay repo riêng?
- [ ] Giữ địa chỉ mặc định `https://<user>.github.io/<repo>/` hay có tên miền riêng sau này?
- [ ] Trang tĩnh gồm đúng trang chủ + tải về, hay chỉ một trang?

## Việc cần chủ sản phẩm làm (không tự làm được)

- **H1** Tạo repo công khai chứa bản build, bật GitHub Pages (nguồn: GitHub Actions), đặt biến `CUELINGO_RELEASES_REPO` và các secret ở ADR 0017, rồi gắn tag `v0.1.0`.

## Decision log

| Ngày       | Pha    | Quyết định / lý do bị từ chối                                                                                                               |
| ---------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-07 | Spec   | Mở hồ sơ theo yêu cầu "Làm đi" sau khi chủ sản phẩm hỏi về trang tải và tự cập nhật                                                         |
| 2026-11-07 | Result | Chủ sản phẩm chọn đặt Pages ở **repo mã nguồn** (không chuyển `apps/site` sang repo bản build); repo riêng tư cần gói GitHub cho phép Pages |
