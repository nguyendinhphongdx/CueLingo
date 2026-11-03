# Review — languages-ko-zh-ja

**Trạng thái:** code xong, đã qua hai review độc lập (một vòng); đang sửa các điểm review; **chưa thử thật trong một cuộc họp** (cần người dùng). Chưa push, chưa tạo PR.

## Thay đổi so với plan

| Dấu         | Phần                                                            | Chi tiết (lý do nếu khác plan)                                                                                                                                                                                            |
| ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡 MODIFIED | `packages/shared/src/languages.ts`                              | Thêm `ko`, `zh`; `ja` sang đám mây và bật; `sttHint` cho từng ngôn ngữ; nhãn "Tiếng Nhật · 日本語". Khác plan: không thêm `.tw` làm gợi ý lịch cho tiếng Trung vì tên miền Đài Loan thường là chữ phồn thể, ngoài phạm vi |
| 🟢 ADDED    | `packages/prompts` `stt/v3`, `debrief/v3`                       | v3 nối `sttHint`; debrief v3 viết tiếng Việt cho mọi ngôn ngữ nguồn, không khối học; chọn theo `learnable`; v1 và v2 giữ nguyên                                                                                           |
| 🟡 MODIFIED | `services/workers`, `apps/web/src/features/debrief`             | Tách `translates` (dịch từng câu, transcript song ngữ) khỏi `learnable` (khối học, điểm hiểu)                                                                                                                             |
| 🟡 MODIFIED | `apps/desktop/native` (Swift)                                   | `cloudLanguages = vi, ja, ko, zh`; hàm `probeCandidates` để dò ngôn ngữ chỉ dùng model trên máy                                                                                                                           |
| 🟡 MODIFIED | `packages/ui` `LanguageSwitcher`, `apps/desktop` `SessionPanel` | Dropdown gốc dùng chung; chữ đồng ý nói chung "nhận dạng giọng nói"                                                                                                                                                       |
| 🟡 MODIFIED | `apps/desktop/src/session/session-controller.ts`                | Thêm ngoài plan (do lỗi người dùng gặp): bắt đầu lỗi giữa chừng thì dừng phiên native và kết thúc phiên server; tự dừng rồi thử lại một lần khi gặp `session_already_running`                                             |
| 🟢 ADDED    | ADR 0016, các trang module                                      | `0016-cloud-stt-for-japanese-korean-chinese.md`; `shared`, `ui`, `prompts`, `ai-gateway`, `local-stt`, `session-controller`, `02-web/debrief`; backlog `W0-07`; bản đồ tính năng                                          |

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md):

