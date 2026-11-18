# overlay-mic-mute — Nút tắt mic trên overlay

| Trạng thái | Loại    | Nhánh / PR              | Ước lượng → thực tế |
| ---------- | ------- | ----------------------- | ------------------- |
| Review     | feature | `feat/overlay-mic-mute` | _? → ?_             |

**Phạm vi:** trong: nút bật/tắt micro trên thanh overlay, tắt thật ở sidecar macOS và Windows, trạng thái hiển thị ở overlay và cửa sổ chính · ngoài: tắt tiếng âm thanh hệ thống, phím tắt toàn cục, nhớ trạng thái giữa các cuộc họp.

## 1. Vấn đề

Khi đang nghe, người dùng muốn ngừng ghi giọng mình (nói chuyện riêng, ho, người khác vào phòng) mà không dừng cả cuộc họp. Hiện chỉ dừng được cả phiên. Micro vẫn mở nên chấm cam của macOS vẫn sáng và giọng vẫn được nhận dạng/dịch.

- **Module chạm tới:** `04-modules/01-desktop` (overlay, session, tauri-core), sidecar macOS/Windows.

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                           | Test                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| AC1 | WHILE đang nghe, THE SYSTEM SHALL hiện nút micro trên thanh overlay, có nhãn và trạng thái (đang bật / đã tắt).              | CaptionOverlay.test       |
| AC2 | WHEN người dùng bấm nút, THE SYSTEM SHALL gửi lệnh tắt/bật micro tới sidecar và đổi trạng thái nút.                          | native / session test     |
| AC3 | WHILE micro tắt, THE SYSTEM SHALL không bắt, không nhận dạng và không gửi âm thanh micro đi đâu; âm thanh hệ thống vẫn chạy. | sidecar + controller test |
| AC4 | WHILE micro tắt, THE SYSTEM SHALL hiện chỉ báo "Micro đã tắt" ở overlay và ở thanh trạng thái cửa sổ chính.                  | UI test                   |
| AC5 | WHEN cuộc họp kết thúc hoặc bắt đầu mới, THE SYSTEM SHALL đặt micro về bật.                                                  | controller test           |
| AC6 | IF micro không mở được (không quyền), THEN THE SYSTEM SHALL ẩn/vô hiệu nút và giữ thông báo lỗi hiện có.                     | UI test                   |

## 3. Câu hỏi mở

- [ ] Có cần phím tắt (ví dụ ⌘⇧M) không? Mặc định: không, để sau.
- [ ] Debrief ghi chú các đoạn micro tắt không? Mặc định: không.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                   |
| ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-18 | Spec | Mở hồ sơ. Người dùng chọn: nút trên thanh overlay + tắt thật ở sidecar.                                                                         |
| 2026-11-18 | Plan | Duyệt plan (phương án A: sidecar đóng hẳn luồng micro).                                                                                         |
| 2026-11-18 | Làm  | Thêm vào phạm vi theo yêu cầu người dùng giữa chừng: chữ caption đen/trắng thật, không bị mờ (token `--caption-text`); tách thành commit riêng. |
