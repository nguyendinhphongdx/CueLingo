# vi-on-device-stt — Đo model nhận dạng tiếng Việt chạy trên máy

| Trạng thái | Loại  | Nhánh / PR                  | Ước lượng → thực tế |
| ---------- | ----- | --------------------------- | ------------------- |
| Spec       | chore | `research/vi-on-device-stt` | _? → ?_             |

**Phạm vi:** trong: đo vài model tiếng Việt chạy trên máy (macOS Apple Silicon) trên cùng tập âm thanh, báo WER, tốc độ, bộ nhớ, xử lý từ tiếng Anh xen trong câu · kết luận có nên viết ADR thay [ADR 0014](../../08-adr/0014-cloud-stt-for-vietnamese.md) hay không · ngoài: tích hợp model vào sidecar, đổi `recognition` của `vi`, bản Windows, đổi nhà cung cấp đám mây.

## 1. Vấn đề

Họp tiếng Việt hiện nhận dạng bằng Gemini: âm thanh của cả hai luồng rời máy, cần mạng, có độ trễ đường mạng và phải có bước đồng ý trước ([ADR 0014](../../08-adr/0014-cloud-stt-for-vietnamese.md)). ADR đó chọn đám mây vì lúc ấy model trên máy có tiếng Việt còn beta và nặng. Từ đó có thêm vài ứng viên (xem 3), nhưng chưa ai đo trên dữ liệu của mình, nên chưa biết đã đủ dùng chưa.

- **Module chạm tới:** `ml/bench` (thêm bộ đo tiếng Việt). Không đụng code sản phẩm.
- **Quyền riêng tư:** chỉ dùng tập âm thanh công khai hoặc tự thu của chủ sản phẩm; không dùng cuộc họp của người dùng. Model tải về chạy tại máy, không gửi âm thanh đi đâu.

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                                  | Test |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| AC1 | THE SYSTEM SHALL có bộ đo `ml/bench` chạy một lệnh cho mỗi model và ghi `results/stt_vi_*.jsonl` (WER, RTF, bộ nhớ đỉnh), cùng cách ghi với bộ đo tiếng Anh hiện có.                |      |
| AC2 | THE SYSTEM SHALL đo ít nhất ba model: Parakeet-CTC 0.6B Vietnamese, Zipformer tiếng Việt (sherpa-onnx) và model đang dùng làm mốc (Gemini qua API hiện tại).                        |      |
| AC3 | THE SYSTEM SHALL đo trên hai loại dữ liệu: tiếng Việt thuần (tập công khai) và câu tiếng Việt có từ tiếng Anh xen (tự chọn hoặc tự thu), WER chuẩn hoá cùng một cách cho mọi model. |      |
| AC4 | WHEN một model chạy trên máy, THE SYSTEM SHALL báo RTF trên Apple Silicon; mục tiêu để caption realtime là RTF ≤ 0,5 và p95 độ trễ cuối câu ≤ 2 giây.                               |      |
| AC5 | THE SYSTEM SHALL ghi kết luận vào `03-review.md`: model nào đạt, đạt thua Gemini bao nhiêu, và đề xuất tiếp (viết ADR mới, đo thêm, hay giữ đám mây).                               |      |
| AC6 | THE SYSTEM SHALL không sửa code sản phẩm, registry ngôn ngữ hay dữ liệu người dùng trong task này.                                                                                  |      |

## 3. Ứng viên (từ khảo sát 2026-11-20, chưa đo)

| Ứng viên                         | Ghi chú                                                                  |
| -------------------------------- | ------------------------------------------------------------------------ |
| NVIDIA Parakeet-CTC 0.6B vi      | Cùng họ Parakeet đang dùng; có bản CoreML cộng đồng chạy qua FluidAudio. |
| Zipformer vi (sherpa-onnx, INT8) | Khoảng 75 MB; đã có đường sherpa-onnx ở bản Windows.                     |
| PhoWhisper (small hoặc medium)   | Whisper tinh chỉnh tiếng Việt; chưa có bản CoreML/ONNX đã kiểm.          |
| Cohere Transcribe                | Đã nêu ở ADR 0014; có tiếng Việt trong danh sách nhưng nặng.             |

## 4. Câu hỏi mở

- [ ] Dữ liệu tiếng Việt dùng tập nào? Mặc định: VIVOS hoặc FLEURS-vi cho tiếng Việt thuần; chủ sản phẩm thu khoảng 30 câu họp có xen tiếng Anh cho phần xen.
- [ ] Có đo Cohere Transcribe không? Mặc định: không, vì nặng (~7 GB RAM) và FluidAudio chưa kiểm tiếng Việt; chỉ đo nếu ba model đầu đều không đạt.
- [ ] Mốc chất lượng "đạt" là gì? Mặc định: WER không tệ hơn Gemini quá 3 điểm phần trăm trên tiếng Việt thuần, và không tệ hơn rõ rệt trên câu xen tiếng Anh.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                     |
| ---------- | ---- | ----------------------------------------------------------------- |
| 2026-11-20 | Spec | Mở hồ sơ theo yêu cầu của người dùng sau khảo sát; chưa tích hợp. |
