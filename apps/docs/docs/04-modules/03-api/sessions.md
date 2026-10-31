# Sessions

> Phần: [API service](./README.md) · Code: `services/api/src/modules/sessions/`

Vòng đời cuộc họp: tạo, kết thúc, liệt kê, transcript.

## Trách nhiệm

- Tạo phiên (title, assist_level, glossary, nguồn STT)
- Kết thúc phiên → enqueue job debrief
- Trả transcript song ngữ theo segment

## Phạm vi MVP

- F2, F4

## Interface

- `POST /v1/sessions`, `POST /v1/sessions/:id/end`, `GET /v1/sessions[/:id]`

## Phụ thuộc

- `workers/debrief`

## Dữ liệu & sự kiện

- Bảng `sessions`, `speakers`, `segments`

## Câu hỏi mở

- (chưa có)
