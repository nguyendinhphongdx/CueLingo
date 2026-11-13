# 0020 · Windows: sidecar Rust, WASAPI loopback, Parakeet ONNX trên CPU

**Trạng thái:** Proposed · 2026-11-13 (chờ spike S1, S2 trong hồ sơ [windows-desktop](../06-delivery/2026-11-13-windows-desktop/02-plan.md)). Bổ sung [0002](0002-desktop-tauri-swift.md), giữ nguyên [0003](0003-stt-on-device-first.md).

## Bối cảnh

Chủ sản phẩm cần app desktop chạy trên Windows ([spec](../06-delivery/2026-11-13-windows-desktop/01-specs.md)). Trên macOS, thu âm và STT nằm trong sidecar Swift `cuelingo-audio` dùng API riêng của Apple. Giao thức giữa sidecar và lõi Rust (JSON từng dòng trên stdout, lệnh stdin `stop`/`vocab`/`language`, biến môi trường, các chế độ chạy một lần) không có gì riêng của macOS.

## Quyết định

- **Sidecar Rust riêng** `apps/desktop/native/windows-audio`, dựng thành `cuelingo-audio.exe`, nói **đúng giao thức hiện có**. Lõi Tauri và code TypeScript không đổi logic.
- **Thu âm:** WASAPI qua `cpal`. Âm thanh hệ thống bằng loopback trên thiết bị output mặc định (toàn hệ thống, giống macOS, chạy được từ Windows 10 22H2); micro bằng thiết bị input mặc định; mở lại khi thiết bị mặc định đổi. Dự phòng: crate `wasapi` cho riêng phần loopback.
- **STT tiếng Anh on-device:** Parakeet TDT 0.6B v2 bản ONNX int8, chạy CPU qua ONNX Runtime (thư viện chốt ở spike S2). Model tải lần đầu, ghim revision và SHA-256. Vi/ja/ko/zh trên Windows đi đường đám mây như macOS ([0014](0014-cloud-stt-for-vietnamese.md), [0016](0016-cloud-stt-for-japanese-korean-chinese.md)).
- **Tiêu chí dừng:** p95 > 1,0 s cho câu ≤ 8 s hoặc RAM > 1,5 GB trên máy mục tiêu → dừng và trình chủ sản phẩm (model nhỏ hơn, hoặc đám mây kèm ADR thay một phần 0003).

## Phương án đã cân nhắc

- Thu âm ngay trong tiến trình Tauri: bớt một tiến trình nhưng phải viết lại `AudioBridge` thành hai nhánh và đặt ONNX chung tiến trình với UI.
- Process loopback (loại tiếng của chính app): chỉ có từ Windows 11, trái yêu cầu chạy trên Windows 10.
- STT chỉ qua đám mây: phải đổi contract, thêm migration, sửa API transcribe, thêm bước đồng ý, không có partial và tốn tiền mỗi giờ họp.
- Model nhỏ hơn (Moonshine, Whisper base/small): nhẹ hơn nhưng WER trên dữ liệu họp kém Parakeet rõ rệt.

## Hệ quả

- Hai bản cài đặt logic tách câu, đo mức âm, sửa thuật ngữ (Swift và Rust): dùng chung vector test ở `apps/desktop/native/fixtures`.
- Token trên Windows lưu ở Credential Manager (`keyring` feature `windows-native`).
- Trên Windows bản đầu không có model tiếng Nhật on-device và không dò ngôn ngữ lúc đầu họp; gợi ý ngôn ngữ từ lịch không có.
- Ghi công Parakeet (CC-BY-4.0) trong "Giới thiệu" như macOS.
