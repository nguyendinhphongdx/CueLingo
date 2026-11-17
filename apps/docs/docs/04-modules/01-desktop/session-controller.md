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

- `<HomePage />` (`src/app/`): trang Phiên họp, ghép theo thứ tự: banner cập nhật, thẻ việc còn lại của onboarding, thanh hạn mức, gợi ý mức hỗ trợ, thẻ lịch, `<SessionPanel />`, cuộc họp gần đây, phím tắt. `AssistSettings` và `VoiceSettings` nằm ở Cài đặt, không ở trang này
- `<SessionPanel controls />`: hai trạng thái. **Sẵn sàng:** chọn ngôn ngữ, danh sách sẵn sàng (`<ReadinessList />`, mỗi dòng một `StatusRow` với nút sửa riêng cho micro, âm thanh hệ thống, model) và nút Bắt đầu họp. **Đang họp:** hai thẻ riêng cho âm thanh hệ thống và micro (mỗi thẻ có thanh mức, trạng thái "Đang nghe", "Chưa có âm thanh" hoặc "Không mở được" kèm nút sửa của đúng luồng đó), nút Dừng và nút "Hiện overlay" (đưa overlay trở lại sau khi bấm ✕; trước đó chỉ còn phím tắt và menu khay, mà trên Windows biểu tượng khay nằm trong vùng ẩn nên người dùng phải dừng rồi bắt đầu lại)
- `describeReadiness({permissions, systemCheck, model, modelView, language, os})` (`session/readiness.ts`): trả ba mục `{id, status, title, detail, fix}`; `fix` là mở trang cài đặt, phát tiếng chuông thử, tải model (`download-model`), hoặc thử lại. **Dòng model khi app quản lý được model** (`modelView` từ `useLocalModels`): ngôn ngữ "Trên máy" mà model **chưa tải** thì cảnh báo vàng "Chưa tải (631 MB). Caption sẽ chờ mô hình tải xong khi bạn bắt đầu họp" kèm nút "Tải ngay"; đang tải thì "Đang tải N%"; lỗi thì thông báo tiếng Việt cố định kèm "Thử lại"; đã tải thì "Đã có trên máy". Ngôn ngữ chạy đám mây không bao giờ cảnh báo model. **Bắt đầu họp khi model chưa sẵn sàng** (`gateAction`, `use-meeting-controls.ts`): không tải ngầm. Hộp thoại "Cần tải mô hình nhận dạng" (`ModelGateDialog`, dựng trên `ConfirmDialog` của `@cuelingo/ui`) hiện dung lượng và tiến trình, tự bắt đầu tải **một lần**, và khi model sẵn sàng thì tự bắt đầu cuộc họp. ✕ hủy tải (hộp thoại ở lại để bấm tải lại), ↻ tải lại từ đầu, lỗi thì tự dừng để người dùng quyết ("Thử lại"); "Huỷ" đóng hộp thoại và bỏ việc bắt đầu họp, lần tải đang chạy vẫn tiếp tục ở nền. Bấm Bắt đầu họp lúc một lần tải đang chạy (từ Cài đặt) cũng vào hộp thoại này nên không còn `model_downloading` đến tận bước bắt đầu; lõi vẫn từ chối vì an toàn và màn hiện "Mô hình nhận dạng đang tải. Hãy chờ tải xong rồi bắt đầu họp." Khi app chưa quản lý được model (`modelView` null) dòng này giữ cách cũ. Bắt đầu họp luôn bật được (trừ lúc đang kiểm tra hoặc kết nối); khi micro bị chặn nút ghi "Bắt đầu họp, không dùng micro" và cuộc họp chạy với âm thanh hệ thống
- `useMeetingControls()` (`session/use-meeting-controls.ts`): `attempt(language?)`, `halt()`, `pending`, hộp thoại đồng ý đám mây; dùng chung cho nút Bắt đầu và thẻ lịch
- `describeStream(stream, failures, os?)`: lời giải thích và trang cài đặt cho một luồng thu âm lỗi; một luồng lỗi không dừng luồng kia
- `<UsageNotice />` (`src/usage/`): thanh vàng từ 80% hạn mức giờ dịch hoặc debrief ("Còn khoảng … dịch tháng này"); ở 100% nói cái gì vẫn chạy (caption gốc, hoặc caption không có debrief) và có nút Nâng cấp khi thanh toán đang bật. `pickUsageNotice(usage)` là hàm thuần
- `<CalendarHintCard onStart />` (`src/calendar/`): khi một cuộc họp trong lịch bắt đầu trong 15 phút tới (hoặc đang diễn ra) hiện tên, giờ, "Còn N phút", nút "Bắt đầu cho cuộc họp này" và "Bỏ qua". Nếu tiêu đề trỏ tới ngôn ngữ khác thì bắt đầu sẽ chuyển sang ngôn ngữ đó, và ngôn ngữ chỉ đổi khi cuộc họp thật sự bắt đầu (`useMeetingControls`; hủy hộp thoại đồng ý hoặc đang họp thì không đổi). Thẻ ẩn khi đang họp (`isMeetingLive`) `pickUpcoming()` là hàm thuần; chỉ có khi người dùng đã bật gợi ý từ lịch (macOS)
- `startSession(assistLevel)`, `stopSession()`, `toggleOverlay()`: action gọi duy nhất qua cầu nối native
- `describeNativeError(error)`: chuyển mã lỗi native thành thông báo tiếng Việt
- `createSessionController({ native, createRealtime, glossary, now })`: controller inject dependency để test không cần Tauri/WebSocket; `glossary.list(language)` là tuỳ chọn
- `useSession()`: snapshot `{status, error, latestCaption, …}` và action `start()`, `stop()`, `runDemo()`
- `latestCaption` (`{segmentId, speaker, text, translation}`): câu đã xong gần nhất của cuộc họp đang chạy, chỉ trong bộ nhớ; đặt lại khi bắt đầu và khi dừng, không ghi log. Bản dịch cập nhật khi tới. `<LatestCaptionCard />` trong `SessionPanel` hiện thẻ "Câu mới nhất" (người nói, câu gốc, bản dịch; ghi chú "bản đầy đủ nằm trong cửa sổ caption") khi cuộc họp đang chạy
- `<RecentSessions />`: mở debrief hoặc xoá mềm cuộc họp sau bước xác nhận; phần hàng là `<SessionRows hits query? />` dùng lại ở trang Cuộc họp
- `<MeetingsPage />` (trang Cuộc họp): ô tìm trong tiêu đề và lời thoại (từ 2 ký tự, đoạn khớp được tô bằng `HighlightedText`), lọc theo người nói và theo tháng (AC10). Logic thuần dùng chung với web ở `@cuelingo/ui/lib/meeting-search`. API chưa có endpoint tìm, nên tìm chạy trên máy: đọc `GET /v1/sessions/:id` (`sessionsApi.get`) của **30 cuộc họp gần nhất** sau khi người dùng ngừng gõ 300 ms (`useDebounced`); cuộc họp cũ hơn chỉ khớp theo tiêu đề và trang nói rõ. Không đọc lời thoại khi chưa tìm hay lọc người nói
- Trang Cài đặt, mục Quyền riêng tư: tải JSON, hoặc xoá toàn bộ dữ liệu qua hai bước: dùng `DeleteDataSteps` chung của `@cuelingo/ui` (cùng bản với web): bước 1 liệt kê cái sẽ mất (khớp `deleteMyData` ở API), bước 2 yêu cầu gõ `XOA DU LIEU`, nút xoá chỉ bật khi khớp đúng và focus đầu vào nút Huỷ
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
- **Overlay:** câu không có bản dịch hiện chữ gốc, không có dòng "Đang dịch…"; nhãn "đang im lặng" chờ 25 giây (thay vì 6 giây) vì caption đám mây cách nhau xa hơn. Overlay hiện khi bắt đầu và ẩn khi phiên kết thúc hẳn (`native.hideOverlay`); panel không còn nút hiện/ẩn overlay (dòng nhắc phím tắt thay cho nút) và không còn nút "Chạy thử caption".

