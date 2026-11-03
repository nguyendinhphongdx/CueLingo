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
- `session_start` nhận `vocabulary` (danh sách thuật ngữ, xem dưới); `session_set_vocabulary(terms)` thay danh sách khi đang họp
- Tauri events: `transcript`, `speech`, `hotkey`

## Phụ thuộc

- Tauri 2, plugins global-shortcut, updater

## Thuật ngữ cho nhận dạng

Rust chỉ kiểm và chuyển tiếp, không có logic sản phẩm. `clean_vocabulary` **từ chối** danh sách nhận về có hơn **200 mục** (mã lỗi cố định `vocabulary_too_large`, không chứa nội dung thuật ngữ), còn từng mục thì cắt khoảng trắng và **bỏ** mục rỗng, mục chứa ký tự điều khiển (kể cả xuống dòng, để một thuật ngữ không thể chèn thêm lệnh vào stdin của sidecar) hoặc dài quá **120 ký tự**. Một thuật ngữ lạ không được làm hỏng cả cuộc họp. Lúc bắt đầu danh sách đi qua biến `CUELINGO_VOCAB`; khi đang họp đi qua dòng stdin `vocab [...]`. Rust không log thuật ngữ.

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- (chưa có)
