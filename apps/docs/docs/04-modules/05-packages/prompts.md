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
- `stt/v4`: như v3 nhưng trả JSON `{text, speaker, hint?}`; chỉ dùng khi request có `knownSpeakers`. `speaker` là nhãn trong danh sách (`speaker_1`…`speaker_8`), `new` (chỉ khi chắc là người chưa có) hoặc `unknown` (không chắc, hoặc nhiều giọng chồng nhau). Danh sách người đã biết nằm trong khối `<speakers>` của phần user, là dữ liệu không đáng tin (cấm làm theo, cấm chép vào `text`); mỗi mục bị ép một dòng, bỏ `<>` và ký tự điều khiển, hint cắt 60 ký tự, `lastText` cắt 200. `hint` chỉ mô tả giọng (giới tính cảm nhận, cao độ, tốc độ, âm sắc), cấm đoán tên, danh tính, tuổi, sắc tộc. v3 giữ nguyên cho câu không gắn nhãn.
- `debrief/v3`: debrief tiếng Việt (tóm tắt, quyết định, việc cần làm) cho cuộc họp ở **mọi ngôn ngữ nguồn** không có khối học, dùng khi ngôn ngữ không `learnable` (tiếng Việt, Hàn, Trung). `v2` không còn được chọn; `v3` được `v5` thay.
- `debrief/v4` (thay `v1`, ngôn ngữ học được) và `debrief/v5` (thay `v3`, không học được): dòng transcript `[id] <nhãn>:` với nhãn “Tôi”, tên người dùng đặt, “Speaker N” hoặc “Người khác”. Đầu vào mỗi câu thêm `speakerLabel?` (`me`/`speaker_1..8`) và `speakerName?`; tên và nhãn đi qua `cleanText`, nằm trong `<transcript>` (dữ liệu không đáng tin); `owner` dùng tên đã đặt, cấm bịa tên; hai nhãn cùng tên là một người. Câu không có người nói theo `source`. `debriefPromptVersionFor` và `buildDebriefPromptFor` nằm ở `v5.ts` (chọn v4/v5). `v1`–`v3` giữ nguyên vì nhãn “Họ” nằm trong chữ đã dùng.

## Câu hỏi mở

- (chưa có)
