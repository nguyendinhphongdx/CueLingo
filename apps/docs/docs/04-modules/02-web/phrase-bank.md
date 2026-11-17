# Phrase Bank

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/phrase-bank/`

Danh sách cụm từ đã lưu, trạng thái receptive/productive, nguồn.

## Trách nhiệm

- Lọc theo trạng thái, cuộc họp, người nói
- Sửa nghĩa, đánh dấu "đã biết"

## Phạm vi MVP

- S10

## Interface

- `GET/PATCH /v1/phrases`

## Phụ thuộc

- (chưa có)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- (chưa có)

## Là một tab của Ôn tập

Từ nay màn này hiện là tab **Kho cụm từ** của [Ôn tập](./review.md#ba-tab-hôm-nay-kho-cụm-từ-tiến-độ), không còn trang `/phrases` riêng (địa chỉ cũ chuyển hướng). Feature xuất `PhraseBankPanel({ language })`; tiêu đề và ngôn ngữ do trang Ôn tập giữ.
