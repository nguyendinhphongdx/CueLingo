# Tauri core

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/src-tauri/src/`

Lớp Rust của app: cửa sổ, phím tắt toàn cục, cầu nối native ↔ webview, bảo mật token, cập nhật.

## Trách nhiệm

- Quản lý cửa sổ: overlay luôn nổi, không hiện khi chia sẻ màn hình (NSWindow sharingType = none), menu bar
- Phím tắt toàn cục: ⌘⇧L (bắt đầu/dừng), ⌘⇧W (recap), ⌘⇧S (nói giúp tôi)
- Nhận sự kiện từ `audio-capture`/`local-stt` và đẩy sang webview qua Tauri events
- Lưu token trong Keychain
- Auto-update, ký và notarize

## Phạm vi MVP

- Toàn bộ

## Interface

- Tauri commands: `session_start`, `session_stop`, `session_set_language`, `session_set_vocabulary`, `permissions_status`, `set_assist_level`
- Tauri commands khác: `hide_overlay`, `toggle_overlay`, `tray_report` (`active`, `minutes`, `problem` = `mic`/`system`/`both`)
- `session_start` nhận `vocabulary` (danh sách thuật ngữ, xem dưới); `session_set_vocabulary(terms)` thay danh sách khi đang họp
- Tauri events: `transcript`, `speech`, `hotkey`, `tray-stop` (mục "Dừng họp" ở menu bar; chỉ gửi tới `main`)

## Phụ thuộc

- Tauri 2, plugins global-shortcut, updater

## Thuật ngữ cho nhận dạng

Rust chỉ kiểm và chuyển tiếp, không có logic sản phẩm. `clean_vocabulary` **từ chối** danh sách nhận về có hơn **200 mục** (mã lỗi cố định `vocabulary_too_large`, không chứa nội dung thuật ngữ), còn từng mục thì cắt khoảng trắng và **bỏ** mục rỗng, mục chứa ký tự điều khiển (kể cả xuống dòng, để một thuật ngữ không thể chèn thêm lệnh vào stdin của sidecar) hoặc dài quá **120 ký tự**. Một thuật ngữ lạ không được làm hỏng cả cuộc họp. Lúc bắt đầu danh sách đi qua biến `CUELINGO_VOCAB`; khi đang họp đi qua dòng stdin `vocab [...]`. Rust không log thuật ngữ.

## Dữ liệu & sự kiện

- (chưa có)

## Sự kiện `audio-utterance`

`route_line` chuyển dòng `utterance` của sidecar thành sự kiện Tauri `audio-utterance` (payload là JSON của dòng đó). Overlay đi theo cuộc họp: `session_start` hiện nó (và đặt nó hiện trên mọi Space), client gọi `hide_overlay` khi phiên đã kết thúc hẳn (sau khi gửi xong các câu cuối). ⌘⇧L và nút ẩn trên overlay vẫn bật/tắt tay. **Biểu tượng menu bar** (`src-tauri/src/tray.rs`): rảnh = biểu tượng đơn sắc dạng template; đang nghe = chấm đỏ kèm thời lượng `h:mm` (cập nhật mỗi phút); mic hoặc âm thanh hệ thống lỗi = chấm hổ phách, chú thích nêu luồng lỗi. Chỉ có chữ cố định và thời lượng, không có nội dung cuộc họp. **Rust quyết định live hay rảnh**: phiên native còn chạy (`AppState.session_id`) là live, bất kể webview nói gì (webview có thể vừa tải lại, hoặc cuộc họp ở trạng thái `error` mà thu âm vẫn chạy); `session_start` và `session_stop` vẽ lại ngay. Webview chỉ báo thêm qua `tray_report` những gì nó biết: còn đang họp (cả lúc gửi nốt các câu cuối sau khi dừng native), số phút, luồng lỗi (`session/tray-sync.ts`, chạy cả khi cửa sổ ẩn). Menu: Mở CueLingo · Dừng họp (bật khi live) · Hiện/ẩn overlay · Thoát. "Thoát" luôn bấm được; khi live nó đổi thành "Dừng họp và thoát": phát `tray-stop`, chờ cuộc họp xong tối đa 20 giây rồi mới thoát, nên webview chết cũng không giữ app lại. `tray-stop` dừng như nút Dừng (bỏ qua khi họp còn đang khởi động). ⌘Q và Quit trên Dock vẫn thoát ngay, không qua đường này. Gói âm thanh `audio-utterance` và mức âm thanh `audio-level` (xem dưới) chỉ gửi tới cửa sổ `main`; `audio-status` gửi tới mọi cửa sổ.

## Sự kiện `audio-level` và `audio-status`

- `audio-level`: `{type:'level', stream:'system'|'mic', rms, peak}` (0..1), tối đa 10 lần/giây mỗi luồng, để hiện sóng âm trong panel phiên họp.
- `audio-status`: `{type:'status', state:'loading'|'ready'|'error'|'stopped', message}`. Lỗi mở luồng bắt đầu bằng `microphone:` hoặc `system audio:`; app dùng chúng để báo lỗi thu âm cụ thể.

## Câu hỏi mở

- (chưa có)
