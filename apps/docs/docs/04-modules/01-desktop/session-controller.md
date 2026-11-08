# Session controller

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/session/`

Máy trạng thái của một cuộc họp phía client: nhận segment từ STT native, kết nối backend và chuyển transcript sang overlay.

## Trách nhiệm

- Trạng thái kết nối `idle | connecting | running | reconnecting | error`
- Gọi `native.sessionStart/Stop`, đăng ký `native.onSegment` và mở WebSocket qua `createRealtimeClient`
- Phát ngay mọi segment sang overlay; gửi segment final của cả hai luồng lên API dưới dạng văn bản (không âm thanh) để transcript tiếng Anh có câu "Tôi"; server chỉ dịch luồng `system`
- Ghép bản dịch từ API với câu gốc theo `segmentId`, rồi phát lại sang overlay
- Đưa thuật ngữ cá nhân cho bộ nhận dạng: lấy glossary (chỉ cho `en`, tối đa 200 mục mới nhất) song song với tạo phiên, chờ tối đa 1,5 giây rồi bắt đầu với danh sách rỗng nếu chậm, và áp dụng ngay khi tải xong. Lỗi hoặc chưa đăng nhập thì bắt đầu bình thường không có thuật ngữ
- `refreshVocabulary()`: khi glossary đổi (trang Thuật ngữ báo qua `lib/glossary-changes`) hoặc sau khi đổi ngôn ngữ, tải lại và gửi danh sách mới, gom các lần đổi trong 500 ms, không dừng thu âm, lỗi thì bỏ qua
- Chế độ demo phát 6 segment giả cách nhau 1,5 giây qua cùng đường xử lý segment

## Phạm vi MVP

- F2, F3

## Interface

- `<SessionPanel />`: bắt đầu/dừng phiên, hiện trạng thái kết nối, hiện/ẩn overlay và nút demo trong môi trường dev
- `startSession(assistLevel)`, `stopSession()`, `toggleOverlay()`: action gọi duy nhất qua cầu nối native
- `describeNativeError(error)`: chuyển mã lỗi native thành thông báo tiếng Việt
- `createSessionController({ native, createRealtime, glossary, now })`: controller inject dependency để test không cần Tauri/WebSocket; `glossary.list(language)` là tuỳ chọn
- `useSession()`: snapshot `{status, error}` và action `start()`, `stop()`, `runDemo()`
- `<RecentSessions />`: mở debrief hoặc xoá mềm cuộc họp sau bước xác nhận
- Trang Cài đặt: tải JSON hoặc xoá toàn bộ dữ liệu sau khi gõ `XOA DU LIEU`
- Cấu hình: địa chỉ WebSocket lấy từ `serverConfig().wsUrl` (xem [Máy chủ](./server.md); mặc định lúc build `ws://localhost:4000`) và `VITE_REALTIME_TOKEN` (mặc định `dev-token`)

## Phụ thuộc

- Cầu nối `apps/desktop/src/lib/native.ts`
- `@cuelingo/core-sdk`, `@cuelingo/shared`

## Dữ liệu & sự kiện

- Native vào: `segment`
- Native ra: `transcript`, lệnh `session_set_vocabulary`
- WebSocket ra: `hello`, `segment.final`
- WebSocket vào: `ready`, `translation`, `error`

## Cuộc họp bằng ngôn ngữ nhận dạng đám mây

- **Đồng ý trước:** bắt đầu phiên bằng ngôn ngữ `recognition: 'cloud'` mà chưa có đồng ý thì lỗi `cloud_consent_required` trước khi tạo phiên và trước khi mở thu âm. Hộp thoại đồng ý nằm ở `SessionPanel`; đồng ý lưu theo người dùng; có chỉ báo "Đang gửi âm thanh tới Google" suốt cuộc họp.
- **Câu nói:** nghe sự kiện `audio-utterance` của cả hai luồng, tải lên `POST /v1/sessions/:id/transcribe` (hàng đợi 3, hạn 16 giây; thử lại một lần chỉ với lỗi mạng, hết hạn, 5xx và 429, không thử lại 400/404/413). Thành công thì hiện caption và gửi `segment.final` cho cả hai luồng; im lặng bị bỏ; lỗi hai lần thì hiện "[không nhận dạng được]" tại chỗ và không gửi lên server.
- **Dừng:** `stop()` gửi lệnh dừng cho native rồi **xả hàng đợi**: nhận thêm câu trong 3 giây (sidecar xả câu cuối), các câu đã vào hàng đợi vẫn được tải lên, hạn tổng 15 giây (quá hạn thì huỷ và bỏ, không bắt đầu tải lên mới). Chỉ sau đó mới kết thúc phiên, đóng socket và ẩn overlay; chỉ báo "đang gửi âm thanh" ở lại tới lúc đó. Cuộc họp bằng ngôn ngữ nhận dạng trên máy giữ nguyên hành vi cũ.
- **Ngôn ngữ cuộc họp:** snapshot có `meetingLanguage` (đặt lúc bắt đầu, xoá khi phiên kết thúc); chỉ báo và kiểm tra đồng ý khi đổi ngôn ngữ dùng nó, không dùng ô cài đặt.
- **Overlay:** câu không có bản dịch hiện chữ gốc, không có dòng "Đang dịch…"; nhãn "đang im lặng" chờ 25 giây (thay vì 6 giây) vì caption đám mây cách nhau xa hơn. Overlay hiện khi bắt đầu và ẩn khi phiên kết thúc hẳn (`native.hideOverlay`); panel không còn nút hiện/ẩn overlay và không còn nút "Chạy thử caption".

