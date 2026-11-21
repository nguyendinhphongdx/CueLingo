# Plan — vi-offline-stt-fallback

## 1. Bối cảnh code

- **Đường họp tiếng Việt hôm nay:** sidecar (Swift/Rust) tách câu bằng VAD và phát `utterance` (PCM base64) → `session-controller.ts` (`handleUtterance`, `recognise`) gửi `sessions.transcribe` lên API → `publish` caption và `segment.final` qua realtime. Lỗi hôm nay: thử lại một lần rồi hiện `[không nhận dạng được]`; hết hạn mức thì `stopCloudUploads()` và dừng hẳn.
- **Đường tiếng Anh trên máy:** nằm **trong sidecar**, không đi qua webview (`Transcriber.swift` bằng FluidAudio; `native/windows-audio/src/stt/` bằng sherpa-onnx). Bản Windows đã có tải model + kiểm SHA-256 (`models.rs`) và link tĩnh sherpa-onnx.
- Convention: [native-desktop](../../05-engineering/conventions/native-desktop.md), điểm mở rộng "Desktop module". Cần **ADR mới** (nguồn mạng mới là model, và STT chạy ngoài sidecar nếu chọn B).
- Model: chỉ bản Zipformer **2025-04 (Apache-2.0, 60 MB)** dùng được; bản 30M bị loại vì giấy phép ([01-specs.md](./01-specs.md)).

## 2. Phương án

| #   | Phương án                                                                                                                                                                                               | Ưu                                                                                                    | Nhược                                                                                                                                                        |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A   | **Trong từng sidecar**: sidecar nhận lệnh stdin `offline on/off`; khi bật, nhận dạng `utterance` vi bằng sherpa-onnx rồi phát `final` như tiếng Anh. Windows dùng crate có sẵn; macOS thêm sherpa-onnx. | Đúng mô hình hiện tại (STT ở sidecar); không đưa PCM qua webview; giữ ranh giới native ↔ webview.     | Làm **hai lần** (Swift + Rust). macOS phải đưa sherpa-onnx vào gói Swift (xcframework hoặc cầu C) — việc lớn, chưa thử.                                      |
| B   | **Một lần trong lõi Rust của app (`src-tauri`)**: command `transcribe_local(pcm)` chạy sherpa-onnx; controller gọi khi đang ở chế độ ngoại tuyến. Hai nền tảng dùng chung. Sidecar không đổi.           | Một bản cài đặt cho cả macOS và Windows; sidecar giữ nguyên (chỉ phát `utterance` như cũ); ít rủi ro. | STT thành công ra ngoài sidecar (đi ngược mẫu ADR 0013/0020), cần ADR. PCM đã ở webview nên thêm một lần qua cầu IPC (~vài trăm KB mỗi câu, chấp nhận được). |
| C   | WASM sherpa-onnx trong webview                                                                                                                                                                          | Không đụng Rust                                                                                       | Nặng RAM trong webview, chậm, khó kiểm soát tải model. Loại.                                                                                                 |

**Chọn B.** Cùng một mã Rust cho cả hai nền tảng, không phải kéo sherpa-onnx vào Swift, và controller đã giữ sẵn luồng `utterance`. Cái giá là ADR ghi lại ngoại lệ "STT dự phòng chạy trong lõi app".

## 3. Tác động

