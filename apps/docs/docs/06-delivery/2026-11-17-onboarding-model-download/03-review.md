# Review — onboarding-model-download

## Thay đổi so với plan

| Dấu         | File / hành vi                                                               | Chi tiết (lý do nếu khác plan)                                                                                                                                              |
| ----------- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 ADDED    | `native/windows-audio/src/modelctl.rs`, `--model-status`, `--download-model` | Đúng plan 2a-A. `models.rs` thêm `model_dir`, `is_installed`, `total_bytes`, `spec_for`; `ensure` dùng `model_dir`                                                          |
| 🟢 ADDED    | `src-tauri`: `model_status`, `model_download`, `ModelDownload`               | Một lần tải tại một thời điểm; `session_start` từ chối `model_downloading`; thoát app dừng tải; lần tải chết không có kết luận thì phát một `error`                         |
| 🟡 MODIFIED | Cờ `MODEL_CONTROL` (`commands.rs`) thay cho "sidecar im lặng thì ẩn" (AC8)   | **Khác plan.** Sidecar không biết cờ lạ chạy như một cuộc họp và tự tải model, nên không thể dò bằng cách hỏi. Bật cho Windows; macOS bật cùng bản Swift. Ghi ở plan mục 11 |
| 🟢 ADDED    | `apps/desktop/src/models/*`, `Progress` ở `@cuelingo/ui`                     | Một store và một hook cho cả ba màn. `Progress` là thành phần chung chung (luật 11), không dùng lại `UsageMeter` vì gắn với nhãn lượng dùng                                 |
| 🟡 MODIFIED | `OnboardingFlow.tsx`: bước Mô hình bắt buộc, footer, nút ✕                   | `footerFor` là hàm thuần quyết định khoá/bỏ qua. Cần `QueryClient` nên 4 test cũ đổi sang `renderFlow`. **Chỗ rủi ro:** Enter bị chặn bằng `footer.blocked` trong `next()`  |
| 🟢 ADDED    | Cài đặt → mục **"Mô hình"** (`LanguageModels`)                               | **Khác spec ban đầu** (AC10 ghi trong "Họp và caption"): người dùng muốn một trang riêng. Ẩn khi `model_status` trả `null`                                                  |
| 🟡 MODIFIED | `readiness.ts`, `use-readiness.ts`, `session-actions.ts`                     | Dòng model đọc `modelView`; thêm fix `download-model`; thêm thông báo `model_downloading`                                                                                   |
| 🟡 MODIFIED | Hộp thoại bắt đầu họp (`ModelGateDialog`), `model_cancel`, ✕ và ↻            | **Khác spec ban đầu** (AC12 là "chỉ nhắc"): người dùng muốn tiến trình trong hộp thoại rồi tự tiếp tục, và có hủy/tải lại. `ConfirmDialog` dùng chung được mở rộng          |
| 🔴 REMOVED  | "Bỏ qua, tải sau" ở bước Mô hình (khi app quản lý được model)                | Theo yêu cầu "bắt buộc tải". Bản không quản lý được model giữ nguyên nút cũ                                                                                                 |

**Docs đã cập nhật:** `tauri-core.md`, `local-stt.md`, `onboarding.md`, `settings.md`, `session-controller.md`, hồ sơ này (spec, plan, brief macOS).

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md):

- [x] Ranh giới & bảo mật: lõi không nhận đường dẫn từ UI (chỉ mã ngôn ngữ 2 đến 3 chữ thường); nguồn tải và SHA-256 giữ nguyên bảng ghim; lỗi hiển thị là chuỗi tiếng Việt cố định, không bao giờ là thông điệp của sidecar
- [x] Hợp đồng: không đụng `@cuelingo/shared`; schema `ModelStatus` cục bộ ở `native.ts`
- [x] Kiến trúc: `check:deps` xanh; không import chéo
- [x] AI: không có lời gọi AI, không model mới
- [x] Test: có test cho từng AC chạy được ở đây (xem bảng dưới)
- [x] Docs: 5 trang module + hồ sơ
- [x] Phạm vi: không vượt spec, hai chỗ khác spec đã ghi ở bảng trên và ở decision log

