# Local STT

> Phần: [Desktop app](./README.md) · Code: `apps/desktop/native/macos-audio/Sources/LocalSTT/` (macOS), `apps/desktop/native/windows-audio/src/stt/` (Windows)

Nhận dạng giọng nói tiếng Anh ngay trên máy bằng Parakeet-TDT 0.6B v3 (CoreML/Neural Engine), phát partial và final.

## Trách nhiệm

- Chạy Parakeet-TDT 0.6B v3 qua FluidAudio trên Apple Neural Engine
- Streaming theo chunk, phát `partial` (chưa ổn định) và `final` (đã chốt) cho từng luồng
- Timestamp mức từ để overlay gạch chân từ khó và debrief nhảy tới đoạn
- Tải model lần đầu, kiểm tra checksum, báo tiến độ
- Chuyển sang cloud STT khi máy không đủ tài nguyên hoặc ngôn ngữ không hỗ trợ

## Phạm vi MVP

- F2; theo ADR-0003 (STT on-device mặc định)

## Interface

- `feed(stream, pcm, tsMs)`
- Sự kiện `transcript.partial` / `transcript.final` {stream, text, words[{w, startMs, endMs, conf}]}
- Micro: dòng stdin `mic off` đóng luồng micro (gửi nhận dạng câu dở rồi vẫn nghe tiếp, không kết thúc pipeline), `mic on` mở lại; sidecar trả `{"type":"mic","muted":bool}` sau khi trạng thái thật sự đổi. Mở lại lỗi thì in `status` lỗi `microphone: …` và không báo `muted:false`.
- **Thu âm trước, nạp model sau.** Sidecar mở thu âm ngay (mức âm và tách câu chạy từ mẫu đầu tiên) rồi nạp model song song. Câu đã chốt trước khi model sẵn sàng nằm trong `UtteranceBacklog`: tối đa 60 s mẫu mỗi luồng, chỉ trong RAM (không ghi đĩa), bỏ câu cũ nhất khi tràn; `partial` bị bỏ. Khi model sẵn sàng, các câu được nhận dạng lần lượt theo thứ tự rồi chuyển sang chế độ thường. `status ready` nghĩa là đã thu âm, không phải đã nạp model; model có dòng `model` riêng.
- **Chuẩn bị model:** `--model-status` (đã có trên máy chưa, không tải), `--prewarm` (tải kèm tiến độ, kiểm checksum, biên dịch CoreML rồi thoát). Đo: binary mới biên dịch lại khoảng 40 s (bộ đệm gắn với từng bản build), lần sau cùng binary khoảng 4 s. Onboarding và Cài đặt dùng hai cờ này (bước "Mô hình nhận dạng"); tiếng Việt (đám mây) không cần.
- Thuật ngữ cá nhân: biến `CUELINGO_VOCAB` lúc khởi động hoặc dòng stdin `vocab ["SLA",...]` (thay hẳn danh sách). `VocabularyCorrector` sửa kết quả sau khi model chạy, cả partial lẫn final

## Phụ thuộc

