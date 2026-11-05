# Review — speaker-labels

**Trạng thái:** code xong và đã qua một vòng review độc lập; gắn nhãn "Speaker N" **tắt ở mọi ngôn ngữ** vì không đạt ngưỡng ở bước đo (AC2, AC3). Chạy được: nhãn "Tôi" và "Người khác" (kể cả họp tiếng Anh), debrief v4/v5. **Có code và test nhưng chưa dùng được với dữ liệu thật:** đổi tên và lọc theo người, vì chưa có dòng `speaker_N` nào được tạo (mục `me` không đổi tên được); chúng chỉ có tác dụng khi cờ bật lại. Chưa push.

## Thay đổi so với plan

| Dấu        | Phần                                                                             | Chi tiết (lý do nếu khác plan)                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 ADDED   | Contract, migration `20261107090000_speaker_labels.sql`, `stt/v4`, gateway       | Đúng plan; trường mới đều tuỳ chọn                                                                                                                                           |
| 🟢 ADDED   | API `transcribe`, `realtime`, module `speakers`, `core-sdk.renameSpeaker`        | Đúng plan; test ranh giới người dùng                                                                                                                                         |
| 🟢 ADDED   | Debrief `v4`/`v5`, `SpeakerTag`, worker join `speakers`                          | Đúng plan                                                                                                                                                                    |
| 🟢 ADDED   | Desktop sổ người nói, đường tiếng Anh gửi cả câu mic (văn bản), `CaptionBlock`   | Đúng plan                                                                                                                                                                    |
| 🟢 ADDED   | Web debrief: `SpeakerTag`, lọc theo người, đổi tên tại chỗ, nhắc tạo lại debrief | Đúng plan                                                                                                                                                                    |
| 🔴 CHANGED | Cờ `labelsSpeakers` = `false` ở **mọi** ngôn ngữ                                 | Plan bước 9 cho phép tắt theo ngôn ngữ không đạt: cả hai ngôn ngữ đo được đều rớt, `vi` không đo được nên giữ tắt. Cơ chế vẫn nằm trong code và test (bật cờ tạm trong test) |

## Kết quả đo bằng Gemini thật (bước 9)

Hội thoại 9 lượt, ba "người", model `stt.transcribe`, sổ người nói của desktop dùng nguyên, mỗi lượt gọi cả v3 (không nhãn) và v4. **Giọng tổng hợp, không thay cho giọng người thật.**

| Lần | Ngôn ngữ, giọng                              | Cùng người cùng nhãn | Gắn nhầm | Một người tách hai nhãn | Không nhãn | Số nhãn dùng / 3 người |
| --- | -------------------------------------------- | -------------------- | -------- | ----------------------- | ---------- | ---------------------- |
| 1   | vi, cùng giọng Linh đổi cao độ và tốc độ     | 44%                  | 0%\*     | 0%                      | 56%        | 1                      |
| 1   | ja, cùng giọng Kyoko đổi cao độ và tốc độ    | 67%\*                | 0%\*     | 0%                      | 33%        | 1                      |
| 2   | ko, Yuna + Rocko + Grandma (giọng khác nhau) | 22%                  | 33%      | 0%                      | 44%        | 1                      |
| 2   | ja, Kyoko + Rocko + Grandma                  | 33%                  | 56%      | 0%                      | 11%        | 1                      |
| 3   | ko, sau khi sửa prompt (so giọng với mô tả)  | 33%                  | 44%      | 22%                     | 0%         | 2                      |
| 3   | ja, sau khi sửa prompt                       | 33%                  | 67%      | 0%                      | 0%         | 1                      |

\* Lần 1 dùng cách tính cũ coi "ba người cùng gom vào một nhãn" là ổn định; cách tính này sai nên lần 2, 3 tính theo độ thuần của nhãn. Ở lần 1, vi và ja thực chất gom cả ba người vào `speaker_1`.

**Kết luận:** ngưỡng plan là gắn nhầm ≤ 10%; cả ko và ja đều vượt xa. Nguyên nhân: mỗi lần gọi Gemini chỉ nghe đoạn âm thanh hiện tại, người đã biết chỉ có mô tả chữ ("giọng nữ, trung bình") nên không so được giọng; sau câu đầu nó gần như không trả `new`. Sửa prompt giúp ko tìm ra người thứ hai nhưng vẫn nhầm nhiều. Độ trễ không phải vấn đề: v4 không chậm hơn v3 (p50 1,6 đến 1,9 s cả hai). `vi` chỉ có một giọng máy nên không đo được giọng khác nhau; tiếng Trung chưa đo, cùng cơ chế nên giả định cùng kết quả.

