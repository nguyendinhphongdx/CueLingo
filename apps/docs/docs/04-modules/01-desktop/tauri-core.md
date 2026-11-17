# Tauri core

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src-tauri/src/`

Lớp Rust của app: cửa sổ, phím tắt toàn cục, cầu nối native ↔ webview, bảo mật token, cập nhật.

## Trách nhiệm

- Quản lý cửa sổ: overlay luôn nổi, không hiện khi chia sẻ màn hình (NSWindow sharingType = none), menu bar
- Phím tắt toàn cục: ⌘⇧L (bắt đầu/dừng), ⌘⇧W (recap), ⌘⇧S (nói giúp tôi); trên Windows là Ctrl+Shift+L/W/S, nhãn trong UI lấy từ `shortcutLabel` ở `src/lib/platform.ts`
- Nhận sự kiện từ `audio-capture`/`local-stt` và đẩy sang webview qua Tauri events
- Lưu token trong Keychain
- Auto-update, ký và notarize

## Phạm vi MVP

- Toàn bộ

## Interface

- Tauri commands: `session_start`, `session_stop`, `session_set_language`, `session_set_vocabulary`, `permissions_status`, `set_assist_level`
- Quản lý model không cần họp: `model_status` (trả `{type:"models", models:[{language, state: ready|missing, sizeBytes}]}` hoặc `null`) và `model_download(language)` (tải ở nền, tiến trình và kết quả đến qua sự kiện `audio-model`), `model_cancel` (dừng lần tải đang chạy: các màn hình nghe `error` với thông điệp `cancelled` và quay về "chưa tải"). Mỗi lúc chỉ một lần tải; `session_start` trả `model_downloading` khi đang tải, `model_download` trả `session_already_running` khi đang họp. Cờ biên dịch `MODEL_CONTROL` (`commands.rs`) chỉ bật cho Windows: sidecar không biết cờ lạ sẽ chạy như một cuộc họp và tự tải model, nên macOS trả `null` và `model_control_unavailable` cho tới khi có bản Swift ([brief](../../06-delivery/2026-11-17-onboarding-model-download/04-brief-macos-model.md)). Một lần tải kết thúc mà không có `ready` hay `error` (sidecar chết, kể cả sidecar của một cuộc họp bị dừng giữa lúc đang tải model) thì lõi tự phát một `error` (`download interrupted`); mỗi lần tải có cờ hủy riêng nên kết thúc của lần cũ không đụng tới lần mới; thoát app dừng tải.
- Tauri commands khác: `hide_overlay`, `toggle_overlay`, `tray_report` (`active`, `minutes`, `problem` = `mic`/`system`/`both`)
- `session_start` nhận `vocabulary` (danh sách thuật ngữ, xem dưới); `session_set_vocabulary(terms)` thay danh sách khi đang họp
- Tauri events: `notice` (JS `emit`/`listen`, cửa sổ chính → overlay, thông báo hạn mức và lỗi micro, có thể kèm `action`; không qua Rust), `open-settings` (overlay → cửa sổ chính, JS `emit`/`listen`), `transcript`, `speech`, `hotkey`, `tray-stop` (mục "Dừng họp" ở menu bar; chỉ gửi tới `main`)

## Phụ thuộc

- Tauri 2, plugins global-shortcut, updater

## Thuật ngữ cho nhận dạng

Rust chỉ kiểm và chuyển tiếp, không có logic sản phẩm. `clean_vocabulary` **từ chối** danh sách nhận về có hơn **200 mục** (mã lỗi cố định `vocabulary_too_large`, không chứa nội dung thuật ngữ), còn từng mục thì cắt khoảng trắng và **bỏ** mục rỗng, mục chứa ký tự điều khiển (kể cả xuống dòng, để một thuật ngữ không thể chèn thêm lệnh vào stdin của sidecar) hoặc dài quá **120 ký tự**. Một thuật ngữ lạ không được làm hỏng cả cuộc họp. Lúc bắt đầu danh sách đi qua biến `CUELINGO_VOCAB`; khi đang họp đi qua dòng stdin `vocab [...]`. Rust không log thuật ngữ.

## Dữ liệu & sự kiện

- (chưa có)

## Sidecar trên Windows

`audio_bridge.rs` chạy `cuelingo-audio.exe` y như bản macOS: không đổi lệnh, sự kiện hay payload nào qua ranh giới. Sự kiện `model` (`downloading` kèm `progress`, `ready`, `error`), `stats` và `level` có cùng dạng với bản Swift. Biến môi trường sidecar Windows đọc thêm: `CUELINGO_MODELS_DIR` (thư mục model, mặc định `%LOCALAPPDATA%\vn.cmcai.cuelingo\models`) và `CUELINGO_STT_THREADS`; `CUELINGO_DETECT` bị bỏ qua. Dòng `{"type":"bench",...}` chỉ có khi chạy tay `--file … --bench`; `route_line` không nhận nó trong cuộc họp. Chi tiết: [local-stt](./local-stt.md#bản-windows-parakeet-qua-sherpa-onnx).

## Sự kiện `audio-utterance`

`route_line` chuyển dòng `utterance` của sidecar thành sự kiện Tauri `audio-utterance` (payload là JSON của dòng đó). Overlay đi theo cuộc họp: `session_start` hiện nó (và đặt nó hiện trên mọi Space), client gọi `hide_overlay` khi phiên đã kết thúc hẳn (sau khi gửi xong các câu cuối). ⌘⇧L và nút ẩn trên overlay vẫn bật/tắt tay. **Biểu tượng menu bar** (`src-tauri/src/tray.rs`): rảnh = biểu tượng đơn sắc dạng template; đang nghe = chấm đỏ kèm thời lượng `h:mm` (cập nhật mỗi phút); mic hoặc âm thanh hệ thống lỗi = chấm hổ phách, chú thích nêu luồng lỗi. Chỉ có chữ cố định và thời lượng, không có nội dung cuộc họp. **Rust quyết định live hay rảnh**: phiên native còn chạy (`AppState.session_id`) là live, bất kể webview nói gì (webview có thể vừa tải lại, hoặc cuộc họp ở trạng thái `error` mà thu âm vẫn chạy); `session_start` và `session_stop` vẽ lại ngay. Webview chỉ báo thêm qua `tray_report` những gì nó biết: còn đang họp (cả lúc gửi nốt các câu cuối sau khi dừng native), số phút, luồng lỗi (`session/tray-sync.ts`, chạy cả khi cửa sổ ẩn). Menu: Mở CueLingo · Dừng họp (bật khi live) · Hiện/ẩn overlay · Thoát. "Thoát" luôn bấm được; khi live nó đổi thành "Dừng họp và thoát": phát `tray-stop`, chờ cuộc họp xong tối đa 20 giây rồi mới thoát, nên webview chết cũng không giữ app lại. `tray-stop` dừng như nút Dừng (bỏ qua khi họp còn đang khởi động). ⌘Q và Quit trên Dock đi cùng đường này khi đang họp (`RunEvent::ExitRequested` không mã thoát bị chặn rồi gọi `tray::quit`); lúc rảnh thì thoát ngay. Gói âm thanh `audio-utterance` và mức âm thanh `audio-level` (xem dưới) chỉ gửi tới cửa sổ `main`; `audio-status` gửi tới mọi cửa sổ.

## Sự kiện `audio-level` và `audio-status`

- `audio-level`: `{type:'level', stream:'system'|'mic', rms, peak}` (0..1), tối đa 10 lần/giây mỗi luồng, để hiện sóng âm trong panel phiên họp.
- `audio-status`: `{type:'status', state:'loading'|'ready'|'error'|'stopped', message}`. Lỗi mở luồng bắt đầu bằng `microphone:` hoặc `system audio:`; app dùng chúng để báo lỗi thu âm cụ thể.

## Câu hỏi mở

- (chưa có)

## Plugin cập nhật, process và OS

`tauri-plugin-updater` (chỉ nạp khi build có `CUELINGO_UPDATER=1`, xem [updater](./updater.md)), `tauri-plugin-process` (khởi động lại sau khi cài, và sau khi đổi máy chủ qua `native.relaunchApp()`, xem [Máy chủ](./server.md); dùng cùng quyền `process:allow-restart`, không có command mới) và `tauri-plugin-os` (tên và phiên bản macOS cho form phản hồi). Quyền trong `capabilities/default.json`: `updater:default`, `process:allow-restart`, `os:allow-platform`, `os:allow-version`, `os:allow-arch`. Bundle: `targets: ["app", "dmg"]`, `signingIdentity: "-"` ([ADR 0017](../../08-adr/0017-beta-distribution-adhoc-updater.md)).
