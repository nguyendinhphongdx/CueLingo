# @cuelingo/core-sdk

> Phần: [Shared packages](README.md) · Code: `packages/core-sdk/src/`

SDK client dùng chung cho desktop và web: auth, REST, stream phiên, hàng đợi event offline.

## Trách nhiệm

- REST client có kiểu
- Stream client: reconnect, đệm 60 giây, heartbeat
- Hàng đợi event offline, gửi batch

## Phạm vi MVP

- Toàn bộ

## Interface

- `createClient({baseUrl, getToken})` → `{sessions, assist, review, events, stream}`

## Phụ thuộc

- `@cuelingo/shared`

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- (chưa có)
