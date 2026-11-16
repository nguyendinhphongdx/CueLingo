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

- **Tải model lần đầu:** vào `%LOCALAPPDATA%\vn.cmcai.cuelingo\models\parakeet-tdt-0.6b-v2-int8-84b478d541cd\` (biến `CUELINGO_MODELS_DIR` đổi chỗ). Mỗi tệp ghim kích thước và SHA-256 trong `models.rs`; tải về `<tên>.part`, kiểm kích thước + SHA-256 rồi mới đổi tên. Sai hoặc hỏng thì xoá và tải lại (tối đa 3 lần, đợi 2 s, 4 s); không bao giờ nạp tệp chưa qua kiểm. Tệp đã kiểm có tệp đánh dấu `<tên>.ok` (hash + kích thước + giờ sửa): đổi bất cứ thứ gì thì băm lại, không thì lần mở sau khỏi băm 661 MB. Sự kiện `model` `downloading` có `progress` 0..1 theo số byte, gửi mỗi khi tăng ≥ 5 điểm; xong thì `ready`; lỗi thì `error` kèm thông báo (không có nội dung họp). TLS dùng của Windows (SChannel); proxy đọc từ `HTTPS_PROXY`.
- **Chỉ tiếng Anh on-device** (`LANGUAGES = ["en"]`); `vi`, `ja`, `ko`, `zh` đi đường đám mây như macOS (chế độ `utterance` ở trên). Không có model tiếng Nhật on-device, không dò ngôn ngữ đầu họp (`CUELINGO_DETECT` bị bỏ qua, không bao giờ có `language-suggestion`).
- **Hàng đợi nhận dạng:** mỗi luồng một luồng nhận dạng làm việc theo thứ tự. Partial đến khi đang có một partial chờ hoặc chạy thì **bị bỏ** (như `busy` của Swift); final **không bao giờ bị bỏ**, và partial không bao giờ đến sau final của cùng câu. Cả hai luồng dùng chung một recognizer, nên nhận dạng nối đuôi nhau. Hết phiên: đợi hàng đợi chạy hết rồi mới in `stats` và `stopped`.
- **Đổi model khi đang chạy** (`language …`): model cũ vẫn nhận dạng cho đến khi model mới sẵn sàng; đổi sang ngôn ngữ đám mây không nạp gì.
- **Thread:** `min(số nhân, 4)`, đổi bằng `CUELINGO_STT_THREADS` để đo. Chỉ chạy CPU (không DirectML ở bản đầu).
- **Chạy tay / test:** `cuelingo-audio --file a.wav [--file b.wav …]` (WAV 16-bit PCM bất kỳ rate; model nạp một lần). Thêm `--realtime` để nạp âm thanh đúng tốc độ thu (partial ra đúng nhịp như trong họp, tranh CPU với final). Thêm `--bench` để in thêm một dòng `{"type":"bench",...}` (số liệu cho spike S2: p50/p95 từng câu và từng partial, bộ nhớ đỉnh, thời gian tải/băm/nạp). Dòng `bench` chỉ ra khi có `--file --bench`, app không bao giờ gửi cờ đó nên không có trong luồng sự kiện của app.
- **Đo S2 trên CI:** `node scripts/stt-bench.mjs` (bước "Measure speech recognition" của `desktop-windows.yml`) chạy `--file --bench` trên một file người thật (ghim SHA-256) và 8 câu giọng tổng hợp của Windows (David, tạo lúc chạy, không commit), ba lần: mặc định, 2 thread (giả lập máy yếu) và đúng tốc độ thu; in p50/p95, bộ nhớ, thời gian nạp và WER (không in chữ nhận được) vào log và summary của job. Tiêu chí: p95 ≤ 1,0 s cho câu ≤ 8 s, bộ nhớ ≤ 1,5 GB.

Số đo S2: xem [ADR 0020](../../08-adr/0020-windows-capture-stt.md#kết-quả-spike-s2).

Giới hạn còn lại của bản Windows: tải model không tiếp tục được giữa chừng (lỗi giữa chừng tải lại tệp đó từ đầu); proxy chỉ đọc từ biến môi trường, không đọc cấu hình proxy của Windows; chưa kiểm trên máy Windows thật (đợt B).

## Ngôn ngữ nhận dạng bằng đám mây

Với ngôn ngữ trong `SpeechModels.cloudLanguages` (hiện `vi`, khớp `recognition: 'cloud'` ở `@cuelingo/shared`) sidecar **không tải model**. Nó vẫn thu cả hai luồng (`system`, `mic`) và tách câu bằng VAD (câu tối đa 25 giây, bỏ câu có tiếng nói dưới 0,3 giây), nhưng mỗi câu xong được phát thành một dòng `{"type":"utterance","segmentId","stream","startMs","endMs","sampleRate":16000,"pcm":"<base64 PCM 16-bit LE>"}` thay vì văn bản; không có partial. Đổi qua lại giữa ngôn ngữ đám mây và ngôn ngữ trên máy bằng lệnh stdin `language <mã>` như thường.

## Mức âm thanh và khoảng nghỉ

- Mọi ngôn ngữ và chế độ: mỗi luồng (`system`, `mic`) phát dòng `{"type":"level","stream","rms","peak"}` tối đa 10 lần/giây, tính từ phần âm thanh nghe được kể từ lần báo trước (không mất đỉnh của một tiếng ngắn). Luồng không mở được thì không phát gì.
- Ngôn ngữ nhận dạng đám mây dùng khoảng nghỉ tối thiểu 700 ms để kết thúc một câu (mặc định trên máy là 600 ms), để hơi thở giữa câu không cắt câu làm đôi.

Danh sách ngôn ngữ đám mây của sidecar (`SpeechModels.cloudLanguages`) là `vi`, `ja`, `ko`, `zh`, khớp `recognition: 'cloud'` ở registry; ngôn ngữ đám mây luôn thắng. Model tiếng Nhật trên máy vẫn nằm trong sidecar để đánh giá sau. Dò ngôn ngữ ở đầu cuộc họp chỉ dùng model trên máy đã tải sẵn; nếu gợi ý `ja` được chấp nhận thì đi đường đám mây (cần đồng ý).

## Câu hỏi mở

- Chưa đo độ trễ streaming thật và RAM khi chạy cùng app họp
- Diarization realtime cho audio hệ thống: để giai đoạn sau hay dùng FluidAudio?
