---
title: Brief M1-08 + M1-09 · Session controller và overlay
---

# Brief — M1-08/09 · Session controller (desktop) và overlay hoàn thiện

> Giao cho: Codex · Nhánh `feat/m1-ui-codex` · Worktree `.worktrees/m1-ui-codex` · Quy tắc: `apps/docs/docs/05-engineering/agent-collaboration.md`

## Mục tiêu

Nối nguồn **segment** (từ native STT) → WebSocket tới API → **overlay**, và hoàn thiện overlay. Cầu native đã có sẵn trong `apps/desktop/src/lib/native.ts` (**chỉ đọc**): `native.onSegment` (SegmentEvent: `segmentId`(uuid), `stream`, `startMs`, `endMs`, `text`, `words`, `partial`), `native.publishTranscript` / `native.onTranscript` (TranscriptEvent) và `native.publishSettings` / `native.onSettings` (event toàn cục giữa hai cửa sổ). Client WebSocket: `createRealtimeClient` trong `@cuelingo/core-sdk` (xem `packages/core-sdk/src/realtime.ts`), hợp đồng `@cuelingo/shared` (`ws`). Luồng: `apps/docs/docs/03-architecture/04-realtime-pipeline.md`, thiết kế `04-modules/01-desktop/{session-controller,overlay}.md`.

## AC

| #   | AC (EARS)                                                                                                                                                                                                            | Test                                                |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| AC1 | WHEN nhận `SegmentEvent` THE SYSTEM SHALL ngay lập tức publish `TranscriptEvent` (text gốc, `translation:null`, `partial` giữ nguyên) cho overlay                                                                    | `session-controller.test.ts`                        |
| AC2 | WHEN segment là `final` và `stream==='system'` THE SYSTEM SHALL gửi `segment.final` qua realtime client; WHEN nhận `translation` THE SYSTEM SHALL publish lại `TranscriptEvent` cùng `segmentId` có `translation`    | `session-controller.test.ts`                        |
| AC3 | WHEN segment `stream==='mic'` THE SYSTEM SHALL không gửi lên API                                                                                                                                                     | `session-controller.test.ts`                        |
| AC4 | THE SYSTEM SHALL hiển thị trạng thái phiên (`idle/connecting/running/reconnecting/error`) trong `SessionPanel`, kèm thông báo tiếng Việt khi mất kết nối ("Đang kết nối lại…")                                       | `SessionPanel.test.ts`                              |
| AC5 | WHEN người dùng đổi Assist level ở cửa sổ chính THE SYSTEM SHALL gọi `native.publishSettings`; overlay SHALL nhận `onSettings` và đổi mức hiển thị ngay (4 đầy đủ, 3 gợi ý = bản dịch nổi bật, 1 chỉ bản dịch, 0 ẩn) | `AssistSettings.test.ts`, `CaptionOverlay.test.tsx` |
| AC6 | Overlay có thanh công cụ: cỡ chữ 14–24 px (nút A−/A+, lưu bằng `localStorage` có try/catch), sáng/tối, dải kéo; câu partial nhạt, final đậm                                                                          | `CaptionOverlay.test.tsx`                           |
| AC7 | Có chế độ **demo** (nút "Chạy thử caption" trong `SessionPanel`, chỉ khi `import.meta.env.DEV`) phát 6 `SegmentEvent` giả cách nhau 1,5 s đi qua đúng đường controller, để kiểm UI không cần native/API              | `session-controller.test.ts`                        |

## Thiết kế

- `src/session/session-controller.ts`: hàm thuần/class `createSessionController({ native, createRealtime, now })` (inject để test không cần Tauri/WS). `SessionPanel` dùng qua hook `useSession()`. Cấu hình: `VITE_API_URL` (mặc định `ws://localhost:4000`), `VITE_REALTIME_TOKEN` (token dev), `sessionId` = uuid sinh khi bắt đầu phiên. Dùng `native.sessionStart/Stop` hiện có.
- Segment partial KHÔNG gửi API. Giữ tối đa 3 câu final trước làm bối cảnh KHÔNG cần làm ở client (server tự giữ).
- Không `invoke`/`listen`/`emit` trực tiếp; chỉ qua `native.ts`. Không sửa `native.ts`; cần event/command mới → dừng và ghi câu hỏi.

## Môi trường

Codex không có mạng; dependency đã cài. Không `pnpm add`. Không chạy Tauri/cargo. Kiểm: `pnpm verify`, `pnpm --filter @cuelingo/desktop build`. Test bằng `renderToStaticMarkup` và đối tượng giả (không jsdom).

## Đọc trước

`AGENTS.md` gốc, `apps/desktop/AGENTS.md`, `apps/desktop/src/{overlay,session,settings,onboarding}`, `packages/core-sdk/src/realtime.ts`, `packages/ui/src/components/caption-line.tsx`.

## Phạm vi file

Được sửa/tạo: `apps/desktop/src/**` (trừ `lib/native.ts`), `apps/desktop/.env.example` (mới), trang docs `04-modules/01-desktop/{session-controller,overlay,settings}.md`, mục Kết quả. Không sửa: `src-tauri`, `native`, `packages/**`, `services/**`, config gốc, `pnpm-lock.yaml`, `package.json`. Không commit/push.

## Kết quả _(implementer điền)_

- File đã đổi:
  - Session: `apps/desktop/src/session/{session-controller.ts,use-session.ts,SessionPanel.tsx,index.ts}`
  - Overlay/settings: `apps/desktop/src/overlay/{CaptionOverlay.tsx,use-overlay-settings.ts}`, `apps/desktop/src/settings/{AssistSettings.tsx,settings-store.ts,use-assist-settings.ts}`
  - Cấu hình: `apps/desktop/.env.example`
  - Docs: `apps/docs/docs/04-modules/01-desktop/{session-controller,overlay,settings}.md`
  - Test: `apps/desktop/src/session/{session-controller.test.ts,SessionPanel.test.ts}`, `apps/desktop/src/settings/AssistSettings.test.ts`, `apps/desktop/src/overlay/CaptionOverlay.test.tsx`
- Test đã thêm: segment → transcript; chỉ final/system → API; translation ghép theo `segmentId`; trạng thái realtime; demo 6 event/1,5 giây; publish settings; overlay level 0/1/3/4, toolbar và listener settings. Test hẹp: 4 file, 16 test xanh; toàn repo: 26 file, 99 test xanh.
- `pnpm verify` / `desktop build`: cả hai xanh. `pnpm docs:build` xanh. Node hiện tại 22.14.0 thấp hơn mức repo yêu cầu 22.19 nên pnpm có cảnh báo engine. Thử mở Vite local bị sandbox chặn bind `127.0.0.1:1420` (`EPERM`); UI được kiểm bằng `renderToStaticMarkup` theo brief và production build.
- Khác brief: Không.
- Câu hỏi còn mở: Không.
