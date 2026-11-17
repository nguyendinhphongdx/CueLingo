# Plan — onboarding-model-download

Spec: [01-specs.md](./01-specs.md) (đã duyệt, 14 AC). Đã chốt và không bàn lại: chỉ model `en`; từ chối `session_start` khi đang tải; macOS giao brief cho máy Mac, nút ẩn đến khi có (AC8); thoát khi đang tải thì tải tiếp ở nền; bấm mới tải; cảnh báo chỉ nhắc, vẫn cho bắt đầu họp; "Thoát" thành nút ✕.

## 1. Bối cảnh code

| #   | Chỗ                                                         | Hiện tại                                                                                                                                              | Dùng lại / sửa                                                                                                                                           |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `native/windows-audio/src/stt/models.rs`                    | `ensure(spec, hub, root, progress)` đã tải, ghim SHA-256, tải lại khi hỏng, có tệp `<tên>.ok` để khỏi băm lại. `is_good` là hàm riêng, chưa công khai | Thêm `status(spec, root)` dùng lại `is_good` (không tải gì). `--download-model` gọi lại `ensure`                                                         |
| C2  | `native/macos-audio/.../Transcriber.swift:74`               | `Transcriber.isCached(language:)` đã có; tải qua `AsrModels.downloadAndLoad` (kèm nạp CoreML)                                                         | Brief cho Mac: `--model-status` dùng `isCached`, `--download-model` tải (ưu tiên API chỉ-tải nếu FluidAudio có, nếu không thì `downloadAndLoad` rồi bỏ)  |
| C3  | `src-tauri/src/commands.rs:142` `probe_sidecar(flag, kind)` | Chạy sidecar một lần và lấy dòng JSON có `type` mong muốn; trả `None` khi sidecar không in gì                                                         | Nền cho `model_status`: **sidecar cũ không biết cờ mới thì không in dòng `models`, kết quả `None` = "không hỗ trợ" (AC8, AC14)**, không cần số phiên bản |
| C4  | `src-tauri/src/audio_bridge.rs`                             | `AudioBridge::start` spawn sidecar, đọc stdout từng dòng qua `route_line` và `app.emit`. `route_line` đã chuyển `model` thành sự kiện `audio-model`   | `model_download` spawn tiến trình riêng và đẩy qua đúng đường này, nên TS `onAudioModel` và `useModelProgress` **không phải đổi**                        |
| C5  | `commands.rs:82` `session_start`                            | Từ chối khi `session_already_running`                                                                                                                 | Thêm từ chối `model_downloading` (AC5)                                                                                                                   |
| C6  | `src/session/readiness.ts` + `use-readiness.ts`             | `model(input)` luôn trả "ok" ("Tự tải về lần đầu nếu máy chưa có") khi chưa có sự kiện; `ReadinessFix` là union (`pane`, `test-audio`, `retry`)       | Thêm đầu vào `modelStatus` và một loại fix `download-model`: **đây là chỗ cho cảnh báo AC12**, không cần giao diện mới                                   |
| C7  | `src/onboarding/OnboardingFlow.tsx`                         | `ModelStep` chỉ đọc `useModelProgress()`; footer 4 nút; `SKIPPABLE[2]='Bỏ qua, tải sau'`; Enter gọi `next()`                                          | Bước 2 (chỉ số) có điều kiện chặn; gom footer (AC6, AC7)                                                                                                 |
| C8  | `src/app/SettingsPage.tsx` mục `meeting`                    | Chưa có danh sách ngôn ngữ/model                                                                                                                      | Thêm thẻ `LanguageModels` (AC10, AC11)                                                                                                                   |
| C9  | `packages/shared/src/languages.ts`                          | `recognition: 'device' \| 'cloud'` cho từng ngôn ngữ: chỉ `en` là `device`                                                                            | Danh sách AC10 sinh từ đây (không viết cứng): ngôn ngữ nào thêm model sau này tự có dòng                                                                 |

Điểm mở rộng: **Desktop module** (UI + native). Không cần điểm mới, không đụng `@cuelingo/shared`, API, DB: các schema Zod mới là cục bộ trong `native.ts` như `PermissionsStatus`.

