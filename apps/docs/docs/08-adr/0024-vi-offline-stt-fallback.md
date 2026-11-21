# 0024 · Nhận dạng tiếng Việt ngoại tuyến làm dự phòng

**Trạng thái:** Accepted · 2026-11-21 (chủ sản phẩm đồng ý trong phiên làm việc). Sửa cùng ngày sau review: bốn tệp thay vì năm; làm rõ việc dò đám mây ở mục Riêng tư. Bổ sung [ADR 0014](./0014-cloud-stt-for-vietnamese.md), không thay nó: đám mây vẫn là đường chính.

## Bối cảnh

Họp tiếng Việt chỉ nhận dạng được qua đám mây ([ADR 0014](./0014-cloud-stt-for-vietnamese.md)). Mất mạng hoặc hết hạn mức thì caption dừng. Số đo ở hồ sơ `06-delivery/2026-11-20-vi-on-device-stt` cho thấy Zipformer tiếng Việt chạy trên CPU đủ nhanh (RTF ~0,01, RAM ~520 MB) nhưng kém Gemini về thuật ngữ tiếng Anh (WER 19,0% trên câu họp xen tiếng Anh, giọng tổng hợp). Hồ sơ `06-delivery/2026-11-21-vi-offline-stt-fallback` có spec và plan.

## Quyết định

- **Dự phòng, không thay thế.** Chỉ khi người dùng bật trong Cài đặt (mặc định tắt), và khi đám mây lỗi liên tiếp, app nhận dạng câu trên máy. Khi một câu đám mây lại thành công, quay về đám mây. Overlay luôn hiện nhãn "ngoại tuyến, chất lượng có thể thấp hơn, câu nhận dạng trên máy không gửi âm thanh đi".
- **Model:** Zipformer tiếng Việt `zzasdf/viet_iter3_pseudo_label` (huấn luyện ~70 nghìn giờ), **Apache-2.0** theo trang gốc. Dùng chính các tệp ONNX INT8 mà tác giả công bố, ghim revision `e827965a37aab92a4455566fac49c0e80a23afef`:

  | Tệp                                    | Kích thước | SHA-256                                                            |
  | -------------------------------------- | ---------- | ------------------------------------------------------------------ |
  | `exp/encoder-epoch-12-avg-8.int8.onnx` | 70 876 129 | `b3abdef7a660fea7faf5e076b3c7613b0fc98406707103784d018189bb522124` |
  | `exp/decoder-epoch-12-avg-8.onnx`      | 5 165 084  | `d1d27cca84c824a8acf5ce6edf0f2c0880cfe295d2e69b95134de1707e1d9998` |
  | `exp/joiner-epoch-12-avg-8.int8.onnx`  | 1 033 417  | `38ec49e1c18e4feb0cad4de13e25c83a866cf56f4a66f22e8ff579d591a69a46` |
  | `data/Vietnam_bpe_2000_new/tokens.txt` | 25 847     | `f536d03c2e95ebd2930cf0abec88e823bd17d3c1933da7ae6a82db3b80605e15` |

  Bốn tệp, tổng 77 100 477 byte (khoảng 77 MB). `bpe.model` không cần khi giải mã. Các tệp này trùng từng byte với bản đã đo.

- **Bị loại:** bản 30M `hynt/Zipformer-30M-RNNT-6000h` (đo tốt hơn nhưng giấy phép **CC-BY-NC-ND-4.0**: phi thương mại, cấm bản phái sinh, nên không phát hành được).
- **Nơi chạy:** một mã Rust trong lõi app (`src-tauri`, crate `sherpa-onnx`, link tĩnh như bản Windows của [ADR 0020](./0020-windows-capture-stt.md)), dùng chung macOS và Windows. Sidecar không đổi: vẫn tách câu và phát `utterance`. Đây là ngoại lệ có chủ ý với mẫu "STT nằm trong sidecar" của ADR 0013/0020, vì dự phòng cần đúng một bản cài đặt cho hai nền tảng và không kéo sherpa-onnx vào Swift.
- **Nguồn mạng mới:** `huggingface.co`, chỉ để tải bốn tệp trên, **chỉ khi người dùng bật dự phòng**, không bao giờ trong lúc họp. Tải về `<tên>.part`, kiểm kích thước + SHA-256, rồi mới đổi tên; tệp sai thì xoá. Không gửi gì lên Hugging Face ngoài yêu cầu tải (không audio, không định danh người dùng).
- **Riêng tư:** câu nhận dạng trên máy không gửi âm thanh đi và không được lưu; không log nội dung câu (chỉ độ dài, thời gian, trạng thái). **Ngoại lệ có chủ ý:** khi đang ở ngoại tuyến vì mạng, CueLingo cứ 15 giây gửi _một_ câu lên đám mây (một lần thử, tối đa 8 giây, một lần một câu) để biết nó đã về chưa, và việc gửi này nằm trong đồng ý của ADR 0014. Khi hết giờ nhận dạng đám mây thì không dò nữa. Lời báo cho người dùng nói đúng như vậy, không hứa "không rời máy" chung chung.
- **Đầu ra:** model xuất chữ HOA, không dấu câu, số viết thành chữ. App chỉ đổi sang chữ thường và viết hoa đầu câu; không bịa dấu câu, không đổi chữ.

## Hệ quả

- App tăng kích thước binary (ONNX Runtime tĩnh) và dùng thêm ~520 MB RAM khi chế độ ngoại tuyến chạy; số đo thật trong app ghi ở `03-review.md` của hồ sơ.
- Chất lượng thấp hơn đám mây, đặc biệt thuật ngữ tiếng Anh (viết theo âm: "zira", "dasport"). Nhãn ngoại tuyến bắt buộc để người dùng không đọc nó như bản đám mây.
- **Rủi ro còn lại:** trang gốc ghi Apache-2.0 nhưng dữ liệu huấn luyện (nhãn giả trên ~70 nghìn giờ) không ghi nguồn rõ trong README. Chủ sản phẩm chấp nhận rủi ro này hoặc đổi sang model có nguồn dữ liệu rõ trước khi phát hành công khai. Cần ghi công tác giả trong trang "Giới thiệu".
- Chưa làm: đệm segment khi mất mạng rồi gửi lại (hồ sơ riêng), model nhận dạng tốt hơn cho thuật ngữ Anh (Parakeet-CTC Vietnamese chưa đo).
- Muốn thay bằng model khác hoặc đổi nơi chạy thì viết ADR mới thay ADR này.