- [FluidAudio](https://github.com/FluidInference/FluidAudio) (Apache-2.0)
- [Parakeet-TDT 0.6B v3](https://huggingface.co/nvidia/parakeet-tdt-0.6b-v3) (CC-BY-4.0, cần ghi công)

## Dữ liệu & sự kiện

- Benchmark: AMI WER 7,95%, ~3 giây xử lý / phút audio trên M1 Pro (apps/docs/docs/07-research/benchmark-stt-mt.md)

## Giới hạn của bộ sửa thuật ngữ

- Chỉ xử lý **từ đơn từ 3 ký tự trở lên**; cụm nhiều từ bị bỏ qua (muốn hỗ trợ phải sửa `VocabularyCorrector`).
- Luật acronym và khoảng cách sửa viết cho tiếng Anh. Desktop hiện chỉ gửi thuật ngữ cho cuộc họp tiếng Anh; ngôn ngữ khác nhận danh sách rỗng cho tới khi có eval riêng.

## Bản Windows (Parakeet qua sherpa-onnx)

Code: `native/windows-audio/src/stt/` (`mod.rs` Transcriber, `models.rs` tải và kiểm model, `sherpa.rs` thư viện). Cùng giao thức với bản Swift; tách câu, mức âm, `UtterancePCM`, sửa thuật ngữ, thống kê p50/p95 là **bản port 1-1** và chạy chung vector `native/fixtures/*.json` với `swift test` ([audio-capture](./audio-capture.md)).

| Thành phần | Chọn                                                                                                                                                                                                                 | Giấy phép                                                                                     |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Thư viện   | [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) 2.0.1 (crate `sherpa-onnx`), **link tĩnh cùng ONNX Runtime của nó**, nên không bao giờ nạp `onnxruntime.dll` từ máy (bản cũ trong System32 không chen vào được) | sherpa-onnx Apache-2.0; ONNX Runtime MIT. Cho phép phân phối thương mại                       |
| Model      | [Parakeet TDT 0.6B v2 int8 ONNX](https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v2-int8) (gốc: `nvidia/parakeet-tdt-0.6b-v2`), revision `84b478d541cdbf0c296a7ab5f1e20a6f8f998114`, 661 MB     | CC-BY-4.0: cho phép dùng thương mại, bắt buộc ghi công NVIDIA (trang "Giới thiệu", như macOS) |

- **Tải model lần đầu:** vào `%LOCALAPPDATA%\vn.cmcai.cuelingo\models\parakeet-tdt-0.6b-v2-int8-84b478d541cd\` (biến `CUELINGO_MODELS_DIR` đổi chỗ). Mỗi tệp ghim kích thước và SHA-256 trong `models.rs`; tải về `<tên>.part`, kiểm kích thước + SHA-256 rồi mới đổi tên. Sai hoặc hỏng thì xoá và tải lại (tối đa 3 lần, đợi 2 s, 4 s); không bao giờ nạp tệp chưa qua kiểm. Tệp đã kiểm có tệp đánh dấu `<tên>.ok` (hash + kích thước + giờ sửa): đổi bất cứ thứ gì thì băm lại, không thì lần mở sau khỏi băm 661 MB. Đây là chủ ý: khi kích thước và giờ sửa còn khớp thì tin tệp, **không băm lại**, nên ai sửa được tệp và giữ nguyên hai thông số đó thì qua mặt được (kẻ đó cũng ghi đè được chính file `.exe`, nên không thêm rủi ro đáng kể). Tải về còn bị khoá thời gian: không nhận byte nào trong 30 s thì bỏ lần thử đó và chạy lại (tối đa 3 lần); chờ phản hồi tối đa 60 s. Sự kiện `model` `downloading` có `progress` 0..1 theo số byte, gửi mỗi khi tăng ≥ 5 điểm; xong thì `ready`; lỗi thì `error` kèm thông báo (không có nội dung họp). TLS dùng của Windows (SChannel); proxy đọc từ `HTTPS_PROXY`.
- **Quản lý model không cần họp** (`src/modelctl.rs`): hai chế độ một lần, không nạp ONNX nên chạy nhanh và dùng được cả khi build không có `stt`. `--model-status` in một dòng `{"type":"models","models":[{"language":"en","state":"ready"|"missing","sizeBytes":661288526}]}` cho mỗi ngôn ngữ chạy trên máy (đủ tệp, đúng kích thước và SHA-256, hoặc tệp `.ok` còn khớp thì `ready`; tệp dở `.part` hay sai kích thước là `missing`; không tải gì). `--download-model` (ngôn ngữ lấy từ `CUELINGO_LANGUAGE`) in các sự kiện `model` như khi họp (`downloading` kèm `progress`, rồi `ready`); model đã có thì trả `ready` ngay mà không gọi mạng; lỗi thì `error` kèm lý do và thoát mã 1; ngôn ngữ chạy đám mây trả `error` vì không có model. Không dòng nào chứa đường dẫn hay nội dung họp. Mẫu cho bản Swift: `04-brief-macos-model.md` của hồ sơ onboarding-model-download.
- **Chỉ tiếng Anh on-device** (`LANGUAGES = ["en"]`); `vi`, `ja`, `ko`, `zh` đi đường đám mây như macOS (chế độ `utterance` ở trên). Không có model tiếng Nhật on-device, không dò ngôn ngữ đầu họp (`CUELINGO_DETECT` bị bỏ qua, không bao giờ có `language-suggestion`).
- **Hàng đợi nhận dạng:** mỗi luồng một luồng nhận dạng làm việc theo thứ tự. Partial đến khi đang có một partial chờ hoặc chạy thì **bị bỏ** (như `busy` của Swift); final **không bao giờ bị bỏ**, và partial không bao giờ đến sau final của cùng câu. Cả hai luồng dùng chung một recognizer, nên nhận dạng nối đuôi nhau. Hết phiên: đợi hàng đợi chạy hết rồi mới in `stats` và `stopped`.
- **Đổi model khi đang chạy** (`language …`): model cũ vẫn nhận dạng cho đến khi model mới sẵn sàng; đổi sang ngôn ngữ đám mây không nạp gì.
- **Thread:** `min(số nhân, 4)`, đổi bằng `CUELINGO_STT_THREADS` để đo. Chỉ chạy CPU (không DirectML ở bản đầu).
- **Chạy tay / test:** `cuelingo-audio --file a.wav [--file b.wav …]` (WAV 16-bit PCM bất kỳ rate; model nạp một lần). Thêm `--realtime` để nạp âm thanh đúng tốc độ thu (partial ra đúng nhịp như trong họp, tranh CPU với final). Thêm `--bench` để in thêm một dòng `{"type":"bench",...}` (số liệu cho spike S2: p50/p95 từng câu và từng partial, bộ nhớ đỉnh, thời gian tải/băm/nạp). Dòng `bench` chỉ ra khi có `--file --bench`, app không bao giờ gửi cờ đó nên không có trong luồng sự kiện của app.
- **Đo S2 trên CI:** `node scripts/stt-bench.mjs` (bước "Measure speech recognition" của job `desktop-windows` trong `ci.yml`) chạy `--file --bench` trên một file người thật (ghim SHA-256) và 8 câu giọng tổng hợp của Windows (David, tạo lúc chạy, không commit), ba lần: mặc định, 2 thread (giả lập máy yếu) và đúng tốc độ thu; in p50/p95, bộ nhớ, thời gian nạp và WER (không in chữ nhận được) vào log và summary của job. Tiêu chí: p95 ≤ 1,0 s cho câu ≤ 8 s, bộ nhớ ≤ 1,5 GB.

Số đo S2: xem [ADR 0020](../../08-adr/0020-windows-capture-stt.md#kết-quả-spike-s2).

Giới hạn còn lại của bản Windows: tải model không tiếp tục được giữa chừng (lỗi giữa chừng tải lại tệp đó từ đầu); proxy chỉ đọc từ biến môi trường, không đọc cấu hình proxy của Windows; chưa kiểm trên máy Windows thật (đợt B).

## Ngôn ngữ nhận dạng bằng đám mây

Với ngôn ngữ trong `SpeechModels.cloudLanguages` (hiện `vi`, khớp `recognition: 'cloud'` ở `@cuelingo/shared`) sidecar **không tải model**. Nó vẫn thu cả hai luồng (`system`, `mic`) và tách câu bằng VAD (câu tối đa 25 giây, bỏ câu có tiếng nói dưới 0,3 giây), nhưng mỗi câu xong được phát thành một dòng `{"type":"utterance","segmentId","stream","startMs","endMs","sampleRate":16000,"pcm":"<base64 PCM 16-bit LE>"}` thay vì văn bản; không có partial. Đổi qua lại giữa ngôn ngữ đám mây và ngôn ngữ trên máy bằng lệnh stdin `language <mã>` như thường.

## Dự phòng ngoại tuyến cho tiếng Việt ([ADR 0024](../../08-adr/0024-vi-offline-stt-fallback.md))

Đám mây vẫn là đường chính của tiếng Việt. Khi người dùng bật dự phòng (Cài đặt › Mô hình nhận dạng, tắt sẵn) và đám mây không dùng được, app nhận dạng câu **trên máy**; sidecar không đổi, vẫn chỉ phát `utterance`.

| Thành phần | Chọn                                                                                                                                                                                                           |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chạy ở đâu | Lõi Rust của app (`src-tauri/src/local_stt.rs`), dùng chung macOS và Windows; sherpa-onnx link tĩnh, 2 luồng CPU, mỗi câu một stream riêng                                                                     |
| Model      | Zipformer tiếng Việt `zzasdf/viet_iter3_pseudo_label` (Apache-2.0), INT8, revision ghim `e827965a37aa…`, 4 tệp, 77 100 477 byte; tải từ `huggingface.co` khi người dùng bật, kiểm kích thước + SHA-256         |
| Đầu ra     | Model xuất chữ HOA không dấu câu; `normalize` đổi sang chữ thường, viết hoa đầu câu, không thêm dấu câu hay sửa chữ                                                                                            |
| Số đo      | 30 câu giọng tổng hợp, M1 Pro, bản release: RTF 0,021, p95 mỗi câu 0,098 s, RAM ~370 MB. WER 19,0% trên câu xen thuật ngữ tiếng Anh ([kết quả đo](../../06-delivery/2026-11-20-vi-on-device-stt/03-review.md)) |

Luồng chọn đường nằm ở webview, xem [session-controller](./session-controller.md#dự-phòng-ngoại-tuyến-tiếng-việt).

## Mức âm thanh và khoảng nghỉ

- Mọi ngôn ngữ và chế độ: mỗi luồng (`system`, `mic`) phát dòng `{"type":"level","stream","rms","peak"}` tối đa 10 lần/giây, tính từ phần âm thanh nghe được kể từ lần báo trước (không mất đỉnh của một tiếng ngắn). Luồng không mở được thì không phát gì.
- Ngôn ngữ nhận dạng đám mây dùng khoảng nghỉ tối thiểu 700 ms để kết thúc một câu (mặc định trên máy là 600 ms), để hơi thở giữa câu không cắt câu làm đôi.

Danh sách ngôn ngữ đám mây của sidecar (`SpeechModels.cloudLanguages`) là `vi`, `ja`, `ko`, `zh`, khớp `recognition: 'cloud'` ở registry; ngôn ngữ đám mây luôn thắng. Model tiếng Nhật trên máy vẫn nằm trong sidecar để đánh giá sau. Dò ngôn ngữ ở đầu cuộc họp chỉ dùng model trên máy đã tải sẵn; nếu gợi ý `ja` được chấp nhận thì đi đường đám mây (cần đồng ý).

## Câu hỏi mở

- Chưa đo độ trễ streaming thật và RAM khi chạy cùng app họp
- Diarization realtime cho audio hệ thống: để giai đoạn sau hay dùng FluidAudio?
