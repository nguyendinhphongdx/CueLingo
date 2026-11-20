# Kết quả — vi-on-device-stt

**Kết luận ngắn:** trên giọng đọc sạch, Zipformer tiếng Việt chạy trên máy đủ nhanh và đủ nhẹ, WER 6,84% với bản 30M. **Chưa đủ căn cứ để đổi quyết định của [ADR 0014](../../08-adr/0014-cloud-stt-for-vietnamese.md)**: thiếu mốc Gemini và thiếu phép thử chính (câu họp có xen tiếng Anh).

## Số đo

Máy: Apple M1 Pro, 16 GB. Tập `vi`: 80 câu FLEURS vi_vn (validation), 15,6 phút giọng đọc. Chạy CPU qua sherpa-onnx 2.0.2, greedy search. Kết quả từng câu: `ml/bench/results/stt_vi_*`.

| Model                           | Kích thước | WER   | WER bỏ câu có chữ số | RTF   | p95 mỗi đoạn | RAM đỉnh |
| ------------------------------- | ---------- | ----- | -------------------- | ----- | ------------ | -------- |
| Zipformer vi 30M INT8 (2026-02) | 26 MB      | 6,84% | 3,96%                | 0,009 | 0,18 giây    | ~500 MB  |
| Zipformer vi INT8 (2025-04)     | 60 MB      | 7,75% | 5,31%                | 0,010 | 0,21 giây    | ~530 MB  |

## Đối chiếu với AC

| AC  | Trạng thái   | Ghi chú                                                                                                                   |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Đạt          | `prep_data_vi.py`, `stt_bench_vi.py`, kết quả ghi `results/stt_vi_*`.                                                     |
| AC2 | **Một phần** | Đo hai Zipformer. **Không có mốc Gemini** (người dùng bỏ qua) và **chưa đo Parakeet-CTC** (2,4 GB + NeMo, chưa xin tải).  |
| AC3 | **Một phần** | Chỉ có tiếng Việt thuần. Tập xen tiếng Anh chưa có vì chưa có bản thu.                                                    |
| AC4 | Đạt          | RTF 0,009–0,010 (mục tiêu ≤ 0,5), p95 mỗi đoạn dưới 0,25 giây. Đo theo từng đoạn thu sẵn, chưa phải luồng streaming thật. |
| AC5 | Một phần     | Kết luận này; chưa so được với Gemini nên chưa trả lời "kém bao nhiêu".                                                   |
| AC6 | Đạt          | Không sửa code sản phẩm, registry hay dữ liệu người dùng.                                                                 |

## Điều số đo không nói lên

- FLEURS là giọng đọc sạch; họp thật có nói chồng, ồn, từ tiếng Anh xen. WER thật sẽ cao hơn, chưa biết bao nhiêu.
- Đầu ra Zipformer là **chữ HOA, không dấu câu, số viết thành chữ**. Caption cần thêm bước viết hoa, đặt dấu câu và đổi số; Gemini đang làm sẵn. Chi phí bước này chưa đánh giá.
- RTF đo trên Python/CPU, chưa phải trong sidecar; Windows chưa thử.

## Đề xuất tiếp

| Hướng                                                                                 | Khi nào                                                                                    |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Thu khoảng 30 câu họp xen tiếng Anh, đo lại hai Zipformer (và mốc Gemini nếu muốn so) | Trước mọi quyết định đổi hướng. Đây là phép thử quyết định.                                |
| Đo Parakeet-CTC Vietnamese                                                            | Nếu Zipformer thua rõ trên câu xen tiếng Anh, vì Parakeet có dấu câu và xuất Việt lẫn Anh. |
| Giữ Gemini cho họp tiếng Việt, coi Zipformer là phương án dự phòng không cần mạng     | Nếu phép thử xen tiếng Anh cho kết quả kém.                                                |
| Mở hồ sơ riêng tích hợp Zipformer vào sidecar (đã có đường sherpa-onnx ở bản Windows) | Chỉ khi đạt mốc ở spec và có ADR mới thay ADR 0014.                                        |