Convention: [native-desktop](../../05-engineering/conventions/native-desktop.md) (luật 8: clippy `-D warnings`, không `unwrap`), [web-feature](../../05-engineering/conventions/web-feature.md), [shared-ui](../../05-engineering/conventions/shared-ui.md). Mẫu: đường `probe_sidecar` + `permissions_status`.

## 2. Phương án

### 2a. Cách tải và hỏi trạng thái model

| #   | Phương án                                                                                                                                                                                           | Ưu                                                                                                                                                                                                 | Nhược                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Hai chế độ một lần của sidecar:** `--model-status` (in một dòng `{"type":"models",…}` rồi thoát) và `--download-model` (phát sự kiện `model` rồi thoát). Lõi Tauri chạy chúng như `probe_sidecar` | Dùng lại hàng tải/ghim/SHA-256 đã có, **một giao thức cho cả hai hệ điều hành**. Sidecar cũ tự thành "không hỗ trợ" (không in gì). Không có HTTP trong lõi. Cùng mẫu `--permissions` nên dễ review | Thêm một tiến trình sidecar nữa trong lúc tải (bản Windows khởi động nhẹ vì không nạp ONNX; bản macOS `downloadAndLoad` có nạp CoreML, nên brief tìm API chỉ-tải)                        |
| B   | **Sidecar thường trú:** lõi giữ một sidecar chạy từ lúc mở app, nhận lệnh stdin `status` và `download <lang>`                                                                                       | Không tốn thời gian khởi động mỗi lần                                                                                                                                                              | Phải viết lại vòng đời `AudioBridge` (hiện mỗi phiên một tiến trình), tốn RAM suốt lúc app mở, và lẫn với đường họp. Sidecar cũ không biết lệnh nên phải thăm dò khả năng bằng cách khác |
| C   | **Tải trong lõi Tauri bằng Rust** (HTTP + SHA-256 ở `src-tauri`), sidecar chỉ đọc tệp                                                                                                               | Một đường cho UI                                                                                                                                                                                   | **Không dùng được cho macOS:** FluidAudio tự quản lý thư mục và định dạng CoreML. Phải nhân đôi bảng ghim ở lõi và thêm một HTTP stack, lệch với ADR 0020                                |

**Chọn A.** Lý do: giữ ranh giới "sidecar nói giao thức, lõi chỉ nối", cho Windows và macOS đi cùng một đường, và cho AC8 miễn phí (sidecar cũ im lặng thì ẩn nút).

### 2b. Chặn Tiếp tục khi chưa có model

| #   | Phương án                                                                                                                              | Ưu                                                                                   | Nhược                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| A   | **Trạng thái model sống ở một hook** (`useLocalModels`) mà onboarding, Cài đặt và Phiên họp cùng dùng; bước Mô hình khoá nút theo hook | Một nguồn sự thật, nên ba màn không thể lệch nhau (AC1, AC10, AC12 cùng đọc một chỗ) | Hook phải tự làm mới khi sự kiện `model ready` tới                            |
| B   | Mỗi màn tự hỏi sidecar                                                                                                                 | Đơn giản từng màn                                                                    | Ba bản trạng thái, dễ lệch (đang tải ở màn này mà màn kia vẫn báo "chưa tải") |

**Chọn A.**

### 2c. Vị trí các thành phần giao diện

`ModelDownloadControl` (nút, thanh tiến trình, lỗi, thử lại) dùng ở onboarding **và** Cài đặt, nên viết một lần trong `apps/desktop/src/models/`. Chỉ desktop dùng nên chưa cần đưa vào `@cuelingo/ui` (luật 11 áp dụng cho thứ hiện ở nhiều client); nếu `packages/ui` đã có thanh tiến trình thì dùng lại, không vẽ mới.

## 3. Giao thức (hợp đồng giữa sidecar và lõi)

```text
$ cuelingo-audio --model-status
{"type":"models","models":[{"language":"en","state":"ready","sizeBytes":661000000},
                           {"language":"en", ...}]}      # mỗi ngôn ngữ "Trên máy" một phần tử
# state: "ready" | "missing"   (một tệp hỏng hoặc dở cũng là "missing")

$ CUELINGO_LANGUAGE=en cuelingo-audio --download-model
{"type":"model","language":"en","state":"downloading","progress":0.05}   # như khi họp
{"type":"model","language":"en","state":"ready"}                         # thoát mã 0
{"type":"model","language":"en","state":"error","message":"…"}           # thoát mã 1
```

