# Review — vi-cloud-stt

**Trạng thái:** code xong, đã qua hai vòng review độc lập và đã commit; **chờ chạy thật** (xem cuối trang). Chưa push, chưa tạo PR.

## Thay đổi so với plan

| Dấu         | Phần                                                                       | Chi tiết (lý do nếu khác plan)                                                                                                                                                                                                         |
| ----------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡 MODIFIED | `packages/shared`, `packages/core-sdk`                                     | Registry có `recognition`, `translates`, `learnable`; `vi` bật cho họp, không học được; hợp đồng `transcribe`, ba mã lỗi, `client.transcribe`. Khác plan: tách `learnable` khỏi `enabled` để tiếng Việt không hiện ở màn hình học      |
| 🟢 ADDED    | `packages/ai-gateway`, `packages/prompts`                                  | Task `stt.transcribe` (Gemini, âm thanh inline), prompt `stt/v1`, `stt/v2` (ngữ cảnh 3 câu trước), `debrief/v2`. Khác plan: thêm `previous` và `v2` sau lần thử thật đầu tiên vì nghe chưa chuẩn                                       |
| 🟢 ADDED    | `services/api/src/modules/transcribe`, `realtime`, `workers/debrief`       | `POST /v1/sessions/:id/transcribe`; realtime bỏ qua dịch khi không cần; debrief tiếng Việt. Giới hạn 25,5 giây thay vì 25 giây (sidecar có thể dư một khung)                                                                           |
| 🟡 MODIFIED | `apps/desktop/native`, `src-tauri`                                         | Sidecar phát `utterance` ở chế độ đám mây và `level` cho mọi chế độ; nghỉ 700 ms cho câu đám mây; `audio-utterance`, `audio-level` chỉ gửi tới cửa sổ chính; overlay hiện khi bắt đầu, `hide_overlay`                                  |
| 🟡 MODIFIED | `apps/desktop/src` (session, overlay), `packages/ui`                       | Đồng ý trước, tải lên (3 song song, thử lại có chọn lọc), xả hàng đợi có hạn khi Dừng, chỉ báo, sóng âm, kiểm tra quyền và banner lỗi thu âm, thẻ "Cuộc họp vừa xong"; bỏ nút hiện/ẩn overlay và nút chạy thử. Thêm ngoài plan ban đầu |
| 🟡 MODIFIED | `apps/web/src/features/debrief`                                            | Trang debrief ẩn khối học, điểm hiểu, dòng dịch cho họp không dịch                                                                                                                                                                     |
| 🟡 MODIFIED | `apps/desktop/src-tauri/icons`                                             | Icon có lề chuẩn macOS (ngoài phạm vi ban đầu, theo góp ý của chủ sản phẩm)                                                                                                                                                            |
| 🟢 ADDED    | `apps/docs/docs/08-adr/0014-cloud-stt-for-vietnamese.md`, các trang module | ADR cho việc gửi âm thanh tới nhà cung cấp; trang `transcribe`, cập nhật `realtime`, `local-stt`, `tauri-core`, `session-controller`, gói                                                                                              |

**Docs đã cập nhật:** ADR 0014, `03-api/transcribe.md`, `realtime.md`, `local-stt.md`, `tauri-core.md`, `session-controller.md`, `ai-gateway.md`, `prompts.md`, `shared.md`, `core-sdk.md`, backlog (W0-04 đến W0-06), bản đồ tính năng.

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md):

