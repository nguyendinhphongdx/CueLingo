# 0004 · Dịch bằng LLM qua ai-gateway

**Trạng thái:** Proposed · 2026-10-31

## Bối cảnh
Benchmark EN→VI: LLM cỡ 4B (TranslateGemma 4B, Qwen3-4B) đạt COMET ~85, p95 ~1,5 s trên M1 Pro; opus-mt nhanh nhưng COMET 75,9. TranslateGemma 12B chỉ hơn ~0,7 COMET nhưng chậm gấp 3 lần. Chưa so với LLM cloud.

## Quyết định (đề xuất)
- Dịch phía server qua `ai-gateway`, task `translate.realtime`, prompt `translate.v1` (câu + 3 câu trước + glossary).
- Model mặc định chốt sau khi so TranslateGemma 4B / Qwen3-4B (self-host) với 1 LLM cloud nhỏ về COMET, độ trễ và chi phí.
- Không dùng NLLB/Seamless (CC-BY-NC).

## Hệ quả
- Đổi model không cần sửa code sản phẩm.
- Chế độ dịch on-device (MLX/llama.cpp trong app) để giai đoạn sau, nếu cần offline.
