# Caption overlay

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src/overlay/`

Cửa sổ caption song ngữ nổi trên app họp.

## Trách nhiệm

- Hiển 3–6 câu gần nhất, partial màu nhạt, final màu đậm, bản dịch bên dưới
- Hiển thị theo Assist level: `4` đầy đủ, `3` bản dịch nổi bật, `1` chỉ bản dịch, `0` ẩn caption
- Gạch chân từ khó theo Lexicon của người dùng
- Nhãn người nói (khi bật "hiện người nói") dùng `SpeakerTag` của `@cuelingo/ui`: "Tôi" (luồng mic), "Speaker N" (có nhãn), "Người khác" (không nhãn)
- Chữ caption luôn đen (nền sáng) hoặc trắng (nền tối) thật, token `--caption-text`; độ đậm nền chỉ đổi màu nền, không làm mờ chữ. Dòng đang nói không bị làm nhạt, con trỏ nhấp nháy báo câu chưa xong; câu cũ chỉ lùi nhẹ (`opacity-70`)
- Nút micro trên thanh trên (`Mic`/`MicOff`, `aria-pressed`, nhãn "Tắt micro"/"Bật micro"): gọi `native.setMicMuted`, trạng thái lấy từ sự kiện `mic-state` qua `useMicMuted` (`session/use-mic-muted.ts`). Khi tắt hiện nhãn "Micro đã tắt" cạnh trạng thái; nút bị vô hiệu nếu sidecar báo lỗi `microphone:` (không có gì để tắt). Props `micMuted`/`micFailed` dùng cho test
- Thanh công cụ: cỡ chữ 14–28 px, nền 55–100%, giao diện sáng/tối lưu trong `localStorage`

## Phạm vi MVP

- US-04, US-05, US-10

## Interface

- `<CaptionOverlay level={level} />`: hiện dữ liệu mẫu trước transcript đầu tiên; level prop dùng cho test, khi chạy thật nhận level từ event `settings`
- `useTranscript()`: đăng ký và dọn listener qua `native.onTranscript`
- `useNotices()` và `<NoticeBar />`: nghe `native.onNotice`, hiện thông báo hạn mức phía trên caption, mỗi thông báo đóng được; caption vẫn chạy bên dưới. Cùng ngữ nghĩa với `NoticeStrip` (cam khi sắp hết, đỏ khi đã hết; lỗi là `role="alert"`) nhưng overlay là cửa sổ trong suốt nên mỗi thông báo nằm trên thẻ đặc (`bg-card`), chữ giữ màu `foreground`, chỉ viền và biểu tượng mang màu của mức; nhờ vậy đọc được trên mọi nền. `actionFor(notice)` (prop `noticeAction` của `CaptionOverlay`) cho mỗi thông báo tối đa một nút sửa lỗi. Sự kiện `notice` có trường tuỳ chọn `action` (`'upgrade' | 'open-settings'`, schema `NoticeEvent` ở `lib/native.ts`; thông báo cũ không có trường này vẫn hợp lệ). Cửa sổ chính quyết định hành động nào hợp (nó biết gói và lỗi bắt âm), overlay chỉ thực hiện qua `notice-actions.ts`: `upgrade` mở `/upgrade` trên web bằng `openWeb`; `open-settings` phát event `open-settings`, cửa sổ chính nghe (`useOpenSettingsRequests`), mở Cài đặt và đưa cửa sổ lên trước (cần quyền `core:window:allow-show` và `allow-set-focus` trong `capabilities/default.json`)
- `useOverlayAssistLevel()`: đăng ký và dọn listener qua `native.onSettings`
- `useTranscriptStore`: `push(event)` thay segment cùng `segmentId`, giữ tối đa 6 segment

## Phụ thuộc

- `@cuelingo/ui` (`CaptionLine`)
- Zustand
- Cầu nối `apps/desktop/src/lib/native.ts`

## Dữ liệu & sự kiện

- Nhận `transcript`: `{segmentId, text, translation, partial, speaker?, offline?}` từ Tauri core; `speaker` là `speaker_1`..`speaker_8` khi câu của người khác đã được gắn nhãn
- `offline: true` (câu nhận dạng trên máy vì đám mây không dùng được, ADR 0024): `CaptionBlock` hiện nhãn "Ngoại tuyến" trên câu đã chốt
- Nhận `notice`: `{id, tone: 'warning' | 'error', text}` từ cửa sổ chính (cùng cơ chế `emit`/`listen` của `transcript`, cửa sổ chính là bên phát nên không cần lệnh Rust mới). Overlay chỉ giữ thông báo trong RAM; thông báo phát trước khi overlay nghe sẽ không được phát lại
- Nhận `settings`: `{assistLevel}` từ cửa sổ chính
- Lắng nghe `storage` để áp dụng các khoá overlay do cửa sổ chính tải từ tài khoản
- Thay đổi Assist hoặc hiển thị được đưa vào hàng đợi PATCH cài đặt 800 ms

## Câu hỏi mở

- Từ khó xác định ở client (cache Lexicon) hay server trả kèm bản dịch?
