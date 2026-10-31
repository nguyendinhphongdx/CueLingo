# 0010 · AI gateway xây trên Vercel AI SDK

**Trạng thái:** Accepted · 2026-10-31

## Bối cảnh

`@cuelingo/ai-gateway` phải gọi nhiều nhà cung cấp LLM, đổi model không sửa code sản phẩm, có đầu ra có cấu trúc (debrief) và streaming. Viết adapter riêng cho từng nhà cung cấp tốn công và dễ sai.

## Quyết định

- Bên trong gateway dùng **Vercel AI SDK** (`ai` + gói provider): `generateText`, `streamText`, `generateObject` với schema Zod.
- Code sản phẩm **không** import `ai` hay provider. Code sản phẩm gọi `ai.llm('<task>', input)` của gateway (ESLint chặn import ở nơi khác).
- Gateway giữ phần riêng của ta: bảng task → model, timeout, fallback, ghi `ai_call` (token, chi phí, độ trễ, prompt version).
- STT cloud và TTS: adapter riêng trong gateway khi chọn được nhà cung cấp.

## Phương án đã cân nhắc

- **Gọi SDK từng nhà cung cấp trực tiếp:** kiểm soát tối đa, nhưng phải tự viết structured output, retry, streaming cho từng bên.
- **LiteLLM proxy:** mạnh, nhưng thêm một service Python phải vận hành.

## Hệ quả

- Thêm `ai` và gói provider vào `ai-gateway` (cập nhật danh sách cho phép trong ESLint).
- Model self-host (TranslateGemma/Qwen) phải có endpoint tương thích OpenAI để dùng chung đường gọi.