Ngôn ngữ đám mây không có phần tử và `--download-model` cho chúng trả `error` ("không có model"). Không dòng nào chứa đường dẫn người dùng hay nội dung họp (AC9).

## 4. Tác động

| Tác động                            | Có?   | Chi tiết                                                                                                                                                                                          |
| ----------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB migration                        | Không |                                                                                                                                                                                                   |
| Contract (`@cuelingo/shared`)       | Không | Schema Zod mới cục bộ trong `native.ts` (`ModelStatus`); registry ngôn ngữ chỉ được đọc                                                                                                           |
| Event / Learner Model               | Không |                                                                                                                                                                                                   |
| Prompt / model AI                   | Không | Không model mới, không prompt mới, không qua ai-gateway. Nguồn tải giữ nguyên (Hugging Face, cùng revision và SHA-256)                                                                            |
| Quyền riêng tư / dữ liệu người dùng | Nhẹ   | Không có nhà cung cấp mới và không gửi dữ liệu người dùng. Việc tải bắt đầu từ lúc bấm nút thay vì lúc bắt đầu họp: yêu cầu mạng được người dùng chủ động. Không log đường dẫn hay nội dung (AC9) |
| Hạ tầng / CI                        | Không | `cargo test` Windows đã có trong CI                                                                                                                                                               |
| Bảng lệnh `tauri-core`              | Có    | Thêm `model_status`, `model_download`; `session_start` thêm lỗi `model_downloading`                                                                                                               |

## 5. Các bước (mỗi bước ≈ 1 commit)

Máy: **Win** = làm và chạy được trên PC này · **Mac** = cần máy Mac. Ai làm: **NE** = `native-engineer`, **TS** = `ts-engineer`, **L** = lead.

| #   | Bước                                                                                                                                                                                                                                    | File                                                                                                                                        | Máy | Ai  | Ước lượng |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | --- | --- | --------- |
| 1   | Sidecar Windows: `models::status`, hai chế độ `--model-status` và `--download-model`, test bằng thư mục model tạm (`CUELINGO_MODELS_DIR`): có/thiếu/hỏng, tải giả có tiến trình, ngôn ngữ đám mây                                       | `native/windows-audio/src/stt/models.rs`, `src/main.rs`, `src/session.rs` (nếu cần)                                                         | Win | NE  | 0,5 ngày  |
| 2   | Lõi Tauri: lệnh `model_status` (qua `probe_sidecar`, `Option`), `model_download` (một tiến trình tải tại một thời điểm, đẩy `route_line`, dọn tiến trình khi thoát app), `session_start` từ chối `model_downloading`, test hàm thuần    | `src-tauri/src/{commands,audio_bridge,lib}.rs`, `04-modules/01-desktop/tauri-core.md`                                                       | Win | NE  | 0,5 ngày  |
| 3   | TS nền: schema `ModelStatus`, `native.modelStatus()`/`downloadModel()`, hook `useLocalModels` (trạng thái từng ngôn ngữ = status + sự kiện), `ModelDownloadControl`, test                                                               | `src/lib/native.ts`, `src/models/*`                                                                                                         | Win | TS  | 0,5 ngày  |
| 4   | Onboarding: `ModelStep` dùng hook (AC1–AC4, AC8), khoá Tiếp tục và Enter, bỏ "Bỏ qua" ở bước này; footer gọn và nút ✕ (AC6, AC7); cập nhật test                                                                                         | `src/onboarding/OnboardingFlow.tsx` (+ test), `04-modules/01-desktop/onboarding.md`                                                         | Win | TS  | 0,5 ngày  |
| 5   | Cài đặt: thẻ `LanguageModels` trong mục "Họp và caption" (AC10, AC11, AC13)                                                                                                                                                             | `src/app/SettingsPage.tsx`, `src/models/LanguageModels.tsx` (+ test), `04-modules/01-desktop/settings.md`                                   | Win | TS  | 0,5 ngày  |
| 6   | Phiên họp: `readiness.ts` có `modelStatus` và fix `download-model` (cảnh báo AC12), `describeNativeError` hiểu `model_downloading` (AC5), test                                                                                          | `src/session/{readiness,use-readiness,session-actions}.ts(x)` (+ test)                                                                      | Win | TS  | 0,5 ngày  |
| 7   | Docs giao thức: `local-stt.md`, scaffold 07 (mục giao thức), `audio-capture.md` nếu cần; viết `04-brief-macos-model.md` cho Swift                                                                                                       | `04-modules/01-desktop/{local-stt,audio-capture}.md`, `05-engineering/scaffold/07-native-swift.md`, `06-delivery/…/04-brief-macos-model.md` | Win | L   | 0,5 ngày  |
| 8   | **Chạy thật trên PC này:** model thật đã có (bấm Tiếp tục ngay, không tải lại); trỏ `CUELINGO_MODELS_DIR` vào thư mục trống để thử thiếu, tải, lỗi (rút mạng), thoát giữa chừng, bấm Bắt đầu họp lúc đang tải. **Không xoá model thật** | —                                                                                                                                           | Win | L   | 0,5 ngày  |
| 9   | Swift cho macOS theo brief (ngoài PC này)                                                                                                                                                                                               | `native/macos-audio/Sources/{Sidecar,LocalSTT}/…`, `swift test`                                                                             | Mac | NE  | 0,5 ngày  |

