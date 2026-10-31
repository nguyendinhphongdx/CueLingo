# Learner recompute

> Phần: [Workers](README.md) · Code: `services/workers/src/jobs/learner-recompute/`

Tính lại Learner Model từ event log khi đổi thuật toán hoặc theo lịch.

## Trách nhiệm

- Replay event theo user
- Cập nhật `user_lexicon`, chỉ số tuần

## Phạm vi MVP

- F6

## Interface

- Job `learner.recompute {userId?}`

## Phụ thuộc

- `@cuelingo/learner-model`

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- (chưa có)
