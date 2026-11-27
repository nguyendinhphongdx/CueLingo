# Review — meeting-assistant

**Trạng thái:** đã duyệt kết quả, đã commit trên `feat/meeting-assist` · 2026-11-27 · chưa push · [spec](./01-specs.md) · [plan](./02-plan.md)

## Thay đổi so với plan

| Dấu         | File / hành vi                              | Chi tiết (lý do nếu khác plan)                                                                              |
| ----------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 🟢 ADDED    | Tauri command `set_ask_hotkey`              | Chỉ giữ phím toàn cục khi máy chủ bật trợ lý (phát hiện khi review)                                         |
| 🟢 ADDED    | `CaptionOverlayDrawer.test.tsx`             | Test ngăn kéo dùng chung, file riêng vì cần môi trường jsdom                                                |
| 🟡 MODIFIED | Phím "hỏi"                                  | ⌘⇧Y / Ctrl+Shift+Y thay cho ⌘⇧K; chưa thử trong Zoom/Meet/Teams                                             |
| 🟡 MODIFIED | `AiGateway.ask`                             | Plan ghi `askStream`                                                                                        |
| 🟡 MODIFIED | Khoá "một câu mỗi người"                    | Mở ngay khi client ngắt, không đợi lưu xong, để Dừng rồi hỏi lại không gặp 409                              |
| 🟡 MODIFIED | Dòng `streaming` còn sót                    | Xuất ra là `error` ngay, không chờ 10 phút                                                                  |
| 🟡 MODIFIED | Thứ tự làm                                  | Không chờ task ai-provider-failures (đã nói khi duyệt plan); phần trùng: gateway, `ai-calls`, mã lỗi, usage |
| 🔴 REMOVED  | Nút "Soạn câu từ ý này"                     | Tuỳ chọn trong plan, chưa làm                                                                               |
| 🔴 REMOVED  | Màn xem lại hỏi đáp; trần chi tiêu toàn cục | Lệch spec đã duyệt ở cổng PLAN (cùng với eval đặt ở `packages/ai-gateway/scripts/`)                         |

**Docs đã cập nhật:** trang mới `04-modules/03-api/meeting-assist.md`; privacy, usage; shared, prompts, ai-gateway, core-sdk, ui; quick-assist, settings, tauri-core; kiến trúc 06, 07, 08; sản phẩm 03 (US-17), 04, 05; ADR 0027.

**Chưa cập nhật:** chính sách quyền riêng tư công khai (repo chưa có trang; [bản nháp đoạn trợ lý](./privacy-draft.md)); trang `overlay.md` và `session-controller.md`.

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md):

- [x] Ranh giới & bảo mật
- [x] Hợp đồng
- [x] Kiến trúc
- [x] Phạm vi
- [ ] Docs: còn mục "Chưa cập nhật" ở trên
- [ ] AI: có prompt `meeting.ask@v1` và test, **chưa chạy eval** (cần `GEMINI_API_KEY`)
- [ ] Test: unit xanh, **integration chưa chạy**

```bash
pnpm verify              # xanh: 327 file, 2691 test, check:deps sạch (Node 22.14, dưới mức 22.19)
pnpm docs:build          # xanh
cargo check --offline    # qua, dùng file sidecar giữ chỗ rồi xoá
```

Review độc lập (agent `code-reviewer`): REQUEST_CHANGES với 1 lỗi chặn merge. Đã sửa như bảng cuối trang; **các bản sửa chưa được review lại**.

**Chưa chạy thật.** Còn thiếu:

| Việc                                                       | AC          |
| ---------------------------------------------------------- | ----------- |
| `pnpm test:int` (cần Docker)                               | 10, 16, 17  |
| Eval AI `packages/ai-gateway/scripts/eval-meeting-ask.ts`  | 7, 12, 13   |
| Một cuộc họp thật trong app, xem giao diện                 | 1, 5, 6, 11 |
| Đo độ trễ chữ đầu                                          | 3           |
| Chia sẻ màn hình Zoom/Meet; phím tắt trong Zoom/Meet/Teams | 21          |

## Điều kiện phát hành

1. Deploy API (migration mới) **trước** bản desktop: desktop mới bắt buộc có `meeting_ask_daily` trong `/v1/me/usage`; server cũ làm hỏng bảng hạn mức và cảnh báo hạn mức đầu cuộc họp.
2. `MEETING_ASSIST_ENABLED` mặc định **bật** (chủ sản phẩm quyết khi phát hành). Còn nợ: chạy eval, công bố chính sách quyền riêng tư có [đoạn về trợ lý](./privacy-draft.md). Tắt khẩn cấp: đặt `false` rồi `infra/tunnel/tunnel.sh reload`.
3. Chỉ có trần theo người, chưa có trần chi tiêu toàn hệ thống.

## Cho người review — đọc theo thứ tự

| #   | File                                                                      | Soi gì                            |
| --- | ------------------------------------------------------------------------- | --------------------------------- |
| 1   | `services/api/src/modules/meeting-assist/meeting-assist.service.ts`       | Thứ tự cổng kiểm, Dừng, khoá, log |
| 2   | `meeting-assist.context.ts`, `retrieval.ts`                               | Dữ liệu nào được gửi đi           |
| 3   | `meeting-assist.repository.ts`                                            | Lọc theo người, tìm cuộc họp cũ   |
| 4   | `infra/db/migrations/20261127090000_meeting_assist.sql`, module `privacy` | Lưu, xoá, xuất                    |
| 5   | `packages/prompts/src/meeting-ask/v1.ts`                                  | Dữ liệu không tin cậy, nhãn nguồn |
| 6   | `apps/desktop/src/quick-assist/`, `overlay/CaptionOverlay.tsx`            | Đồng ý, ngăn kéo dùng chung       |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                                                              | Tìm ở  | Sửa                                                |
| ---------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------- |
| 🔴 Từ trong câu hỏi khớp tên trường JSON của debrief, gửi nhầm cuộc họp cũ                                       | Review | Chỉ ghép giá trị (SQL và repo bộ nhớ), thêm test   |
| 🟡 Dừng rồi hỏi lại ngay gặp 409                                                                                 | Review | Mở khoá khi client ngắt, thêm test                 |
| 🟡 Phím tắt bị chiếm cả khi tính năng tắt                                                                        | Review | `set_ask_hotkey` theo trạng thái máy chủ           |
| 🟡 Desktop mới với server cũ hỏng phần hạn mức                                                                   | Review | Không sửa code; ghi điều kiện phát hành            |
| 🟡 Thiếu test ngăn kéo dùng chung và ca quá giờ                                                                  | Review | Đã thêm (ca quá giờ nằm trong int test, chưa chạy) |
| 🟢 Quá giờ tìm kiếm không vào log; một ghi chú dài chặn các thuật ngữ sau                                        | Review | Đã sửa                                             |
| 🟢 Bấm "Giải thích" lúc đang trả lời không phản hồi                                                              | Review | Đưa ngăn kéo trợ lý ra trước                       |
| 🟢 Câu đã Dừng không hiện nhãn nguồn; lượt bị trừ nếu họp bị xoá đúng lúc hỏi; DB treo giữ khoá của câu đang lưu | Review | Để nguyên                                          |
| Test ngăn kéo chờ cố định nên đỏ khi chạy cả bộ                                                                  | Verify | Chờ tới khi điều kiện đúng                         |
