# 0002 · Desktop: Tauri 2 + module Swift

**Trạng thái:** Accepted · 2026-10-31

## Bối cảnh

App desktop cần: thu audio hệ thống trên macOS (Core Audio Process Tap / ScreenCaptureKit), chạy STT trên Neural Engine, overlay luôn nổi và ẩn khi chia sẻ màn hình, đồng thời dùng lại UI React của web.

## Quyết định

- Tauri 2 (Rust) làm shell; UI bằng React/TypeScript, dùng chung `@cuelingo/ui`.
- Module Swift (`apps/desktop/native/macos-audio`) cho audio capture và local STT (FluidAudio), gọi từ Rust qua FFI hoặc Tauri plugin.
- Windows: thay module Swift bằng WASAPI loopback (cpal) + STT phù hợp. Mở sớm ngày 2026-11-13, chi tiết ở [0020](0020-windows-capture-stt.md).

## Phương án đã cân nhắc

- Electron: dễ hơn nhưng nặng (RAM) khi chạy song song với app họp.
- Native Swift hoàn toàn: tốt nhất trên Mac nhưng không dùng lại được UI cho web và Windows.

## Hệ quả

- Cần người biết Swift + Rust cho lớp native.
- Tham khảo [anarlog](https://github.com/fastrepl/anarlog) (Tauri, MIT) khi dựng khung.