## Hạn mức của gói (W2-02)

Controller mở WebSocket với `features: ['usage']`, nên server báo khi giờ dịch sắp hết hoặc đã hết. Thông báo đi sang overlay bằng `native.publishNotice` (xem [overlay](./overlay.md)); hết hạn mức kèm `action: 'upgrade'` khi `canUpgrade()` (tuỳ chọn của controller, đọc `GET /v1/billing`, lỗi coi như không) trả true, micro bị chặn (`capture:mic`) kèm `action: 'open-settings'`; mọi thông báo chỉ là chữ cố định, không chứa nội dung cuộc họp. Logic chữ nằm ở `session/usage-notices.ts` (thuần, có test), dùng định dạng của `@cuelingo/ui/lib/usage`.

| Tình huống                                            | Hành vi                                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Message `usage` `low` (còn ≤ 10 phút dịch)            | Cảnh báo "Còn khoảng N phút dịch tháng này" một lần mỗi cuộc họp (lọc theo id, kết nối lại không hiện lại; xoá khi bắt đầu cuộc họp mới)                                                                                                                   |
| Message `usage` `exhausted`                           | "Đã hết giờ dịch tháng này, caption tiếng Anh vẫn chạy"; phiên không dừng, caption gốc vẫn lưu và hiện                                                                                                                                                     |
| `transcribe` trả `QUOTA_EXCEEDED` (429)               | Không thử lại, xoá hàng đợi, **dừng gửi âm thanh lên đám mây tới hết cuộc họp**, báo "Đã hết giờ nhận dạng giọng nói đám mây tháng này…"; câu đó không hiện "[không nhận dạng được]"; phiên không lỗi                                                      |
| Đầu phiên (`usage.get()`, giả định G8)                | Cảnh báo các hạn mức `low`/`exhausted` khác: `translation_ms`, `cloud_stt_ms` (chỉ khi họp bằng ngôn ngữ đám mây; nếu đã hết thì không tải âm thanh lên), `debriefs`, `assist_daily`. Bỏ qua `agent_messages` (Free luôn là 0). Lỗi đọc thì bỏ qua im lặng |
| Debrief bị bỏ (`GET …/debrief` trả `DEBRIEF_SKIPPED`) | Thẻ "Cuộc họp vừa xong" ngừng hỏi lại và hiện "Đã hết lượt debrief tháng này nên cuộc họp này không có debrief."                                                                                                                                           |

`TranscribeError` mang thêm `code` (mã API cố định, không phải nội dung); `QUOTA_EXCEEDED` được kiểm trước luật thử lại vì cùng là 429. `DebriefError` có `code = 'DEBRIEF_SKIPPED'` để `pollDebrief` gọi `onSkipped` thay vì hỏi tới hết 2 phút.

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
