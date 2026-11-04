# menubar-status — Biểu tượng trên thanh menu macOS cho biết app đang nghe

| Trạng thái | Loại    | Nhánh / PR             | Ước lượng → thực tế |
| ---------- | ------- | ---------------------- | ------------------- |
| Kết quả    | feature | `feat/m1-live-caption` | _1 ngày → ?_        |

**Phạm vi:** trong: biểu tượng đơn sắc dạng template ở thanh menu, ba trạng thái (rảnh, đang nghe, cảnh báo thu âm), chữ thời lượng cạnh biểu tượng khi đang nghe, menu có "Dừng họp" · ngoài: bắt đầu họp từ menu, thông báo hệ thống, giao diện tray trên Windows và Linux, đổi tên hay biểu tượng Dock.

## 1. Vấn đề

Khi đang họp, app chạy ẩn (đóng cửa sổ chính chỉ ẩn đi) và người dùng không có cách nào nhìn nhanh để biết CueLingo có đang nghe và gửi âm thanh hay không. App đã có biểu tượng ở thanh menu nhưng nó dùng đúng biểu tượng màu của app (không đơn sắc nên lệch với các biểu tượng hệ thống, khó đọc ở thanh menu tối hoặc sáng) và **không đổi gì** khi bắt đầu nghe. Với một app thu âm cuộc họp, việc "đang thu hay không" phải nhìn thấy được mà không cần mở cửa sổ (cả vì quyền riêng tư: người dùng cần biết âm thanh đang được thu và gửi đi).

- **Spec liên quan:** `apps/docs/docs/04-modules/01-desktop/tauri-core.md`, `session-controller.md`, `overlay.md`, ADR 0014 (chỉ báo "đang gửi âm thanh")
- **Module chạm tới:** `01-desktop/tauri-core.md`, `01-desktop/session-controller.md`

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                                                                                      | Test                                             |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| AC1 | WHEN app chạy THE SYSTEM SHALL hiện ở thanh menu một biểu tượng đơn sắc dạng template, đọc được trên thanh menu sáng và tối                                                                                                             | `cargo test` (chọn ảnh theo trạng thái), xem tay |
| AC2 | WHILE phiên đang chạy (kể cả lúc kết nối lại và lúc gửi nốt các câu cuối sau khi Dừng) THE SYSTEM SHALL đổi biểu tượng sang trạng thái "đang nghe" (có chấm màu) kèm chữ thời lượng cạnh biểu tượng và chú thích "CueLingo · đang nghe" | `tray-state.test.ts`, `cargo test`               |
| AC3 | IF micro hoặc âm thanh hệ thống không mở được trong lúc họp THEN THE SYSTEM SHALL hiện trạng thái cảnh báo (chấm màu hổ phách) và chú thích nói rõ luồng nào lỗi                                                                        | `tray-state.test.ts`                             |
| AC4 | WHEN phiên kết thúc hẳn THE SYSTEM SHALL trở về biểu tượng rảnh, không còn chữ                                                                                                                                                          | `tray-state.test.ts`                             |
| AC5 | THE SYSTEM SHALL có menu: "Mở CueLingo", "Dừng họp" (chỉ bật khi đang họp), "Hiện/ẩn overlay (⌘⇧L)", "Thoát" (tắt khi đang họp để không mất các câu cuối); chọn "Dừng họp" thì dừng phiên như bấm Dừng trong app                        | `tray-state.test.ts`, chạy thật                  |
| AC6 | WHILE cửa sổ chính đang ẩn THE SYSTEM SHALL vẫn cập nhật biểu tượng theo trạng thái phiên                                                                                                                                               | chạy thật                                        |
| AC7 | THE SYSTEM SHALL không đưa nội dung cuộc họp (văn bản, tiêu đề, tên người) lên thanh menu; chỉ có chữ cố định và thời lượng                                                                                                             | `tray-state.test.ts`                             |

## 3. Câu hỏi mở

- [x] **Màu trạng thái:** đỏ cho "đang nghe" và hổ phách cho cảnh báo (đề xuất), hay xanh lá cho đang nghe?
- [x] **Chữ cạnh biểu tượng:** chỉ chấm và thời lượng ("● 12:34", cập nhật mỗi phút để thanh menu không nhấp nháy), hay chỉ biểu tượng không chữ?
- [x] **"Thoát" khi đang họp:** tắt hẳn (đề xuất, vì Thoát giữa chừng mất các câu cuối), hay cho thoát kèm hỏi xác nhận?
- [x] **Bắt đầu họp từ menu** để làm sau (cần đi qua hộp thoại đồng ý và kiểm quyền), đúng chưa?
- [x] Nếu biểu tượng bị macOS giấu vì thanh menu quá đông (máy có tai thỏ), có cần thêm chỉ báo khác, ví dụ nhãn trên biểu tượng Dock khi đang nghe?

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                            |
| ---------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-03 | Spec | Mở hồ sơ theo yêu cầu của chủ sản phẩm: để app lên thanh menu, đổi màu và giao diện khi đang nghe                                                        |
| 2026-11-04 | Spec | Chủ sản phẩm duyệt, dùng đề xuất cho cả năm câu hỏi mở (đỏ/hổ phách, chấm + h:mm theo phút, Thoát tắt khi họp, bắt đầu từ menu để sau, nhãn Dock để sau) |