- [x] Ranh giới & bảo mật: `userId` từ auth, 404 cho phiên của người khác, giới hạn kích thước và tần suất, byte lẻ bị từ chối; âm thanh và văn bản không vào log, lỗi hay `ai_call`
- [x] Hợp đồng: `@cuelingo/shared` là nguồn duy nhất; `core-sdk` có client
- [x] Kiến trúc: AI qua `ai-gateway`; prompt có phiên bản (`stt/v1`, `v2`, `debrief/v2`; v1 không sửa); Rust và Swift không chứa logic sản phẩm
- [x] AI: prompt coi lời nói và ngữ cảnh là dữ liệu không đáng tin; có bộ chặn lặp câu; **chưa có eval với Gemini thật** cho độ chính xác (xem cuối trang)
- [x] Test: xem dưới
- [x] Docs: các trang module và ADR
- [ ] Phạm vi: có mở rộng ngoài spec ban đầu theo yêu cầu của chủ sản phẩm; đã thêm AC9–AC13 vào spec

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test   # 118 file, 647 test xanh
pnpm exec depcruise apps services packages --config .dependency-cruiser.cjs --exclude '(^|/)\.env'   # không vi phạm
cd apps/desktop/src-tauri && cargo test && cargo clippy -- -D warnings   # 15 test xanh, clippy sạch
cd apps/desktop/native/macos-audio && swift test   # 37 test xanh (chạy ngoài sandbox của SwiftPM)
pnpm docs:build   # xanh
```

**Không chạy trọn được:** `pnpm check:deps` nguyên bản đỏ trong sandbox vì không đọc được `apps/desktop/.env` (EPERM), không liên quan tới thay đổi; đã chạy `depcruise` cùng cấu hình nhưng loại `.env`. `pnpm test:int` (cần Docker) chưa chạy trong sandbox.

**Đã chạy thật:**

- Gọi Gemini thật với một câu tiếng Việt tổng hợp (giọng "Linh" của macOS) bằng cả hai model: đều chép đúng, 2,3 giây và 1,6 giây.
- Một phiên tiếng Việt chạy qua app: log API ghi nhiều yêu cầu `transcribe` trả `200` trong khoảng 1,5 giây mỗi câu (chỉ xem độ dài, không đọc nội dung). Chủ sản phẩm báo nghe chưa chuẩn lắm (dẫn tới `stt/v2`, nghỉ 700 ms, sóng âm).

## Cho người review — đọc theo thứ tự

| #   | File                                                             | Soi gì                                                                                    |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| 1   | `08-adr/0014-cloud-stt-for-vietnamese.md`                        | Quyết định gửi âm thanh tới Google có chấp nhận được không                                |
| 2   | `services/api/src/modules/transcribe/transcribe.service.ts`      | Ranh giới người dùng, kiểm tra kích thước, không lộ nội dung                              |
| 3   | `apps/desktop/src/session/session-controller.ts` (đường đám mây) | Đồng ý trước khi gửi, hàng đợi, xả khi Dừng, huỷ khi dừng/đổi ngôn ngữ, thứ tự `previous` |
| 4   | `packages/prompts/src/stt/v2.ts` và `ai-gateway/src/gateway.ts`  | Chống tiêm lệnh, chống lặp câu, không đưa nội dung vào log                                |
| 5   | `apps/desktop/native/macos-audio/Sources/Sidecar/main.swift`     | Chế độ đám mây không tải model, cắt câu 25 giây, chỉ in JSON ra stdout                    |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                                                             | Tìm ở                | Sửa                                                                                        |
| --------------------------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------ |
| API từ chối câu dài hơn 25 giây một khung, mất cả câu                                                           | Review vòng 1        | Cho phép 25,5 giây                                                                         |
| Bấm Dừng làm mất các câu cuối và vẫn gửi tải lên sau Dừng                                                       | Cả hai review vòng 1 | Xả hàng đợi có hạn (nhận thêm 3 giây, tối đa 15 giây)                                      |
| Byte lẻ bị cắt ngầm trước khi gửi nhà cung cấp                                                                  | Codex                | Từ chối 400                                                                                |
| Chỉ báo "đang gửi âm thanh" tính theo cài đặt chứ không theo cuộc họp đang chạy                                 | Review vòng 1        | Lấy ngôn ngữ từ trạng thái của controller                                                  |
| Đổi ngôn ngữ giữa chừng có thể rò listener khi bấm Dừng đúng lúc                                                | Codex                | Kiểm lại phiên sau mỗi bước chờ                                                            |
| Thử lại cả với lỗi không thể khỏi (413, 400, 404)                                                               | Review vòng 1        | Chỉ thử lại lỗi mạng, hết hạn, 5xx, 429                                                    |
| Nhãn "đang im lặng" nhấp nháy vì caption đám mây cách nhau hơn 6 giây                                           | Chủ sản phẩm         | Ngưỡng 25 giây cho nhận dạng đám mây                                                       |
| Bấm "Bắt đầu" không bật overlay                                                                                 | Chủ sản phẩm         | `session_start` hiện overlay; overlay ẩn khi phiên kết thúc hẳn                            |
| Lỗi mở micro hoặc âm thanh hệ thống tới trước khi panel lắng nghe, banner không hiện                            | Review vòng 2        | Lắng nghe trong controller trước khi bắt đầu phiên                                         |
| Câu ngữ cảnh có thể chứa xuống dòng và chỉ dẫn; model có thể lặp câu ngữ cảnh trên đoạn im lặng                 | Review vòng 2        | Làm sạch, bọc trong `<context>`, bộ chặn lặp; test chống tiêm lệnh                         |
| Thời lượng sai sau khi kết nối lại; hỏi debrief liên tục khi không có câu; đồng ý được lưu trước khi kiểm micro | Review vòng 2        | Mốc `startedAt`/`endedAt`; không hỏi khi 0 câu, dừng ở 401/403; kiểm micro trước hộp thoại |
| Icon to hơn các icon khác trên Dock                                                                             | Chủ sản phẩm         | Lề 80,5% theo chuẩn macOS                                                                  |

## Còn lại, chưa làm

- **Chạy thật (cần người dùng):** AC3 (p95 ≤ 4 giây sau khi câu kết thúc, chưa đo); AC7 (đồng ý trước khi gửi, thử lần đầu trên máy sạch); AC9–AC13 (sóng âm, kiểm tra quyền, banner, thẻ tóm tắt, ngữ cảnh); độ chính xác tiếng Việt với giọng thật và âm thanh cuộc họp thật.
- **Nợ đã biết (backlog W0-05):** đổi tiếng Việt ↔ Anh giữa chừng có khoảng mất caption khi model đang nạp; bấm từ trên caption tiếng Việt vẫn gọi tra từ; `assist.dto`, `events.dto` còn nhận `vi`; hai client `transcribe` song song (desktop và `core-sdk`); bộ chặn lặp cắt ở 1,5 giây nên một câu thật rất ngắn trùng câu trước có thể bị bỏ; nhận dạng ngôn ngữ chỉ ở đầu cuộc họp.
- **Giới hạn thiết kế:** caption tiếng Việt trễ cỡ độ dài câu cộng 1,5 đến 2 giây, không có partial.
