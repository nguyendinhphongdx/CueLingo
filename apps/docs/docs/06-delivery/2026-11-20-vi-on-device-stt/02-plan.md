# Plan — vi-on-device-stt

## 1. Bối cảnh code

Bộ đo hiện có ở `ml/bench` chỉ cho tiếng Anh: `prep_data.py` (AMI, Earnings-22), `stt_bench.py` (runner theo model, WER qua `jiwer` + bộ chuẩn hoá Whisper tiếng Anh, RTF, ghi `results/stt_summary.jsonl`). Bộ chuẩn hoá đó **không dùng được** cho tiếng Việt (sẽ bỏ dấu hoặc sai ký tự). Dữ liệu và cache nằm ngoài git (`ml/bench/data/`, `.hf/`). MLX cần Metal nên phải chạy ngoài sandbox. Convention: Python chỉ trong `ml/`; không đụng code sản phẩm.

## 2. Phương án

| #   | Phương án                                                                                                                                      | Ưu                                                                                      | Nhược                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| A   | Thêm `prep_data_vi.py` + `stt_bench_vi.py` vào `ml/bench`, đo theo từng đoạn thu sẵn (offline), model chạy bằng Python (NeMo/MLX, sherpa-onnx) | Rẻ, nhanh, cùng khuôn với bộ đo tiếng Anh, so được WER giữa các model trên cùng dữ liệu | RTF đo ở Python không bằng RTF thật trong sidecar; chưa đo độ trễ streaming thật                               |
| B   | Đo thẳng trong sidecar (Swift FluidAudio / Rust sherpa-onnx) với luồng âm thanh thật                                                           | Số đo sát sản phẩm (độ trễ cuối câu, bộ nhớ thật)                                       | Phải port model vào sidecar trước khi biết nó có đáng không; tốn nhiều ngày; dễ lẫn lỗi tích hợp với lỗi model |

**Chọn:** A. Mục tiêu của task là quyết định có đáng đầu tư tích hợp hay không; A trả lời bằng chi phí nhỏ nhất. Nếu có model đạt thì B là task sau (hồ sơ riêng). Chưa cần ADR: kết quả chỉ là số đo, ADR viết sau nếu quyết định đổi.

| Tác động                            | Có?   | Chi tiết                                                                                         |
| ----------------------------------- | ----- | ------------------------------------------------------------------------------------------------ |
| DB migration                        | Không |                                                                                                  |
| Contract (`@cuelingo/shared`)       | Không |                                                                                                  |
| Event / Learner Model               | Không |                                                                                                  |
| Prompt / model AI                   | Không | Chỉ gọi Gemini cho mốc so sánh, trong `ml/bench`, bằng khoá do chủ sản phẩm cung cấp qua `.env`. |
| Quyền riêng tư / dữ liệu người dùng | Có    | Chỉ tập công khai và câu chủ sản phẩm tự thu; gửi âm thanh lên Gemini chỉ cho đúng các tập đó.   |

## 3. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                                                                                                                                                                                                          | File                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | Dữ liệu: tải 80 đoạn tiếng Việt thuần (VIVOS hoặc FLEURS-vi, 3–25 giây, 16 kHz) vào `data/vi/`; đọc đoạn tiếng Việt xen tiếng Anh do chủ sản phẩm thu vào `data/vi_mixed/` cùng file `.jsonl` lời chuẩn.      | `ml/bench/prep_data_vi.py`              |
| 2   | Bộ đo: chuẩn hoá tiếng Việt (NFC, chữ thường, bỏ dấu câu, **giữ dấu thanh**), WER qua `jiwer`, RTF, bộ nhớ đỉnh (`resource`), p95 thời gian xử lý mỗi đoạn; runner cho Parakeet-CTC vi, Zipformer vi, Gemini. | `ml/bench/stt_bench_vi.py`, `README.md` |
| 3   | Chạy: tải model (xin phép theo từng model, ghi kích thước), đo hai tập, ghi `results/stt_vi_summary.jsonl`. Đo trên máy của chủ sản phẩm; ghi cấu hình máy (chip, RAM).                                       | `ml/bench/results/stt_vi_*`             |
| 4   | Kết luận: `03-review.md` với bảng WER/RTF/RAM, so với mốc Gemini, đạt hay không theo mốc ở spec, đề xuất tiếp; sửa `ADR 0014` chỉ bằng ghi chú "đã đo" nếu cần, không đổi quyết định.                         | `03-review.md`                          |

## 4. Rủi ro

| Rủi ro                                                                                        | Giảm thiểu                                                                                                                               |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Parakeet-CTC vi cần NeMo (nặng) hoặc chưa có bản MLX; bản CoreML cộng đồng khó chạy từ Python | Thử NeMo trên CPU trước, hoặc bản ONNX; nếu không chạy được trong thời gian hợp lý thì ghi rõ "chưa đo được" và nêu lý do, không bịa số. |
| Tập tiếng Việt thuần công khai khác giọng họp thật, WER đẹp hơn thực tế                       | Ghi rõ trong kết luận; tập xen tiếng Anh do chủ sản phẩm thu là phép thử chính.                                                          |
| Chủ sản phẩm chưa có 30 câu thu sẵn                                                           | Bước 1 dừng và hỏi; có thể thu nhanh bằng QuickTime, hoặc đo trước tập thuần rồi bổ sung sau.                                            |
| Chuẩn hoá số và từ mượn làm WER lệch giữa model                                               | Dùng đúng một bộ chuẩn hoá cho mọi model; lưu cả `ref` và `hyp` để xem tay các câu sai nhiều.                                            |
| Tải model nặng, tốn dung lượng/băng thông                                                     | Xin phép trước từng lần tải, nêu nguồn và kích thước; cache trong `.hf/` (đã ngoài git).                                                 |
