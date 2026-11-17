# Brief — onboarding-model-download · sidecar Swift (macOS)

> Giao cho: _native-engineer hoặc Codex, **trên máy Mac**_ · Nhánh: `feat/onboarding-model-download-macos`
> Quy tắc phối hợp: `apps/docs/docs/05-engineering/agent-collaboration.md`

## Mục tiêu

Thêm hai chế độ một lần vào sidecar Swift, cùng giao thức với bản Windows (`native/windows-audio/src/modelctl.rs`), để onboarding và Cài đặt tải và kiểm model trên macOS mà không cần họp, rồi bật cờ `MODEL_CONTROL` cho macOS.

## Vì sao việc này phải làm trên Mac

PC Windows không build hay chạy được Swift/FluidAudio. Cho tới khi xong, lõi Tauri trả `null` cho `model_status` trên macOS (xem `MODEL_CONTROL` trong `src-tauri/src/commands.rs`) và giao diện giữ luồng cũ (model tải khi họp đầu tiên). **Không bật cờ trước khi hai chế độ dưới đây chạy**: một sidecar không biết cờ lạ sẽ chạy như một cuộc họp và tự tải model ngầm.

## AC phải đạt

| #   | AC (EARS)                                                                                                                                                                                                                                     | Test                                           |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| AC1 | WHEN chạy `cuelingo-audio --model-status` THE SYSTEM SHALL in đúng một dòng `{"type":"models","models":[{"language":"en","state":"ready"\|"missing","sizeBytes":N}]}` rồi thoát mã 0, không tải gì                                            | `swift test` (hàm dựng dòng) + chạy tay        |
| AC2 | THE SYSTEM SHALL chỉ liệt kê ngôn ngữ chạy trên máy **và không chạy đám mây** (`SpeechModels.languages` trừ `cloudLanguages`, nên chỉ `en`; `ja` có model nhưng thuộc đám mây thì không có dòng)                                              | `swift test`                                   |
| AC3 | WHEN model có sẵn (`Transcriber.isCached(language:)`) THE SYSTEM SHALL báo `ready`; ngược lại `missing`                                                                                                                                       | `swift test` + chạy tay với thư mục cache sạch |
| AC4 | WHEN chạy `CUELINGO_LANGUAGE=en cuelingo-audio --download-model` THE SYSTEM SHALL in các dòng `{"type":"model","language":"en","state":"downloading","progress":0..1}` (tăng ≥ 5 điểm mỗi dòng), rồi `ready` và thoát mã 0                    | chạy tay                                       |
| AC5 | IF model đã có THEN `--download-model` SHALL in `ready` ngay, không gọi mạng                                                                                                                                                                  | chạy tay                                       |
| AC6 | IF tải thất bại, hoặc ngôn ngữ chạy đám mây, hoặc không hỗ trợ THEN THE SYSTEM SHALL in `{"type":"model","language":…,"state":"error","message":…}` và thoát mã 1 (đám mây: "this language runs in the cloud: there is no model to download") | `swift test` + chạy tay (tắt mạng)             |
| AC7 | THE SYSTEM SHALL không in đường dẫn của người dùng hay nội dung họp ở bất kỳ dòng nào, và không chạy thu âm hay vòng lặp stdin ở hai chế độ này                                                                                               | review                                         |

## Đọc trước

- `AGENTS.md` (gốc) và `apps/desktop/AGENTS.md`
- Bản Windows làm mẫu: `native/windows-audio/src/modelctl.rs` và `tests/models.rs`, cùng dạng dòng ở `apps/docs/docs/04-modules/01-desktop/local-stt.md` (mục "Quản lý model không cần họp")
- Scaffold: `apps/docs/docs/05-engineering/scaffold/07-native-swift.md`
- Chỗ gắn: các chế độ một lần ở `Sources/Sidecar/main.swift` (`--permissions` dòng ~200, `--check-system-audio` dòng ~233), `Transcriber.isCached` và `Transcriber.load` ở `Sources/LocalSTT/Transcriber.swift`, `SpeechModels.swift`

## Phạm vi file

| Được sửa / tạo                                                                                                                                                                                                 | Không được sửa                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `native/macos-audio/Sources/Sidecar/main.swift`, `Sources/LocalSTT/*.swift` (một hàm dựng dòng trạng thái và một hàm tải), `Tests/LocalSTTTests/*`, `src-tauri/src/commands.rs` (**chỉ** hằng `MODEL_CONTROL`) | giao thức hiện có (`segment`, `utterance`, `level`…), `native/windows-audio/**`, `apps/desktop/src/**` |

## Các bước

1. Hàm thuần dựng dòng `models` từ danh sách `(language, isCached, sizeBytes)`, và test nó (AC1 đến AC3, kể cả `ja` bị loại).
2. `--model-status` ở `main.swift`: gọi `Transcriber.isCached` cho từng ngôn ngữ chạy trên máy, in một dòng, thoát. `sizeBytes` là dung lượng model (cỡ ~0,6 GB cho Parakeet v2; lấy từ FluidAudio nếu có, nếu không ghi hằng số kèm nguồn). Không được tải gì.
3. `--download-model`: **ưu tiên API chỉ-tải của FluidAudio** (không nạp CoreML); nếu không có thì dùng `AsrModels.downloadAndLoad(version:progressHandler:)` rồi bỏ kết quả. Báo tiến trình qua `ProgressGate` tương đương (không nhiều hơn một dòng mỗi 5 điểm). Model đã có thì in `ready` ngay.
4. Sau khi cả hai chạy thật: đổi `MODEL_CONTROL` thành `true` cho macOS (`cfg!(any(windows, target_os = "macos"))`), chạy `cargo test` ở `src-tauri`.
5. Cập nhật `local-stt.md` (mục macOS) nếu khác bản Windows.

## Definition of Done

- [ ] AC trên có test và xanh (`swift test`)
- [ ] `pnpm verify` xanh; `cargo test` và `cargo clippy -- -D warnings` ở `src-tauri` xanh
- [ ] Đã chạy thật trên Mac: `--model-status` với cache có và không có model, `--download-model` tải thật (kèm progress), tắt mạng cho đường lỗi
- [ ] Onboarding trên app macOS: bước Mô hình hiện nút tải khi thiếu, bật Tiếp tục khi sẵn sàng
- [ ] Không commit, không push (lead tích hợp)

## Ngoài phạm vi · Dừng và hỏi khi

- Ngoài phạm vi: model tiếng Nhật on-device (thuộc đám mây), xoá model, tải tiếp từ chỗ đứt, thay đổi giao diện.
- Dừng và ghi câu hỏi nếu: FluidAudio không cho tải mà không nạp model và việc nạp quá nặng · phải đổi dạng dòng `models` hay `model` · cần sửa file ngoài danh sách.

## Kết quả _(implementer điền)_

- File đã đổi:
- Test đã thêm:
- `pnpm verify`:
- Đã chạy thật:
- Khác brief (và lý do):
- Câu hỏi còn mở:
