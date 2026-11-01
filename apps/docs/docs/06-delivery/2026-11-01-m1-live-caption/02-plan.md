---
title: Plan
---

# Plan — M1 Caption sống

Backlog đầy đủ: [06-backlog.md](../../02-product/06-backlog.md). Trang này là kế hoạch thi công M1.

## Làn việc

```mermaid
flowchart LR
  subgraph N["Làn native (Claude)"]
    A1["M1-01 Spike thu âm"] --> A2["M1-02 Cầu Swift↔Rust"] --> A3["M1-03 STT on-device"]
  end
  subgraph S["Làn server (Claude)"]
    B1["M1-05 ai-gateway dịch"] --> B2["M1-06 api/realtime WS"]
  end
  subgraph C["Làn hợp đồng + UI (Codex)"]
    C1["M1-04 + M1-07 WS contract + client ✅"] --> C2["M1-08 session-controller"] --> C3["M1-09 Overlay hoàn thiện"]
  end
  C1 --> B2
  A2 --> C2
  A3 --> E["M1-10 Đo end-to-end + Zoom/Meet"]
  B2 --> E
  C3 --> E
```

## Tiến độ

| Task  | Chủ | Trạng thái | Ghi chú                                                                                                                                                                                                                                                                                     |
| ----- | --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1-01 | C   | ✅         | Process Tap + mic chạy thật trên macOS 26: tín hiệu hệ thống rms 0,08–0,11, frame đầu sau ~110 ms (mic ~280 ms). Điều kiện: chạy trong **app bundle có `Info.plist`** (`NSAudioCaptureUsageDescription`, `NSMicrophoneUsageDescription`); CLI trần chạy dưới tiến trình khác nhận toàn số 0 |
| M1-04 | X   | ✅         | Hợp đồng `ws` trong `@cuelingo/shared`                                                                                                                                                                                                                                                      |
| M1-07 | X   | ✅         | Client realtime trong `@cuelingo/core-sdk` (đệm 60 s, backoff)                                                                                                                                                                                                                              |
| M1-05 | C   | ✅         | Prompt v1 + gateway + fallback; Gemini thật: `gemini-3.1-flash-lite` pass 12/12, p50 0,74 s, p95 0,97 s; dự phòng `gemini-3.5-flash-lite` (2.5 flash-lite Google đã ngừng cho tài khoản mới; 3.5 không nhận `thinkingBudget`, dùng `thinkingLevel: minimal`)                                |
| M1-02 | C   | chờ M1-01  |                                                                                                                                                                                                                                                                                             |
| M1-03 | C   | chờ M1-02  |                                                                                                                                                                                                                                                                                             |
| M1-06 | C   | tiếp theo  | Có thể làm ngay vì không phụ thuộc native                                                                                                                                                                                                                                                   |
| M1-08 | X   | chờ M1-02  | Brief viết khi M1-02 xong                                                                                                                                                                                                                                                                   |
| M1-09 | X   | chờ M1-08  | Cần Claude thêm event `settings` trong Rust trước                                                                                                                                                                                                                                           |
| M1-10 | C   | cuối       | Cổng M1                                                                                                                                                                                                                                                                                     |

## Rủi ro

Xem [backlog](../../02-product/06-backlog.md#điều-chưa-chắc-và-cách-giảm-rủi-ro). Rủi ro hiện tại cao nhất: quyền macOS và STT streaming chưa đo.
