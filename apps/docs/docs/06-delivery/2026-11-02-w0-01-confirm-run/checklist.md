# W0-01 — Danh sách kiểm một lượt chạy thật

Một lượt thử trên máy dev (bản `.app` khi có P2-09) xác nhận cùng lúc các việc ◐ của [Đợt 0](../../02-product/06-backlog.md#đợt-0--beta-kín--hiểu-được-cuộc-họp-hôm-nay) và AC7 của P2-04. Điền cột **Kết quả** (✅ / ❌ + ghi chú), rồi đưa lại cho Claude để đổi dấu trong backlog và mở lỗi cho mục ❌. Mục nào không thử được thì để trống, không đánh ✅.

## Chuẩn bị (một lần)

```bash
docker compose -f infra/docker-compose.yml up -d
pnpm db:migrate                              # cần .env: cp .env.example .env
pnpm --filter @cuelingo/api dev              # API
pnpm --filter @cuelingo/workers dev          # debrief, tts
pnpm --filter @cuelingo/web dev              # web http://localhost:3000
pnpm --filter @cuelingo/desktop tauri dev    # app desktop (nhánh feat/glossary-to-stt cho AC7)
```

Cần: một API key LLM trong `.env`, `ADMIN_EMAILS=<email của bạn>` để mở trang số liệu, quyền Micro và Thu âm hệ thống cho app.

## Danh sách kiểm

| #   | Việc         | Làm gì                                                                                                             | Mong đợi                                                                                                                | Kết quả |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------- |
| 1   | P2-01        | Mở app chưa đăng nhập, bấm đăng nhập, hoàn tất magic link ở web                                                    | Trình duyệt mở `cuelingo://auth?code=…`, app đăng nhập, tên hiện ở góc; tắt mở lại vẫn đăng nhập                        |         |
| 2   | P2-14        | Đăng nhập tài khoản mới (hoặc xoá khoá `cuelingo.onboarded.<userId>` trong localStorage của app)                   | Onboarding 4 bước: chào, cấp quyền với trạng thái thật, thử caption mẫu, chọn mức hỗ trợ; lần sau không hiện lại        |         |
| 3   | P2-15        | Đổi mức hỗ trợ mặc định và ngôn ngữ giao diện ở Cài đặt, thoát app, mở lại; mở Cài đặt web                         | Giá trị còn nguyên ở app; web hiện cùng giá trị                                                                         |         |
| 4   | Caption      | Bắt đầu cuộc họp (⌘⇧L) rồi phát video tiếng Anh hoặc họp Zoom/Meet 5 phút                                          | Caption gốc ≤ ~1 s, bản dịch ≤ ~2,5 s; overlay không hiện khi chia sẻ màn hình                                          |         |
| 5   | AC7 P2-04    | Thêm "SLA" ở trang Thuật ngữ trước; trong họp nói/phát câu "the SLA is tight"                                      | Caption gốc hiện "SLA", không phải "sla"/"slaw". Ghi từ thường bị sửa nhầm (nếu có)                                     |         |
| 6   | AC2 P2-04    | Đang họp, thêm một thuật ngữ mới, chờ ≤ 5 giây, nói câu chứa nó                                                    | Thuật ngữ mới được sửa mà không phải dừng họp                                                                           |         |
| 7   | Quick Assist | Bấm một từ trong caption (tra từ), ⌘⇧W (họ vừa nói gì), ⌘⇧S + gõ tiếng Việt (nói giúp)                             | Popup tra từ ≤ ~1,5 s; tóm tắt 60 giây ≤ ~3 s; hai câu tiếng Anh ≤ ~2 s                                                 |         |
| 8   | P2-16        | Dừng họp, mở debrief; bấm một đoạn khó, lọc theo người nói, sao chép, tải Markdown, theo dõi trạng thái "đang tạo" | Debrief ≤ 2 phút, đủ 5 khối; bấm đoạn khó nhảy tới đúng câu; các nút chạy được                                          |         |
| 9   | P3-08        | Tạo sự kiện lịch "Tokyo sync" trong 15 phút tới, mở app                                                            | Thẻ gợi ý "đổi sang tiếng Nhật?" hiện một lần; bấm bỏ thì không hiện lại. (Tiếng Nhật đang tắt, nên chỉ kiểm thẻ gợi ý) |         |
| 10  | P2-20        | Đăng nhập web bằng email trong `ADMIN_EMAILS`, mở `/admin/metrics`                                                 | Trang số liệu H1–H5 hiện, có số cuộc họp vừa chạy và chi phí AI                                                         |         |
| 11  | P2-23        | Đăng nhập web bằng Google và bằng magic link (email thật nếu đã cấu hình nhà cung cấp)                             | Cả hai vào được; ghi rõ cái nào dùng khoá/domain thật, cái nào chỉ chạy ở dev                                           |         |

## Ghi lại

- Máy, phiên bản macOS, bản chạy (`tauri dev` hay `.app`):
- Lỗi và hành vi lạ (kèm bước tái hiện):
- Số đo: độ trễ caption/dịch, CPU/RAM sau 30 phút (nếu có):