```bash
pnpm verify   # xanh: 283 file, 2342 test, check:deps sạch
```

**Đã chạy thật** (PC Windows 11, sidecar release): `--model-status` với thư mục model thật (`ready`), với thư mục trống (`missing`), `--download-model` khi đã có (`ready` ngay, không gọi mạng), ngôn ngữ đám mây (`error`, mã 1), thư mục trống qua proxy chết (`error` rõ ràng, mã 1). Sidecar đóng gói cạnh app trả `--model-status` đúng. App mở với thư mục model trống để người dùng thử luồng tải.

**Chưa kiểm** (cần người thử hoặc máy khác):

- Bấm tay trong cửa sổ Tauri: tải thật 631 MB, tiến trình ở ba màn, ✕ khi đang tải, bắt đầu họp lúc đang tải
- macOS: bản Swift (xem `04-brief-macos-model.md`); trên macOS mục "Mô hình" ẩn và onboarding giữ luồng cũ
- Không có test cho ranh giới "hai tiến trình cùng tải" ở mức tiến trình thật (chỉ test hàm thuần `forward_download_lines`, `alive`, `download_command`)
- Chưa có `code-reviewer` độc lập

## Cho người review — đọc theo thứ tự

| #   | File                                                           | Soi gì                                                                                            |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1   | `02-plan.md` mục 11                                            | Hai chỗ lệch plan và vì sao                                                                       |
| 2   | `src-tauri/src/audio_bridge.rs` (`ModelDownload`)              | Khoá `Mutex`, `alive` dọn tiến trình đã thoát, luồng đọc dọn ô khi hết dòng, `stop` khi thoát app |
| 3   | `src-tauri/src/commands.rs` (`MODEL_CONTROL`, `session_start`) | Cờ biên dịch; thứ tự kiểm `session_already_running` rồi `model_downloading`                       |
| 4   | `native/windows-audio/src/modelctl.rs`                         | `is_installed` trước khi tải; mã thoát; không in đường dẫn                                        |
| 5   | `apps/desktop/src/models/model-state.ts`                       | `viewOf`, `canContinue`, `describeDownloadError`                                                  |
| 6   | `apps/desktop/src/onboarding/OnboardingFlow.tsx` (`footerFor`) | Khoá Tiếp tục và Enter; bản cũ khi `modelView` null                                               |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                                                                                                      | Tìm ở                                                | Sửa                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------------- |
| Hỏi `--model-status` một sidecar cũ sẽ chạy như một cuộc họp và tải model ngầm (AC8 trong plan không an toàn)                                            | Đọc code `main.swift` khi viết lõi                   | Cờ biên dịch `MODEL_CONTROL`; macOS bật cùng bản Swift                       |
| Regex sửa `main.rs` nuốt cả khối `--download-model` và dòng tạo `session`                                                                                | `cargo` báo thiếu dấu đóng                           | Khôi phục bằng tay, kiểm lại diff chỉ còn các dòng định thêm                 |
| 4 test onboarding hỏng vì cần `QueryClient` và bước Mô hình không còn "Bỏ qua"                                                                           | `vitest`                                             | Cập nhật test theo hành vi mới, thêm test cho `footerFor` và `ModelStepView` |
| Dừng họp giữa lúc sidecar của cuộc họp còn đang tải model giết tiến trình mà màn hình vẫn hiện "Đang tải 60%" mãi (tệp dở 399 MB, không còn sidecar nào) | Người dùng báo, rồi kiểm tiến trình và thư mục model | `ModelWatch` phát `error` khi sidecar chết giữa lúc tải (AC16)               |
| Hủy rồi tải lại ngay có thể để luồng đọc của lần cũ lấy nhầm tiến trình của lần mới khỏi ô chứa, làm `is_running` sai                                    | Nghĩ tới trường hợp khi thêm ✕ và ↻                  | Mỗi lần tải có cờ hủy riêng và chỉ dọn đúng pid của mình                     |