## Cách làm tiếp (cần chủ sản phẩm quyết)

| #   | Hướng                                                                                   | Ưu                                     | Nhược                                                                                     |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------------------------- |
| A3  | Gửi kèm **đoạn âm thanh mẫu 3 giây** của mỗi người đã biết để Gemini so giọng trực tiếp | Có thể đạt; không thêm dịch vụ         | Giữ và gửi lặp mẫu giọng (đụng AC6, phải hỏi lại); âm thanh vào tăng, trễ và chi phí tăng |
| B   | Model tách người chạy **trên máy** (qua sidecar), chỉ gửi nhãn                          | Chính xác hơn; mẫu giọng không rời máy | Nặng, thêm phụ thuộc, phải qua ADR; cần bộ đánh giá                                       |
| C   | Giữ như hiện tại: chỉ "Tôi" và "Người khác", đổi tên chỉ cho người gắn tay              | Không rủi ro, đã chạy                  | Họp nhiều người vẫn không biết ai là ai                                                   |

## Quyền riêng tư (AC6)

Không có mẫu giọng hay vân giọng. Mô tả giọng (hint) chỉ trong RAM của desktop, không vào DB, log hay `ai_call` (có test). Với cờ tắt hiện nay, hint không còn được tạo ra. Tiếng Anh nay gửi cả câu mic ở dạng **văn bản** (không âm thanh) để có "Tôi" trong transcript và debrief; chủ sản phẩm đã đồng ý.

## Còn lại

- Chốt hướng A3, B hay C cho nhãn "Speaker N".
- `pnpm test:int` trên Postgres thật đã xanh (15 file, 36 test; chạy bằng Node 23.8 vì Node 22.14 trong máy thấp hơn mức yêu cầu 22.19).
- Thử tay trên web: bấm nhãn → đổi tên → Enter/Esc → nhắc tạo lại debrief (chưa có test bấm thật).
- Trước khi bật cờ: tải lên song song 3 câu làm số `speaker_N` cấp theo câu nào xong trước, cửa sổ gộp 5 giây chỉ giảm được việc một người bị tách hai nhãn.

## Review độc lập (code-reviewer) và cách xử lý

| Mức | Phát hiện                                                                                 | Xử lý                                                           |
| --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 🔴  | Ô đổi tên mở ở mọi câu của cùng một người, ô sau cướp focus, ô trước đóng ngay            | Chỉ mở ở đúng câu được bấm                                      |
| 🔴  | Hồ sơ nói "đổi tên chạy" trong khi không có người nói nào để đổi tên                      | Sửa hồ sơ (mục Trạng thái)                                      |
| 🟡  | "Đang tạo lại debrief…" kẹt vĩnh viễn nếu worker lỗi; ô nhập kẹt sau khi lưu lỗi          | Hết hạn chờ thì cho tạo lại; giữ focus khi lưu                  |
| 🟡  | Test ranh giới tích hợp dùng nhãn và id đã có, nên không thử được điều kiện chủ sở hữu    | Bob gửi nhãn mới với id mới; thêm kiểm CHECK của migration      |
| 🟡  | Kiểu `debrief.generate` trong gateway còn là của v1                                       | Đổi sang `DebriefSpeakerInput`                                  |
| 🟡  | Tên người dùng đặt trùng nhãn hệ thống ("Tôi", "Speaker 3") làm prompt debrief nhầm người | Schema từ chối các tên đó (không phân biệt hoa thường), có test |
| 🟡  | Test bật cờ tạm gán cứng `false` khi dọn                                                  | Khôi phục giá trị gốc                                           |
| 🟢  | Ký tự `\|` trong mô tả giọng giả được cột trong khối người nói                            | Đổi `\|` thành `/`                                              |

## Quyết định cuối

2026-11-05: chủ sản phẩm chọn **C**. AC2, AC3 không làm trong MVP; muốn có "Speaker N" thật thì mở ADR cho tách người trên máy (B) rồi bật lại cờ `labelsSpeakers`.