- [x] Ranh giới & bảo mật: đồng ý một lần trước mọi ngôn ngữ đám mây (theo registry); `ko`, `zh` không vào học; không log âm thanh
- [x] Hợp đồng: registry là nguồn duy nhất; Swift phản chiếu danh sách (có test `isCloud`)
- [x] Kiến trúc: không rẽ nhánh theo mã ngôn ngữ; cờ `translates` và `learnable` tách bạch
- [x] AI: prompt có phiên bản; `sttHint` chỉ từ registry
- [x] Test: xem dưới
- [x] Docs: ADR 0016 và các trang module
- [x] Phạm vi: đúng spec; chữ đọc, tiếng Trung phồn thể, model trên máy vẫn để sau

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test   # 128 file, 771 test xanh
pnpm exec depcruise apps services packages --config .dependency-cruiser.cjs --exclude '(^|/)\.env'   # không vi phạm
cd apps/desktop/native/macos-audio && swift test   # 40 test xanh (chạy ngoài sandbox của SwiftPM)
pnpm docs:build   # xanh
```

**Không chạy trọn được:** `pnpm check:deps` nguyên bản đỏ trong sandbox vì không đọc được `apps/desktop/.env` (EPERM); đã chạy `depcruise` cùng cấu hình loại `.env`.

## Kiểm nhanh bằng Gemini thật (AC11)

Mỗi ngôn ngữ ba câu (đặt hàng báo giá, thời hạn phát hành, hai lỗi thanh toán), giọng macOS đọc, `stt.transcribe` (v3) rồi `translate.realtime` sang tiếng Việt, model `gemini-3.5-flash-lite` và `gemini-3.1-flash-lite`. **Đây là kiểm nhanh với giọng tổng hợp sạch, không thay cho bộ đánh giá chuẩn (`ml/eval` mới chỉ có README, chưa có bộ cho các ngôn ngữ này).**

**Giọng bản ngữ (Kyoko, Yuna, Tingting):**

| Ngôn ngữ | Khớp từng chữ | Sai lệch                                                                                      | STT       | Dịch        |
| -------- | ------------- | --------------------------------------------------------------------------------------------- | --------- | ----------- |
| Hàn      | 3/3           | Không                                                                                         | 1,9–2,1 s | 0,65–0,84 s |
| Trung    | 2/3           | Câu 3 mất một chữ "还" (không đổi nghĩa)                                                      | 1,7–2,4 s | 0,62–0,89 s |
| Nhật     | 1/3           | "二件" thành "2件" (đổi cách viết); câu 2 mất chữ "末" (cuối tháng thành "tháng"): lệch nghĩa | 1,9–2,4 s | 0,67–1,16 s |

**Lần chạy đầu với giọng "Eddy" (giọng đa ngôn ngữ phát âm không chuẩn)** cho kết quả rất tệ (tiếng Hàn và Trung nhận sai nhiều từ, ví dụ "报价单" thành "报价加", "결제 관련 버그" thành "키오스크 관련 보완할 도거나마"). Không công bằng với model nên không dùng làm căn cứ, ghi lại để thấy kết quả phụ thuộc mạnh vào chất lượng âm thanh đầu vào.

**Đánh giá:** độ trễ tổng sau khi câu kết thúc khoảng 2,3 đến 3,3 giây (nhận dạng cộng dịch), dịch riêng đạt p95 ≤ 2,5 giây. Chất lượng đủ để bật cho thử nghiệm; **tiếng Nhật có lỗi mất "末" cần theo dõi khi thử bằng giọng người thật**. Với giọng người thật trong cuộc họp, tạp âm và nhiều người nói chưa được đo.

## Cho người review — đọc theo thứ tự

| #   | File                                                                                                    | Soi gì                                                           |
| --- | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1   | `packages/shared/src/languages.ts`                                                                      | Các cờ của từng ngôn ngữ; `sttHint`                              |
| 2   | `services/workers/src/jobs/debrief/debrief.handler.ts`, `apps/web/src/features/debrief/DebriefPage.tsx` | Tách `translates` và `learnable`; tiếng Nhật không đổi           |
| 3   | `apps/desktop/src/session/session-controller.ts`                                                        | Dọn dẹp khi bắt đầu lỗi, tự chữa, không bỏ sót phiên trên server |
| 4   | `packages/ui/src/components/language-switcher.tsx`                                                      | Trợ năng, bàn phím                                               |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                                                                                       | Tìm ở        | Sửa                                                                       |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------------------- |
| Bắt đầu lỗi giữa chừng để lại phiên Rust "đang chạy": các lần Bắt đầu sau luôn báo "Một phiên đang chạy"                                  | Chủ sản phẩm | Dừng native và kết thúc phiên server khi lỗi; tự dừng rồi thử lại một lần |
| Bắt đầu lại từ trạng thái lỗi có thể bỏ rơi phiên server cũ (ghi đè `activeSessionId`)                                                    | Codex        | Kết thúc phiên cũ trước khi bắt đầu phiên mới                             |
| Prompt `debrief/v3` chưa nói lời thoại là dữ liệu không đáng tin                                                                          | Codex        | Thêm câu dặn và test                                                      |
| Test đồng ý, tải lên và dịch chỉ chạy cho tiếng Việt và Nhật; test dropdown không gọi `onChange`; tách từ tiếng Trung và Hàn chưa có test | Codex        | Mở rộng test theo từng ngôn ngữ, thêm test `onChange` và tách từ          |
| Thiếu `03-review.md` và kết quả kiểm Gemini                                                                                               | Codex        | Trang này                                                                 |

## Còn lại, chưa làm

- **Thử thật (cần người dùng):** một cuộc họp thật bằng tiếng Hàn, Trung và Nhật; kiểm độ chính xác với giọng người thật; xem dropdown trong app.
- **Bộ đánh giá chuẩn** (`ml/eval`) cho nhận dạng và dịch ba ngôn ngữ: chưa có.
- **Giới hạn thiết kế:** caption trễ cỡ độ dài câu cộng 2 đến 3 giây, không có chữ hiện dần; tiếng Trung chỉ giản thể; ôn tập và bài đánh giá chỉ cho tiếng Anh và Nhật.