| Tác động                      | Có?    | Chi tiết                                                                                                                            |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| DB migration                  | Không  | `source: local` chỉ nằm ở segment cục bộ ở bước đầu (xem rủi ro).                                                                   |
| Contract (`@cuelingo/shared`) | Có nhỏ | Thêm cờ `source` (`cloud`\|`local`) cho segment nếu server nhận; **chờ quyết**, mặc định không gửi lên server (AC7 chỉ ở phía app). |
| Event / Learner Model         | Không  | Họp tiếng Việt vẫn không cập nhật Learner Model.                                                                                    |
| AI gateway / prompt           | Không  | Không gọi AI.                                                                                                                       |
| Quyền riêng tư                | Có     | Chế độ ngoại tuyến **không gửi audio**. Nguồn mạng mới: tải model (ADR). Không log nội dung (AC9).                                  |
| Native                        | Có     | `src-tauri`: thêm crate `sherpa-onnx`, module `local_stt` (nạp model, nhận dạng, tải + kiểm SHA-256).                               |
| UI (desktop)                  | Có     | Cài đặt: công tắc bật dự phòng + tiến độ tải; overlay: nhãn "ngoại tuyến". Dùng `@cuelingo/ui` (luật 11).                           |
| Docs                          | Có     | `local-stt.md`, `session-controller.md`, `settings.md`, `overlay.md`, `tauri-core.md`, ADR mới, `AGENTS.md` nếu đổi quy ước.        |

## 4. Các bước (mỗi bước ≈ 1 commit)

| #   | Bước                                                                                                                                                                                           | Kiểm                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| 1   | ADR: nhận dạng tiếng Việt ngoại tuyến + nguồn tải model + giấy phép. Kiểm điều khoản file ONNX đã chuyển và dữ liệu huấn luyện. **Dừng nếu giấy phép không cho phân phối.**                    | Người duyệt ADR                         |
| 2   | `src-tauri` `local_stt`: tải model (`.part` → kiểm kích thước + SHA-256 → đổi tên), nạp Zipformer, command `local_stt_status/download/transcribe`; hàm chuẩn hoá chữ HOA (AC6). Test Rust.     | `cargo test`, AC4–AC6                   |
| 3   | `native.ts` + hợp đồng command; `session-controller.ts`: bộ chọn chế độ (cloud ⇄ local) theo số lỗi liên tiếp, quay lại cloud khi một lần gọi thành công; câu cloud đang bay không bị mất/lặp. | `session-controller.test.ts` (AC1, AC3) |
| 4   | UI: công tắc + tải model trong Cài đặt, nhãn "ngoại tuyến" trên overlay, thông báo chưa có model (AC2, AC5). Component chung ở `@cuelingo/ui`.                                                 | Test component, chạy thật               |
| 5   | Đo thật: `--bench`-kiểu cho `transcribe_local` (RTF, p95, RAM; AC8) trên macOS; thử họp tiếng Việt thật rút mạng giữa chừng. Windows thử khi có máy.                                           | Số đo ghi vào `03-review.md`            |
| 6   | Cập nhật docs module; `pnpm verify`, `pnpm docs:build`.                                                                                                                                        | Xanh                                    |

## 5. Rủi ro và điều chưa biết

- **Giấy phép:** bản 2025-04 là Apache-2.0 theo trang gốc, nhưng dữ liệu huấn luyện và file ONNX do bên thứ ba (k2-fsa) chuyển chưa kiểm. Bước 1 chặn các bước sau.
- **Chất lượng thấp:** WER 19,0% trên câu xen thuật ngữ tiếng Anh (giọng tổng hợp), kém bản 30M. Nhãn "ngoại tuyến" bắt buộc để người dùng không tin như bản cloud.
- **Link sherpa-onnx trong app chính:** chưa thử build macOS; kích thước binary tăng (ONNX Runtime tĩnh). Cần thử ở bước 2, trước khi làm UI.
- **Mất mạng nhưng vẫn lưu transcript:** ngoài phạm vi; segment cục bộ không lên server khi realtime đứt (hành vi hiện có), việc đệm để hồ sơ riêng.
- **Ngưỡng chuyển** chưa chốt (đã làm: 2 câu lỗi liên tiếp thì chuyển, thử lại đám mây mỗi 15 giây, quay lại khi một câu thành công; bỏ ngưỡng 8 giây vì lỗi mạng trả về nhanh). Cho người dùng chỉnh sau.
- Nguồn tải model chưa chốt (GitHub releases của k2-fsa hay Hugging Face); ghim URL + SHA-256 ở bước 1.
