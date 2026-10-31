# @cuelingo/learner-model

> Phần: [Shared packages](README.md) · Code: `packages/learner-model/src/`

Logic thuần (không I/O) của Learner Model: FSRS hai tầng, giai đoạn từ vựng, chỉ số hiểu, luật Assist Dial.

## Trách nhiệm

- FSRS riêng cho receptive và productive (ts-fsrs)
- Chuyển giai đoạn recognize → understand → use-with-hint → use
- Ánh xạ event → cập nhật (ví dụ `lookup` giảm receptive)
- Tính `comprehension_pct`
- Luật đề xuất hạ Assist level

## Phạm vi MVP

- F5, F6

## Interface

- `applyEvent(state, event) -> state`
- `schedule(card, rating, now)`
- `comprehension(segments, signals)`
- `suggestAssistLevel(history)`

## Phụ thuộc

- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- Thêm BKT cho kỹ năng nghe/phát âm ở giai đoạn 2