Phụ thuộc: 1 → 2 → 3 → (4 ‖ 5 ‖ 6) → 7 → 8; bước 9 độc lập, sau 7. **Tổng khoảng 3–3,5 ngày** (bước 1–8 làm hết được ở đây, khoảng 3 ngày; bước 9 chờ máy Mac).

## 6. Rủi ro

| #   | Rủi ro                                                                             | Giảm thiểu                                                                                                                                 |
| --- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| R1  | Không build/test Swift được trên PC này                                            | Brief đủ để Mac làm; AC8 giữ hành vi cũ khi sidecar chưa có cờ mới, nên macOS không bị chặn khỏi onboarding trong lúc chờ                  |
| R2  | Đang tải mà họp bắt đầu, hai tiến trình cùng ghi một tệp `.part`                   | Lõi cho phép một tải tại một thời điểm và `session_start` từ chối (AC5); test cả hai chiều: tải khi họp đang chạy cũng bị từ chối          |
| R3  | Tiến trình tải mồ côi khi đóng app                                                 | Lõi giữ `Child` và dừng khi thoát; sidecar tải về `<tên>.part` rồi mới đổi tên nên tệp dở không bao giờ được coi là đủ                     |
| R4  | `--model-status` băm 661 MB khi chưa có tệp `.ok` (tệp chép tay) nên chậm vài giây | Lệnh Tauri chạy `async` ngoài luồng UI; UI hiện "Đang kiểm tra…". Lần sau có `.ok` nên tức thì                                             |
| R5  | Onboarding bắt buộc khiến máy offline hoặc mạng công ty chặn Hugging Face kẹt      | ✕ vẫn thoát được (đã chốt); thẻ trang chủ nhắc làm tiếp; danh sách ở Cài đặt là nơi tải sau. Lỗi mạng nêu nguyên nhân ngắn và có "Thử lại" |
| R6  | Người dùng đã xong onboarding từ trước không thấy bước mới                         | Không bắt họ quay lại: họ có danh sách ở Cài đặt và cảnh báo ở Phiên họp (AC10, AC12)                                                      |
| R7  | Trạng thái lệch giữa các màn                                                       | Một hook duy nhất (2b-A) và test: bắt đầu tải ở màn này thì màn kia hiện "đang tải"                                                        |

## 7. Test theo AC

| AC        | Test                                                                                                                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC1, AC2  | `cargo test`: `status` với thư mục có đủ, thiếu, sai kích thước, sai SHA; `OnboardingFlow.test.tsx`: có nút khi `missing`, "Đã sẵn sàng" và Tiếp tục mở khi `ready`; **chạy thật** (bước 8) |
| AC3       | `OnboardingFlow.test.tsx`: khoá khi `missing`/`downloading`/`error`, Enter không đi tiếp, không có "Bỏ qua", Quay lại và ✕ vẫn dùng được                                                    |
| AC4       | `cargo test` (mất kết nối giả, SHA sai không để lại tệp); test TS lỗi tiếng Việt + "Thử lại"                                                                                                |
| AC5       | Test lõi: `session_start` khi đang tải trả `model_downloading`, `model_download` khi đang họp bị từ chối; test `describeNativeError`                                                        |
| AC6, AC7  | `OnboardingFlow.test.tsx`: footer đúng các nút theo bước, ✕ có nhãn "Thoát, làm tiếp sau" và lưu bước, Enter/Esc như cũ                                                                     |
| AC8, AC14 | Test `native.ts`: `modelStatus()` trả `null` khi sidecar không in dòng `models`, UI giữ hành vi cũ; `cargo test` và `swift test` cho dòng `models`                                          |
| AC9       | Review quyền riêng tư; test sidecar: stdout chỉ chứa các trường đã liệt kê, `stderr` null                                                                                                   |
| AC10–AC13 | `LanguageModels.test.tsx` (các dòng sinh từ registry, trạng thái, nút), `readiness.test.ts` (cảnh báo, vẫn cho bắt đầu, đám mây không cảnh báo), `cloud-consent` hiện có vẫn xanh           |

