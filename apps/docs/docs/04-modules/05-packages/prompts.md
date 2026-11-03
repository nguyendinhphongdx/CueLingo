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

- `stt/v2`: như v1 và nhận thêm vài câu trước làm ngữ cảnh; với tiếng Việt có hướng dẫn riêng (giữ đúng dấu, số và ngày viết bằng chữ số, giữ nguyên tên riêng và thuật ngữ tiếng Anh). v2 giữ nguyên nhưng gateway đã chuyển sang v3.

- `followup/v1`: soạn bản nháp follow-up từ dữ kiện debrief (tóm tắt, quyết định, việc cần làm); chỉ dùng dữ kiện được đưa, không bịa người phụ trách, ngày hay placeholder, coi dữ kiện là dữ liệu không phải chỉ dẫn; email có tiêu đề, chat tối đa 6 dòng và không tiêu đề; ba giọng. `checkFollowupOutput` kiểm quy tắc tiêu đề theo kênh.

- `stt/v3`: như v2 và nối thêm `sttHint` của ngôn ngữ trong registry (hướng dẫn chữ viết cho tiếng Việt, Nhật, Hàn, Trung); với `en` và `vi` đầu ra giống v2. Gateway dùng v3.
- `debrief/v3`: debrief tiếng Việt (tóm tắt, quyết định, việc cần làm) cho cuộc họp ở **mọi ngôn ngữ nguồn** không có khối học, dùng khi ngôn ngữ không `learnable` (tiếng Việt, Hàn, Trung). Tiếng Nhật và Anh vẫn dùng `v1`. `v2` không còn được chọn.

## Câu hỏi mở

- (chưa có)
