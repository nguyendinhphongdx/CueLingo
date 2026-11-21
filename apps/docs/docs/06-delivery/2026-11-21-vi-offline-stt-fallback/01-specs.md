# vi-offline-stt-fallback — Nhận dạng tiếng Việt trên máy khi mất mạng

| Trạng thái | Loại    | Nhánh / PR                                          | Ước lượng → thực tế |
| ---------- | ------- | --------------------------------------------------- | ------------------- |
| Review     | feature | `feat/vi-offline-stt-fallback` (tách sau cổng spec) | _? → ?_             |

**Phạm vi:** trong: khi họp tiếng Việt mà đường nhận dạng đám mây không dùng được, tự chuyển sang Zipformer tiếng Việt chạy trên máy, tự quay lại đám mây khi có mạng · ngoài: thay [ADR 0014](../../08-adr/0014-cloud-stt-for-vietnamese.md) (Gemini vẫn là đường chính), Parakeet-CTC, dịch tiếng Việt, diarization, lưu transcript khi offline (xem §3).

## 1. Vấn đề

Họp tiếng Việt hiện **chỉ** nhận dạng được qua đám mây: mất mạng, hết hạn mức hay API lỗi thì caption tiếng Việt dừng hẳn và cuộc họp mất transcript. Họp tiếng Anh không bị vậy vì chạy trên máy ([ADR 0003](../../08-adr/0003-stt-on-device-first.md)).

Số đo ở [hồ sơ vi-on-device-stt](../2026-11-20-vi-on-device-stt/03-review.md) cho thấy Zipformer tiếng Việt (26 MB INT8, RTF ~0,01) đủ nhanh để dự phòng, nhưng chất lượng thấp hơn: WER 14,7% trên câu xen thuật ngữ tiếng Anh (giọng tổng hợp), thuật ngữ bị viết theo âm. Đầu ra là chữ HOA, không dấu câu, số viết thành chữ. Vì vậy chỉ dùng làm dự phòng và phải báo rõ cho người dùng.

- **Spec liên quan:** [ADR 0014](../../08-adr/0014-cloud-stt-for-vietnamese.md), [ADR 0003](../../08-adr/0003-stt-on-device-first.md), [ADR 0020](../../08-adr/0020-windows-capture-stt.md)
- **Module chạm tới:** `04-modules/01-desktop/local-stt.md`, `audio-capture.md`, `session-controller.md`, `overlay.md`, `settings.md`

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                                     | Test (dự kiến)                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| AC1 | WHILE họp tiếng Việt và đường đám mây lỗi liên tiếp (mất mạng, hết hạn mức, API lỗi) quá ngưỡng đã định THE SYSTEM SHALL chuyển sang nhận dạng trên máy mà không dừng cuộc họp.        | Test bộ chọn chế độ với đường đám mây giả  |
| AC2 | WHEN chuyển sang trên máy THE SYSTEM SHALL báo trên overlay, bằng tiếng Việt, rằng đang dùng chế độ ngoại tuyến và chất lượng có thể thấp hơn, kèm chỉ báo "không gửi âm thanh đi".    | Test component overlay                     |
| AC3 | WHEN đường đám mây dùng lại được THE SYSTEM SHALL quay về đám mây từ câu kế tiếp, không mất hay lặp câu ở chỗ nối.                                                                     | Test bộ chọn chế độ                        |
| AC4 | IF model tiếng Việt trên máy chưa có THEN THE SYSTEM SHALL không tự tải trong lúc họp; nó chỉ tải khi người dùng bật dự phòng trong Cài đặt, hiện tiến độ, kiểm kích thước và SHA-256. | Test tải/kiểm model (theo mẫu `models.rs`) |
| AC5 | IF model chưa có và mạng mất THEN THE SYSTEM SHALL báo rõ "chưa có model ngoại tuyến" thay vì im lặng.                                                                                 | Test trạng thái model                      |
| AC6 | WHEN nhận dạng trên máy trả chữ HOA không dấu câu THE SYSTEM SHALL chuẩn hoá thành chữ thường, viết hoa đầu câu; không bịa dấu câu hay đổi chữ.                                        | Test hàm chuẩn hoá                         |
| AC7 | THE SYSTEM SHALL đánh dấu mỗi segment nhận dạng trên máy bằng nguồn `local` để biết đoạn nào chất lượng thấp hơn.                                                                      | Test contract/segment                      |
| AC8 | THE SYSTEM SHALL giữ RTF ≤ 0,1 và p95 mỗi câu ≤ 1 giây trên máy M1 (mục tiêu hiện đo ~0,01 và 0,3 giây), RAM thêm ≤ 600 MB.                                                            | Đo bằng `--bench` (như S2)                 |
| AC9 | THE SYSTEM SHALL không ghi log hay lưu nội dung câu, audio hay đường dẫn; chỉ ghi độ dài, thời gian, trạng thái.                                                                       | Kiểm log + review                          |

## 3. Câu hỏi mở

- [x] **Nền tảng:** cả macOS và Windows (người dùng chọn 2026-11-21).
- [x] **Chỗ lấy model:** tải khi người dùng bật dự phòng, kiểm SHA-256; cần ADR cho nguồn mạng mới.
- [x] **Giấy phép (đã kiểm 2026-11-21, trang Hugging Face của model gốc):** bản 30M `hynt/Zipformer-30M-RNNT-6000h` là **CC-BY-NC-ND-4.0** (phi thương mại, cấm bản phái sinh), nên **không dùng được**. Bản 2025-04 `zzasdf/viet_iter3_pseudo_label` là **Apache-2.0**, nên dùng bản này (60 MB, WER 7,75% giọng sạch, 19,0% câu xen tiếng Anh). Còn phải kiểm điều khoản bản chuyển ONNX và dữ liệu huấn luyện trước khi phát hành.
- [ ] **Ngưỡng chuyển:** chưa hỏi; đề xuất ở plan (số lỗi liên tiếp hoặc số giây), kèm nút bấm tay nếu rẻ.
- [x] **Đồng ý:** chế độ ngoại tuyến không gửi âm thanh đi nên không cần xác nhận riêng; ghi rõ trong Cài đặt (mặc định đề xuất, người dùng không phản đối).
- [x] **Lưu transcript khi offline:** chỉ caption trực tiếp; đệm và gửi lại segment để hồ sơ riêng.
- [x] **Mặc định:** tắt; người dùng tự bật trong Cài đặt và khi đó mới tải model.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                          |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-11-21 | Spec | Mở hồ sơ theo yêu cầu "làm dự phòng khi mất mạng" sau kết quả đo; Gemini vẫn là đường chính, không thay ADR 0014.                                      |
| 2026-11-21 | Spec | Cổng SPEC được duyệt. Người dùng chọn: cả macOS và Windows; tải model khi bật; tắt mặc định; chỉ caption trực tiếp.                                    |
| 2026-11-21 | Spec | Kiểm giấy phép: loại bản 30M (CC-BY-NC-ND), chọn bản 2025-04 (Apache-2.0). Chất lượng thấp hơn bản 30M: WER 19,0% so với 14,7% trên câu xen tiếng Anh. |
