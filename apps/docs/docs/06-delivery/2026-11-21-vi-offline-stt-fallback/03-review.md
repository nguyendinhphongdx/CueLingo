# Review — vi-offline-stt-fallback

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                                 | Chi tiết (lý do nếu khác plan)                                                                                                                                                             |
| ----------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 🟢 ADDED    | `src-tauri/src/local_stt.rs`, lệnh `local_stt_*`                                               | Đúng plan B. Dùng lại `ensure`/`is_installed` của crate `cuelingo-audio` (không viết lại phần tải + SHA-256). Thêm bộ đếm thế hệ để một nhận dạng cũ không nạp lại model sau khi họp xong. |
| 🟢 ADDED    | `session/offline-fallback.ts`, nối vào `session-controller.ts`                                 | **Khác plan:** bỏ ngưỡng "8 giây"; thay bằng một lần thử tối đa 8 giây, không thử lại, mỗi lúc chỉ một câu dò. Lý do: reviewer chỉ ra mạng treo làm câu trễ ~32 giây.                      |
| 🟢 ADDED    | `models/OfflineSttSettings.tsx`, `use-offline-stt.ts`; nhãn "Ngoại tuyến" ở `CaptionBlock.tsx` | Công tắc nằm ở mục Mô hình nhận dạng, tái dùng `ModelDownloadControl`.                                                                                                                     |
| 🟡 MODIFIED | `native/windows-audio/src/stt/models.rs`                                                       | `ensure` tạo thư mục cha của tệp (tên tệp là đường dẫn trong repo). Kiểm bằng lần tải thật vào thư mục trống. Chạm sidecar Windows nên soi kỹ.                                             |
| 🟡 MODIFIED | `lib/native.ts`, `session/use-session.ts`, `Cargo.toml` (+ `Cargo.lock`)                       | `TranscriptEvent.offline`; phụ thuộc `cuelingo-audio` (không `stt`), `sherpa-onnx =2.0.1`, `base64`.                                                                                       |
| 🔴 REMOVED  | _(không)_                                                                                      |                                                                                                                                                                                            |

**Docs đã cập nhật:** ADR 0024 (mới, sửa sau review), `04-modules/01-desktop/{tauri-core,local-stt,session-controller,settings,overlay}.md`.

## Tự review

- [x] Ranh giới & bảo mật: không log nội dung câu hay PCM; câu nhận dạng trên máy không gửi âm thanh đi; không tải model lúc họp; mỗi tệp ghim revision, kích thước, SHA-256.
- [x] Hợp đồng: không đổi `@cuelingo/shared`. Cờ `offline` chỉ ở sự kiện giữa các cửa sổ.
- [x] Kiến trúc: ngoại lệ "STT ngoài sidecar" ghi ở ADR 0024. `pnpm check:deps` sạch.
- [x] AI: không có lời gọi AI mới.
- [x] Test · [x] Docs · [x] Phạm vi (không đệm segment khi mất mạng, không Parakeet-CTC).

```bash
pnpm verify
```

**Đã chạy thật:**

| Gì                                                                                                   | Kết quả                                                                   |
| ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Tải model thật từ Hugging Face vào thư mục trống, qua `models::ensure` (kể cả tệp trong thư mục con) | 4 tệp đúng hash, `is_installed`, nạp model, nhận dạng được                |
| Nhận dạng 30 câu giọng tổng hợp bằng đúng mã Rust (bản release, 2 luồng, M1 Pro)                     | RTF 0,021 · p95 0,098 s · RAM ~370 MB (AC8 đạt: ≤ 0,1 · ≤ 1 s · ≤ 600 MB) |
| Test Rust (`cargo test`, `clippy -D warnings`), 400 test phiên họp, `pnpm verify` toàn repo          | Xanh                                                                      |

**Chưa chạy thật** (cần người dùng): họp tiếng Việt trong app thật rồi rút mạng giữa chừng; Windows; chất lượng với giọng người thật (chỉ đo giọng tổng hợp, WER 19,0% trên câu xen tiếng Anh).

## Cho người review — đọc theo thứ tự

| #   | File                                                  | Soi gì                                                                 |
| --- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | `08-adr/0024-vi-offline-stt-fallback.md`              | Giấy phép, nguồn tải mới, ngoại lệ việc dò đám mây, lời báo riêng tư   |
| 2   | `src-tauri/src/local_stt.rs`                          | Tải + kiểm hash, khoá và bộ đếm thế hệ, không log, không tải khi họp   |
| 3   | `session/session-controller.ts` (`handleUtterance`)   | Không mất/lặp câu, đường hết hạn mức, quick-attempt 8 giây, một câu dò |
| 4   | `session/offline-fallback.ts`                         | Quy tắc chuyển (2 lỗi liên tiếp, dò mỗi 15 giây)                       |
| 5   | `models/OfflineSttSettings.tsx`, `use-offline-stt.ts` | Công tắc, tải lúc bật, thông báo lỗi                                   |
| 6   | `native/windows-audio/src/stt/models.rs`              | Chỉ thêm `create_dir_all` cho đường dẫn con                            |

## Lỗi tìm thấy khi review/test

| Mức | Lỗi (reviewer độc lập)                                                           | Xử lý                                                                                             |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 🔴  | Lời báo "âm thanh không rời máy" sai vì cứ 15 giây một câu vẫn lên đám mây để dò | Sửa lời báo (Cài đặt, thông báo, nhãn) và ghi ngoại lệ vào ADR; dò một câu một lần, tối đa 8 giây |
| 🟡  | Mạng treo làm câu trễ ~32 giây; các lần dò chồng nhau                            | Một lần thử 8 giây khi dự phòng bật, không thử lại; mỗi lúc một câu dò; có test                   |
| 🟡  | Hết hạn mức báo sai lý do và mất nút Nâng cấp                                    | Thông báo riêng cho hạn mức, vẫn gọi thông báo hạn mức thường; có test                            |
| 🟡  | `local_stt_unload` / `status` chạy trên luồng chính, giữ khoá lúc nạp model      | Chuyển sang `async` + `spawn_blocking`                                                            |
| 🟡  | Model bị nạp lại sau khi họp xong                                                | Bộ đếm thế hệ; nhận dạng bắt đầu trước khi giải phóng trả `released`                              |
| 🟡  | Bật dự phòng giữa họp báo "kiểm tra mạng"                                        | Thông báo "Đang họp. Hãy tải mô hình sau khi họp xong."                                           |
| 🟡  | ADR ghim 5 tệp, code 4 tệp                                                       | Sửa ADR: 4 tệp (`bpe.model` không cần khi giải mã; nhận dạng chạy được không có nó)               |
| 🟢  | Cờ "đang tải" kẹt nếu thread panic                                               | Guard đặt lại cờ trong `Drop`                                                                     |
| 🟡  | Lần tải đã chạy vẫn chạy tiếp khi bắt đầu họp                                    | **Giữ nguyên, ghi vào docs:** chỉ là tải tệp nền; chặn bắt đầu tải giữa họp vẫn có                |

## Quyết định còn mở cho chủ sản phẩm

- `segment.final` của câu ngoại tuyến lên server **chưa đánh dấu** (debrief và ôn tập không phân biệt được chất lượng). Thêm cờ `source` vào hợp đồng hay chấp nhận như hiện tại?
- Chưa có trang "Giới thiệu" ở desktop để ghi công tác giả model (ADR 0024 hẹn trước khi phát hành công khai).
- Chưa kiểm nguồn dữ liệu huấn luyện của model (README gốc không ghi); chấp nhận rủi ro hoặc đổi model trước khi phát hành công khai.
