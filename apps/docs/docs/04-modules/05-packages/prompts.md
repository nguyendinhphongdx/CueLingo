# @cuelingo/prompts

> Phần: [Shared packages](./README.md) · Code: `packages/prompts/src/`

Prompt có phiên bản cho từng tác vụ AI, kèm schema đầu ra và fixture test.

## Trách nhiệm

- translate, lookup, recap, compose, debrief
- JSON schema cho đầu ra debrief
- Fixture dùng chung với `ml/eval`

## Phạm vi MVP

- Toàn bộ

## Interface

- `prompts.translate.v1.build({sentence, context, glossary})`

## Phụ thuộc

- `@cuelingo/shared`

## Dữ liệu & sự kiện

- (chưa có)

## Prompt mới

- `stt/v1`: chép lại đúng lời nói bằng ngôn ngữ của cuộc họp, chỉ trả văn bản, rỗng khi không có tiếng nói, không dịch.
- `debrief/v2`: debrief cho cuộc họp không cần dịch (tiếng Việt): tóm tắt, quyết định, việc cần làm bằng tiếng Việt; các khối học để trống. `debrief/v1` giữ nguyên.

## Câu hỏi mở

- (chưa có)
