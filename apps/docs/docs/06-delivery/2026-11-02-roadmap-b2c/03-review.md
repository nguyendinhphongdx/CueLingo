# Review — roadmap-b2c

## Thay đổi so với plan

| Dấu         | File / hành vi                                   | Chi tiết (lý do nếu khác plan)                                                                                                                                                                                                                                               |
| ----------- | ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡 MODIFIED | `02-product/06-backlog.md`                       | Đổi tên "Đợt 1–4" cũ thành Nhóm A–D, "Giai đoạn 2/3" thành tiêu đề mô tả; thêm mục "Kế hoạch hoàn thiện theo đợt" (Đợt 0–4, việc `W*`); đánh ◐ cho P2-01, 04, 14, 15, 16, 20, 23, P3-08 và ✅ cho P3-02; dời P2-06 sang Đợt 3. Khác plan: thêm P2-23 ◐ và P2-04 ◐ sau review |
| 🟡 MODIFIED | `02-product/04-roadmap.md`                       | Viết lại theo đợt (lời hứa, nội dung, cổng), lý do thứ tự, điều kiện mở Đợt 4; kế hoạch 12 tuần giữ làm lịch sử; câu hỏi mở cập nhật                                                                                                                                         |
| 🟡 MODIFIED | `02-product/01-features.md`                      | Thêm cột Trạng thái và Đợt; thêm các dòng Briefing, Follow-up, Chỉ số độc lập, Nhắc ôn, Gói và pháp lý; tách tiếng Anh ✅ và tiếng Nhật ◐                                                                                                                                    |
| 🟡 MODIFIED | `02-product/05-business-model.md`                | Gói Free/Pro theo B2C (giả định), Team sau cổng B2C, chỉ số kích hoạt và phễu                                                                                                                                                                                                |
| 🟢 ADDED    | `06-delivery/2026-11-02-roadmap-b2c/`            | Hồ sơ task (spec, plan, review)                                                                                                                                                                                                                                              |
| 🔴 REMOVED  | `06-delivery/2026-11-02-roadmap-b2c/04-brief.md` | Không giao việc cho agent khác                                                                                                                                                                                                                                               |

**Docs đã cập nhật:** bốn trang `02-product` ở trên. Không có ADR mới (quyết định B2C-first ghi ở lộ trình; các ADR nhà cung cấp là việc `W2-01`, `P2-23`, `W3-01`).

## Tự review

- [x] Ranh giới & bảo mật — không đụng code, không dữ liệu người dùng
- [x] Hợp đồng — không đổi
- [x] Kiến trúc — không đổi
- [x] AI — không đổi (chỉ liệt kê task AI cần làm)
- [x] Test — không có code; AC kiểm bằng review và `docs:build`
- [x] Docs — trang module không đổi vì interface không đổi
- [x] Phạm vi — chỉ `apps/docs/docs/`

```bash
pnpm docs:build   # xanh, không link/anchor hỏng
pnpm exec prettier --check apps/docs/docs/02-product apps/docs/docs/06-delivery/2026-11-02-roadmap-b2c
```

Đã chạy thật: `pnpm docs:build`; kiểm tra anchor `#kế-hoạch-hoàn-thiện-theo-đợt-b2c-first` và `#điều-kiện-mở-các-hướng-ở-đợt-4`. Review độc lập bằng agent `code-reviewer`, đối chiếu các dấu trạng thái với code và git log.

**Chưa làm / không kiểm được:**

- `pnpm verify` không chạy trọn: `check:deps` đỏ trong sandbox vì không đọc được `apps/desktop/.env` (EPERM), không liên quan task. Các bước còn lại xanh theo agent review.
- Ngưỡng cổng (D7 ≥ 30%, D30 ≥ 15%, chuyển đổi ≥ 3%, ≥ 50% mở briefing/follow-up, ≥ 30% giảm Assist level) là giả định, chưa có số liệu.
- Dấu ◐ chưa ai chạy thật; việc xác nhận là `W0-01`.

## Cho người review — đọc theo thứ tự

| #   | File                                       | Soi gì                                                                               |
| --- | ------------------------------------------ | ------------------------------------------------------------------------------------ |
| 1   | `02-product/04-roadmap.md`                 | Lời hứa, cổng và thứ tự các đợt có hợp lý; ngưỡng giả định có chấp nhận được         |
| 2   | `02-product/06-backlog.md` mục "Kế hoạch…" | Từng việc `W*`: chủ, phụ thuộc, cỡ; việc nào cần ADR; việc nào không nên vào phạm vi |
| 3   | `02-product/01-features.md`                | Dấu ✅/◐/— có đúng hiện trạng                                                        |
| 4   | `02-product/05-business-model.md`          | Chia tính năng Free/Pro là giả định, chốt sau H5                                     |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                                         | Tìm ở          | Sửa                                                                                            |
| ------------------------------------------------------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| P2-04 ghi "còn thiếu hẳn", thực tế sidecar xong có test                                     | Review độc lập | Đổi ◐, ghi rõ phần thiếu (lệnh Rust, desktop gửi glossary)                                     |
| P2-23 ghi chưa làm, thực tế Google OAuth và Resend/SMTP đã nối; Resend chưa có ADR (luật 8) | Review độc lập | Đổi ◐; ghi "lập ADR hợp thức hoá Resend, hỏi người"                                            |
| Tiếng Nhật đánh ✅ nhưng `ja.enabled: false`                                                | Review độc lập | Tách dòng: tiếng Anh ✅, tiếng Nhật ◐                                                          |
| P2-16 liệt kê sai phần còn thiếu; dấu ◐/✅ mâu thuẫn trong `01-features.md`                 | Review độc lập | Chỉ còn "đính kèm/chia sẻ"; đồng bộ dấu "câu nên nói" với debrief; sửa quy tắc ✅              |
| P2-25 không có cỡ; cụm "cần ADR" không thống nhất; phụ thuộc và bảng điều kiện trùng lệch   | Review độc lập | Thêm cỡ, thống nhất "cần ADR, hỏi người", Đợt 0 chỉ ghi phần còn thiếu, bảng điều kiện một chỗ |
| Đợt 4 trống lời hứa; cổng Đợt 0/1 không có ngưỡng                                           | Review độc lập | Thêm lời hứa và ngưỡng giả định                                                                |

## Việc ngoài phạm vi, nên làm riêng

"Giai đoạn 2/3" theo nghĩa cũ (Learn/Coach) còn ở `08-adr/0002-desktop-tauri-swift.md`, `03-architecture/05-learner-model.md`, `04-modules/03-api/learner.md`, `04-modules/01-desktop/audio-capture.md`, `04-modules/05-packages/learner-model.md`, `07-research/01-open-source.md` và các brief trong `06-delivery/2026-11-06-phase2`. Cần một task quét và đổi sang "Đợt" (ADR 0002 còn ghi Windows ở "giai đoạn 2", mâu thuẫn với Đợt 4).