## Panel phiên họp: kiểm tra, sóng âm, thẻ sau họp

- **Kiểm tra trước khi bắt đầu:** sau hộp thoại đồng ý (nếu có), panel đọc quyền Micro. `denied` thì không bắt đầu, hiện cảnh báo kèm nút "Mở cài đặt Micro"; `undetermined` hoặc không đọc được thì bắt đầu bình thường.
- **Lỗi thu âm:** sự kiện `audio-status` có lỗi `microphone:` hoặc `system audio:` hiện banner (không tự dừng phiên) kèm nút mở đúng khung cài đặt quyền, và thanh sóng của luồng đó hiện đỏ "Không mở được". Im lặng thuần tuý chỉ hiện nhạt "Chưa có âm thanh", không bao giờ coi là lỗi.
- **Sóng âm:** hai thanh "Micro" và "Âm thanh hệ thống" (`LevelMeter` trong `@cuelingo/ui`) lấy từ `audio-level`, 20 khung hình/giây, chỉ nghe sự kiện trong lúc phiên chạy.
- **Thẻ "Cuộc họp vừa xong":** sau khi dừng hiện thời lượng, số câu đã ghi (không tính câu "[không nhận dạng được]") và trạng thái debrief: "Đang tạo debrief…" rồi tóm tắt (3 dòng), quyết định và việc cần làm (tối đa 3 mục mỗi loại), lấy từ `GET /v1/sessions/:id/debrief` (hỏi lại mỗi 3 giây tối đa 2 phút). "Xem đầy đủ" mở debrief trên web.
- **Ngữ cảnh nhận dạng:** mỗi câu tải lên kèm tối đa 3 câu đã nhận dạng trước đó của cùng luồng (`previous`).
- **Sổ người nói** (`speaker-registry.ts`, chỉ trong RAM theo cuộc họp, xoá khi dừng và khi bắt đầu họp mới; không ghi đĩa, không log): ngôn ngữ có cờ `labelsSpeakers` gửi kèm câu `system` danh sách `knownSpeakers` (tối đa 8 mục `{label, hint ≤ 60, lastText ≤ 200}`, rỗng ở câu đầu). Server trả nhãn đã biết thì cập nhật `lastText`; trả `new` thì cấp `speaker_N` tăng dần (một `new` đến trong 5 giây với hint gần trùng, tức chung từ từ một nửa trở lên, được gộp vào nhãn vừa cấp); `unknown`, không có `speaker` (API cũ) hoặc đã đủ 8 người thì câu không nhãn, hiện "Người khác". Nhãn đi kèm `segment.final.speaker` và `TranscriptEvent.speaker`. Câu `mic` luôn là "Tôi", không gửi `knownSpeakers`. Tên người dùng đặt ở debrief không hiện trong caption trực tiếp.

## Soạn follow-up sau họp

Khi debrief trong thẻ "Cuộc họp vừa xong" đã sẵn sàng, nút "Soạn follow-up" mở `FollowupComposer` ngay dưới phần tóm tắt, gọi `debriefApi.followup` ([API](../03-api/followup.md), hạn 15 giây, lỗi chỉ mang mã HTTP, không chứa bản nháp). Sao chép dùng clipboard của webview; nếu không có thì chọn sẵn văn bản và hiện "Không sao chép được, nội dung đã được chọn sẵn."

- **Bắt đầu thất bại giữa chừng:** nếu một bước sau `native.sessionStart` lỗi, controller dừng phiên native và kết thúc phiên trên server trước khi báo lỗi, để lần Bắt đầu sau không gặp `session_already_running`. Nếu vẫn gặp mã này (phiên native còn sót), controller tự dừng rồi thử lại đúng một lần.

## Câu hỏi mở

- (chưa có)

## Đổi ngôn ngữ giữa phiên (Việt ↔ Anh)

Khi chấp nhận gợi ý ngôn ngữ, controller gọi server, rồi socket, rồi sidecar. Sidecar giữ mô hình cũ cho tới khi mô hình mới báo `ready`, nên caption không đứt và transcript không bị xoá. Từ vựng tải lại ngay. Glossary cũng được hỏi lại mỗi 2 phút (`GLOSSARY_POLL_MS`) ngoài lúc đổi từ trang web.
