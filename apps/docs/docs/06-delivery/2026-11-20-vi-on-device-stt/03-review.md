# Kết quả — vi-on-device-stt

**Kết luận ngắn:** trên giọng đọc sạch, Zipformer tiếng Việt chạy trên máy đủ nhanh và đủ nhẹ, WER 6,84% với bản 30M. Trên câu họp có xen thuật ngữ tiếng Anh, WER tăng gấp đôi (14,7%) và lỗi tập trung ở chính các thuật ngữ đó. **Giữ nguyên [ADR 0014](../../08-adr/0014-cloud-stt-for-vietnamese.md)**; Zipformer chỉ là phương án dự phòng không cần mạng. Phép thử xen tiếng Anh mới dùng giọng tổng hợp, chưa phải giọng người thật, và vẫn thiếu mốc Gemini.

## Số đo

Máy: Apple M1 Pro, 16 GB. Chạy CPU qua sherpa-onnx 2.0.2, greedy search. Kết quả từng câu: `ml/bench/results/stt_vi_*`.

- Tập `vi`: 80 câu FLEURS vi_vn (validation), 15,6 phút giọng đọc.
- Tập `vi_mixed`: 27 câu họp tiếng Việt xen thuật ngữ tiếng Anh (sprint, deploy, dashboard…), **giọng tổng hợp Gemini TTS** (`gemini-2.5-flash-preview-tts`, nhiều giọng), 1,7 phút. Lời chuẩn là chính câu đã viết. Ba câu dưới 3 giây bị loại. Giọng tổng hợp sạch hơn họp thật nên đây là mức sơ bộ, có thể lạc quan.

| Model                           | Kích thước | WER `vi` | WER `vi` bỏ câu có chữ số | WER `vi_mixed` | RTF   | p95 mỗi đoạn | RAM đỉnh |
| ------------------------------- | ---------- | -------- | ------------------------- | -------------- | ----- | ------------ | -------- |
| Zipformer vi 30M INT8 (2026-02) | 26 MB      | 6,84%    | 3,96%                     | **14,72%**     | 0,011 | 0,24 giây    | ~510 MB  |
| Zipformer vi INT8 (2025-04)     | 60 MB      | 7,75%    | 5,31%                     | **19,02%**     | 0,013 | 0,26 giây    | ~520 MB  |

(RTF và p95 là số của lần chạy cuối cùng, trong cùng phiên đo với `vi_mixed`; lần đo đầu chỉ có `vi` cho RTF 0,009–0,010.)

### Lỗi trên câu xen tiếng Anh

Mô hình nghe từ tiếng Anh như tiếng Việt rồi viết theo âm, nên thuật ngữ sai còn phần câu tiếng Việt đúng. Ví dụ (bản 30M, ref → hyp):

| Ref                | Hyp                    |
| ------------------ | ---------------------- |
| ticket / Jira      | tích kết / zira        |
| standup            | stan updap             |
| subtask            | shop task              |
| dashboard          | dasport                |
| timeout / database | tha mao / data squerry |
| latency / endpoint | latin c / anp          |
| engineer / release | entry / relist         |
| onboard            | on boss                |

Từ phổ biến đã quen (deploy, production, backend, server, update) thì đúng.

## Đối chiếu với AC

| AC  | Trạng thái   | Ghi chú                                                                                                                   |
| --- | ------------ | ------------------------------------------------------------------------------------------------------------------------- |
| AC1 | Đạt          | `prep_data_vi.py`, `stt_bench_vi.py`, kết quả ghi `results/stt_vi_*`.                                                     |
| AC2 | **Một phần** | Đo hai Zipformer. **Không có mốc Gemini** (người dùng bỏ qua) và **chưa đo Parakeet-CTC** (2,4 GB + NeMo, chưa xin tải).  |
| AC3 | **Một phần** | Có tập xen tiếng Anh nhưng bằng **giọng tổng hợp**, không phải bản thu của người dùng.                                    |
| AC4 | Đạt          | RTF 0,009–0,010 (mục tiêu ≤ 0,5), p95 mỗi đoạn dưới 0,25 giây. Đo theo từng đoạn thu sẵn, chưa phải luồng streaming thật. |
| AC5 | Một phần     | Kết luận này; chưa so được với Gemini nên chưa trả lời "kém bao nhiêu".                                                   |
| AC6 | Đạt          | Không sửa code sản phẩm, registry hay dữ liệu người dùng.                                                                 |

## Điều số đo không nói lên

- FLEURS và giọng tổng hợp đều sạch; họp thật có nói chồng, ồn, giọng vùng miền, người Việt phát âm từ Anh theo nhiều kiểu. WER thật sẽ cao hơn 14,7%, chưa biết bao nhiêu.
- Giọng tổng hợp phát âm từ Anh kiểu máy nên có thể hơi khác cách người Việt nói; chiều ảnh hưởng chưa rõ.
- Đầu ra Zipformer là **chữ HOA, không dấu câu, số viết thành chữ**. Caption cần thêm bước viết hoa, đặt dấu câu và đổi số; Gemini đang làm sẵn. Chi phí bước này chưa đánh giá.
- RTF đo trên Python/CPU, chưa phải trong sidecar; Windows chưa thử.

## Đề xuất tiếp

| Hướng                                                                                                 | Khi nào                                                                                |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Thu khoảng 30 câu họp xen tiếng Anh bằng giọng thật, đo lại hai Zipformer (và mốc Gemini nếu muốn so) | Trước mọi quyết định đổi hướng. Bộ tổng hợp chỉ là sơ bộ.                              |
| Đo Parakeet-CTC Vietnamese                                                                            | Zipformer đã thua rõ trên thuật ngữ Anh, nên đáng đo; cần xin phép tải 2,4 GB và NeMo. |
| Giữ Gemini cho họp tiếng Việt, coi Zipformer là phương án dự phòng không cần mạng                     | **Hiện tại.** Zipformer chưa đủ tốt cho họp nhiều thuật ngữ Anh.                       |
| Mở hồ sơ riêng tích hợp Zipformer vào sidecar (đã có đường sherpa-onnx ở bản Windows)                 | Chỉ khi đạt mốc ở spec và có ADR mới thay ADR 0014.                                    |
