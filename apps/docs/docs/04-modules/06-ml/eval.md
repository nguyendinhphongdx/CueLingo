# Eval

> Phần: [ML & evaluation](./README.md) · Code: `ml/eval/`

Bộ test hồi quy cho prompt/model: dịch, recap, debrief. Chạy trước mỗi lần đổi model hoặc prompt.

## Trách nhiệm

- Golden set 20 cuộc họp (được phép dùng)
- Chấm tự động (COMET, LLM-as-judge) + mẫu cho người review
- Báo cáo so sánh phiên bản

## Phạm vi MVP

- Tiêu chí nghiệm thu: WER ≤ 12%, ≥ 90% câu dịch đúng ý

## Bộ mẫu theo ngôn ngữ

Mỗi ngôn ngữ muốn bật cho người dùng (ADR 0013) phải qua cổng này trước khi `enabled: true` trong `SUPPORTED_LANGUAGES`:

- **Dịch:** các ca `ja: …` trong `packages/prompts/src/translate/fixtures/cases.ts` (hạn chót, thuật ngữ, ngữ cảnh, lối nói giảm kiểu "検討させていただきます", đã là tiếng Việt). Chạy: `pnpm --filter @cuelingo/api exec tsx --env-file=../../.env ../../packages/ai-gateway/scripts/eval-translate.ts`.
- **Tra từ, tóm tắt, soạn câu:** chạy tay vài câu có `language` và kiểm tra: tra từ trả `reading` (hiragana), soạn câu trả câu tiếng Nhật lịch sự.
- **Nhận dạng:** chạy sidecar với `CUELINGO_LANGUAGE=<mã> cuelingo-audio --file mẫu.wav`; cuối phiên sidecar in `{"type":"stats"}` với p50/p95 mỗi câu. Bản ghi giọng người thật (cuộc họp, giọng Nhật) cần có trước khi bật cho người dùng; bản tổng hợp bằng `say` chỉ là kiểm tra khói.

## Interface

- `python run_eval.py --task translate --prompt v2`

## Phụ thuộc

- (chưa có)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- Nguồn 20 cuộc họp test có đồng ý