## 8. Docs phải sửa

`04-modules/01-desktop/{onboarding,settings,tauri-core,local-stt}.md` (và `audio-capture.md` nếu đổi) · `05-engineering/scaffold/07-native-swift.md` (giao thức một lần) · `06-delivery/…/04-brief-macos-model.md` (mới). Không cần ADR: không đổi stack, không nhà cung cấp mới.

## 9. Giao việc

| Phần việc           | Giao cho                               | Ghi chú                                               |
| ------------------- | -------------------------------------- | ----------------------------------------------------- |
| Bước 1, 2           | `native-engineer`                      | Rust, thử thật trên PC này                            |
| Bước 3–6            | `ts-engineer`                          | Có thể song song bước 4–6 sau khi bước 3 xong         |
| Bước 7, 8, các cổng | Lead                                   | Giao thức, brief, chạy thật                           |
| Bước 9 (Swift)      | Máy Mac (Codex hoặc `native-engineer`) | Theo `04-brief-macos-model.md`                        |
| Review              | `code-reviewer` (khác người viết)      | Soát riêng `session_start` và dọn tiến trình (R2, R3) |

## 10. Giả định

| #   | Giả định                                                                                                                         |
| --- | -------------------------------------------------------------------------------------------------------------------------------- |
| G1  | "Đã sẵn sàng" nghĩa là mọi tệp của model có đúng kích thước và SHA-256 (hoặc tệp `.ok` còn khớp), không chỉ tệp tồn tại          |
| G2  | Dung lượng hiển thị lấy từ bảng ghim trong sidecar (`sizeBytes`), không viết cứng ở UI                                           |
| G3  | Nhánh: tách `feat/onboarding-model-download` sau khi commit các sửa lỗi đăng nhập đang chờ; không dồn vào `feat/windows-phase-b` |

## 11. Thay đổi so với plan khi làm

| Ngày       | Thay đổi                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-17 | **AC8 không dò bằng cách hỏi sidecar.** Sidecar không biết cờ lạ sẽ bỏ qua và chạy như một cuộc họp (tải model ngầm). Lõi dùng cờ biên dịch `MODEL_CONTROL` (`commands.rs`): bật cho Windows; macOS bật cùng lúc với bản Swift (brief). Trước đó `model_status` trả `null` và `model_download` trả `model_control_unavailable`                                                                          |
| 2026-11-17 | **Danh sách model thành một mục riêng "Mô hình"** trong thanh bên Cài đặt (theo ý người dùng sau khi xem màn Cài đặt), không nhét vào "Họp và caption" như AC10 ghi                                                                                                                                                                                                                                     |
| 2026-11-17 | Bước 1 và 2 xong: `modelctl.rs` (sidecar), `ModelDownload` + `model_status`/`model_download` (lõi). Trạng thái tải sống ở một store dùng chung để rời màn rồi quay lại vẫn thấy tiến trình                                                                                                                                                                                                              |
| 2026-11-17 | **Hộp thoại khi bắt đầu họp** (`ModelGateDialog` + `gateAction` trong `use-meeting-controls`) thay cho "chỉ nhắc". `ConfirmDialog` dùng chung được mở rộng (nút xác nhận tuỳ chọn, nội dung trong `div`). Lõi thêm `model_cancel`; mỗi lần tải có cờ hủy riêng và chỉ dọn đúng tiến trình của mình (sửa một cuộc đua giữa hủy rồi tải lại); `ModelWatch` báo khi sidecar của cuộc họp chết giữa lúc tải |
