---
title: 2026-11-01 · M1 Caption sống
---

# m1-live-caption — M1 · Caption sống

| Trạng thái                                                             | Loại                 | Nhánh                  | Ước lượng → thực tế |
| ---------------------------------------------------------------------- | -------------------- | ---------------------- | ------------------- |
| Đang làm: M1-04, M1-07 xong; M1-01 chờ quyền macOS; M1-05 đã chạy thật | feature (đường găng) | `feat/m1-live-caption` | 3 tuần → ?          |

**Phạm vi:** trong: thu âm hệ thống + mic, STT on-device, dịch bằng LLM (Gemini), WebSocket, overlay hoàn thiện · ngoài: đăng nhập trong app, lưu phiên, Quick Assist, debrief.

## Vấn đề

Người dùng chưa thể dùng sản phẩm: app desktop mới có khung và overlay dữ liệu mẫu. M1 làm cho **caption tiếng Anh + bản dịch tiếng Việt chạy thật** trong cuộc họp.

## Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                             | Test                     |
| --- | -------------------------------------------------------------------------------------------------------------- | ------------------------ |
| AC1 | WHEN bấm ⌘⇧L và có người nói trong cuộc họp THE SYSTEM SHALL hiện câu gốc đầu tiên trong ≤ 3 s                 | chạy thật Zoom/Meet      |
| AC2 | THE SYSTEM SHALL hiện câu gốc p95 ≤ 1 s và bản dịch p95 ≤ 2,5 s sau khi hết câu                                | đo end-to-end (M1-10)    |
| AC3 | WHILE phiên chạy 30 phút THE SYSTEM SHALL không crash và không rò RAM đáng kể                                  | chạy thật                |
| AC4 | IF LLM chậm quá 3 s THEN THE SYSTEM SHALL chuyển model dự phòng; IF vẫn lỗi THEN câu gốc vẫn hiện, bỏ bản dịch | `gateway.test.ts` + thật |
| AC5 | IF mất mạng THEN THE SYSTEM SHALL đệm ≤ 60 s và gửi lại khi nối lại                                            | `realtime.test.ts`       |
| AC6 | WHEN người dùng đổi Assist level THE SYSTEM SHALL áp dụng ngay cho overlay                                     | test + chạy thật         |

## Câu hỏi mở

- [x] Nhà cung cấp LLM: **Gemini** (key trong `.env`) — ghi vào ADR-0004 khi đo xong.
- [ ] Quyền macOS (Micro, System Audio Recording) cho app Claude/terminal chạy spike — chờ người dùng.
- [ ] Sidecar Swift hay FFI (quyết ở M1-02).

## Decision log

| Ngày       | Pha  | Quyết định / lý do                                                                                                   |
| ---------- | ---- | -------------------------------------------------------------------------------------------------------------------- |
| 2026-11-01 | Spec | Mở M1. Người dùng đã duyệt hướng chung ("làm hết, đừng hỏi nhiều"); lead tự quyết chi tiết, hỏi khi có việc ra ngoài |
