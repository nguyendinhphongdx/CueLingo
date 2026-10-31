# Benchmark STT + dịch (31/10/2026)

Chạy hoàn toàn local trên MacBook M1 Pro 16 GB. **Parakeet-TDT 0.6B v3 + TranslateGemma 4B / Qwen3-4B (4-bit)** cho chất lượng tốt và ước tính ~1,5–2 giây từ lúc hết câu đến lúc hiện bản dịch. Script và kết quả từng câu: [`ml/bench/`](../../ml/bench/).

## STT tiếng Anh

WER càng thấp càng tốt. Tốc độ tính bằng số giây xử lý cho 1 phút audio (xử lý cả đoạn, chưa phải streaming).

| Model                       | Chạy trên | WER AMI (họp) | WER Earnings-22 (đa accent) | Giây / phút audio (AMI · E22) | License   |
| --------------------------- | --------- | ------------- | --------------------------- | ----------------------------- | --------- |
| Parakeet-TDT 0.6B v3        | GPU (MLX) | **7,95%**     | 9,32%                       | **2,6 · 3,7**                 | CC-BY-4.0 |
| Whisper large-v3-turbo      | GPU (MLX) | 14,27%        | **8,81%**                   | 8,9 · 6,2                     | MIT       |
| Whisper small               | GPU (MLX) | 14,98%        | 10,08%                      | 4,0 · 2,7                     | MIT       |
| faster-whisper small (int8) | CPU       | 15,83%        | 10,27%                      | 11,7 · 7,9                    | MIT       |

Trên AMI, Whisper large-v3-turbo có 131 lỗi xoá từ, so với 51 của Parakeet. Phần lớn là do nó bỏ qua đoạn nói lắp, nói lặp. Số lỗi thay thế từ của hai model gần bằng nhau (47 so với 44).

## Dịch EN→VI

200 câu IWSLT'15 (TED, văn nói), dịch từng câu riêng lẻ. COMET (wmt22-comet-da) càng cao càng tốt.

| Model                          | COMET     | chrF++    | BLEU      | Độ trễ p50 / p95  | License     |
| ------------------------------ | --------- | --------- | --------- | ----------------- | ----------- |
| TranslateGemma 12B (4-bit)     | **86,12** | **48,98** | 27,80     | 2,64 / 4,46 s     | Gemma Terms |
| TranslateGemma 4B (4-bit)      | 85,38     | 47,85     | 27,58     | 0,87 / 1,51 s     | Gemma Terms |
| Qwen3-4B-Instruct-2507 (4-bit) | 85,24     | 47,61     | 28,06     | 0,79 / 1,48 s     | Apache-2.0  |
| opus-mt-en-vi                  | 75,87     | 46,49     | **28,10** | **0,13 / 0,27 s** | Apache-2.0  |

BLEU gần như bằng nhau vì bản dịch tham chiếu của IWSLT khá tự do. COMET cho thấy opus-mt kém các LLM khoảng 10 điểm (hay lặp từ, dịch sát chữ). Model nào cũng có lỗi từ vựng cụ thể, ví dụ "vulture" bị dịch thành "vượn" hoặc "quạ".

## Kết luận → quyết định

- STT mặc định: Parakeet on-device ([ADR-0003](../adr/0003-stt-on-device-first.md)). Whisper large-v3-turbo dùng cho debrief và các ngôn ngữ ngoài phạm vi của Parakeet.
- Dịch: LLM cỡ 4B hoặc LLM cloud nhỏ qua `ai-gateway` ([ADR-0004](../adr/0004-translation-via-llm.md)). TranslateGemma 12B quá chậm cho realtime.

## Giới hạn và việc tiếp theo

- [ ] Đo streaming thật (partial/final) và đo end-to-end khi STT và dịch chạy cùng lúc. Đo cả RAM.
- [ ] Thêm 30–50 đoạn họp thật có accent Ấn, Nhật, Singapore, Việt; bản dịch tham chiếu do người làm.
- [ ] So với 1–2 STT cloud và 1 LLM cloud.
- [ ] Đo mức cải thiện khi thêm glossary và 3 câu ngữ cảnh vào prompt.
