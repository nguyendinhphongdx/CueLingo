# @cuelingo/learner-model

> Phần: [Shared packages](./README.md) · Code: `packages/learner-model/src/`

Logic thuần (không I/O) của Learner Model: FSRS hai tầng, giai đoạn từ vựng, chỉ số hiểu, luật Assist Dial.

## Trách nhiệm

- FSRS riêng cho receptive và productive (ts-fsrs)
- Chuyển giai đoạn recognize → understand → use-with-hint → use
- Ánh xạ event → cập nhật (ví dụ `lookup` giảm receptive)
- Tính `comprehension_pct`
- Luật đề xuất hạ Assist level
- Luật lộ trình: thứ tự bài, trạng thái bài, tiến độ khoá, việc nên làm tiếp

## Phạm vi MVP

- F5, F6

## Interface

- `applyEvent(state, event) -> state`
- `schedule(card, rating, now)`
- `comprehension(segments, signals)`
- `suggestAssistLevel(history)`
- `course.ts` (lộ trình học, xem [courses](../03-api/courses.md)): hằng số `COURSE_MIN_LESSONS` 3, `COURSE_MAX_LESSONS` 10, `SITTING_SIZE` 5, `DONE_RATING` 3; `buildLessons(source, lexicon)` (thứ tự bài: đoạn khó → thứ tự debrief → câu nên nói, bỏ bài không dựng được thẻ, rỗng nếu dưới 3 bài); `lessonStatus(logs, since)` (`todo`/`learning`/`done`); `courseProgress(lessons)`; `pickNextUp(courses)`; `orderPrepLessons(items, now)` (đến hạn sớm nhất, rồi `lapses` cao)

## Phụ thuộc

- [ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs) (MIT)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- Thêm BKT cho kỹ năng nghe/phát âm ở Đợt 3
