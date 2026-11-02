# 0013 · Đa ngôn ngữ: ngôn ngữ theo từng cuộc họp, dữ liệu học theo từng ngôn ngữ

**Trạng thái:** Proposed · 2026-11-02

## Bối cảnh

Sản phẩm hiện giả định một cặp ngôn ngữ cố định: họp tiếng Anh, dịch sang tiếng Việt. Người dùng thật có thể họp tiếng Anh lúc 9 giờ và tiếng Nhật lúc 10 giờ cùng một ngày. Câu hỏi: đổi ngôn ngữ thế nào, và dữ liệu học (từ vựng, lịch ôn, tiến độ) có tách theo ngôn ngữ không.

Điều đã kiểm trên code và thư viện hiện có:

- **Nhận dạng giọng nói trên máy** (FluidAudio): có Parakeet TDT **Japanese** (batch, 0,6B, CER 6,85% trên JSUT), Parakeet TDT v3 cho 25 ngôn ngữ châu Âu, SenseVoice/Paraformer cho tiếng Trung. Cách ta đang làm (chốt từng câu rồi nhận dạng) đúng với dạng batch này. Model streaming `Parakeet EOU` chỉ có tiếng Anh, ta chưa dùng.
- **Giọng đọc:** Gemini TTS đọc được tiếng Nhật; Kokoro/Supertonic trên máy cũng có `ja`.
- **Dịch, tra từ, debrief:** là LLM, đổi ngôn ngữ là đổi prompt.
- **Chỗ đang cứng tiếng Anh:** `lexical_items` duy nhất theo `(lemma, type)` nên "table" tiếng Anh và một từ trùng chữ ở ngôn ngữ khác sẽ đụng nhau; tách từ để bấm tra bằng regex chữ-và-số (tiếng Nhật không có dấu cách); so khớp bài nghe–gõ theo từ; `learner_profiles.listening_level` chỉ một giá trị.

## Quyết định

### 1. Hai ngôn ngữ, hai vai trò

- **Ngôn ngữ mẹ đẻ** (`native`, hiện là `vi`): ngôn ngữ giải thích, dịch ra, và giao diện. Một cài đặt của người dùng, ít khi đổi.
- **Ngôn ngữ cuộc họp** (`language`, mã BCP-47 ngắn: `en`, `ja`…): thuộc về **từng cuộc họp**, không phải cài đặt toàn cục. Cuộc họp 9 giờ là `en`, 10 giờ là `ja`, hai cuộc họp độc lập, không dính gì nhau.

### 2. Đổi ngôn ngữ

- Chọn ở thẻ "Caption trực tiếp" trước khi bắt đầu; mặc định là ngôn ngữ lần họp gần nhất, kèm danh sách các ngôn ngữ đã dùng. Đổi cần một cú bấm, kể cả ngay trước khi họp.
- Đổi **giữa cuộc họp** được (cuộc họp có hai ngôn ngữ): mỗi câu (`segment`) ghi ngôn ngữ của nó, debrief và ôn tập dùng ngôn ngữ của từng câu.
- Sau này: tự nhận ngôn ngữ ("Tự nhận") bằng nhận dạng ngôn ngữ ở vài giây đầu, rồi gợi ý từ lịch ("cuộc họp có từ khoá Tokyo").
- Chi phí đổi: model của ngôn ngữ mới tải một lần (hàng trăm MB, hiện thanh tiến độ), sau đó nạp trong vài giây. App giữ model của ngôn ngữ vừa dùng.

### 3. Dữ liệu học tách theo ngôn ngữ

Mọi thứ thuộc về việc **học** có khoá ngôn ngữ; thứ thuộc về **con người** thì dùng chung.

| Tách theo ngôn ngữ                                                                                       | Dùng chung                                |
| -------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Từ vựng và cụm từ (`lexical_items`), lịch ôn FSRS (`user_lexicon`), thuật ngữ cá nhân (`glossary_terms`) | Tài khoản, tên, thiết bị                  |
| Mức nghe và mức hỗ trợ mặc định (bảng mới `learner_languages`)                                           | Chuỗi ngày ôn tập (thói quen, tính chung) |
| Tiến độ, % hiểu, số lần tra từ mỗi cuộc họp, hàng đợi ôn                                                 | Cài đặt hiển thị overlay                  |
| Debrief (theo ngôn ngữ của cuộc họp)                                                                     | Giao diện tiếng Việt                      |

Quy tắc chống lẫn dữ liệu: **ghi** luôn lấy ngôn ngữ từ chính tài nguyên (cuộc họp, từ vựng), không từ một "ngôn ngữ đang chọn" toàn cục. **Đọc** (danh sách, hàng đợi ôn, tiến độ) nhận tham số `language` rõ ràng, mặc định là ngôn ngữ học đang xem, và giao diện có bộ chuyển ngôn ngữ ở Ôn tập, Cụm từ, Thuật ngữ, Tiến độ.

### 4. Thay đổi dữ liệu (chỉ thêm, theo luật 7)

- `sessions.language text NOT NULL DEFAULT 'en'`; `segments.language text` (null = theo cuộc họp).
- `lexical_items.language text NOT NULL DEFAULT 'en'`; khoá duy nhất đổi thành `(language, lemma, type)` (thêm index mới, bỏ index cũ trong migration mới).
- `glossary_terms.language text NOT NULL DEFAULT 'en'`; duy nhất theo `(user_id, language, lower(term))`.
- `learner_languages(user_id, language, listening_level, assist_default, settings, created_at)`, khoá chính `(user_id, language)`. Thay dần `learner_profiles.listening_level` và `assist_default`; dữ liệu cũ chép sang dòng `en`.
- Mọi dòng cũ điền `en`. Không mất dữ liệu.

### 5. Đường dữ liệu theo ngôn ngữ

- **Danh mục ngôn ngữ hỗ trợ** một chỗ: `SUPPORTED_LANGUAGES` trong `@cuelingo/shared`, mỗi mục khai: tên, model nhận dạng, giọng đọc, cách tách từ, có chữ đọc (furigana) không. Thêm một ngôn ngữ = một mục này + bộ kiểm thử chất lượng (eval) + xem lại prompt. Không rải `if (language === 'ja')` khắp nơi.
- **Sidecar** nhận `--language`/lệnh `language <mã>`: chọn model nhận dạng, đổi được giữa chừng. Tiếng Anh vẫn Parakeet v2; `ja` dùng Parakeet TDT Japanese; các ngôn ngữ châu Âu dùng v3.
- **WebSocket**: `hello` mang `language` (và ngôn ngữ đích); `translate.realtime` nâng lên v2 nhận cặp ngôn ngữ (nguồn → mẹ đẻ). Với tiếng Nhật trả thêm chữ đọc khi tra từ.
- **Tra từ, tóm tắt, debrief, soạn câu**: prompt nhận ngôn ngữ; "nói giúp" soạn ra ngôn ngữ của cuộc họp (tiếng Nhật kèm mức lịch sự).
- **Giọng đọc**: chọn giọng theo ngôn ngữ; khoá bộ nhớ đệm thêm ngôn ngữ.
- **Tách từ để bấm tra**: `Intl.Segmenter(language, { granularity: 'word' })` thay cho regex, một hàm dùng chung ở `@cuelingo/ui`.
- **Bài nghe–gõ**: so khớp theo ký tự cho tiếng Nhật (chuẩn hoá kana/kanji, chấp nhận gõ romaji ở bước sau); theo từ cho các ngôn ngữ có dấu cách.
- **Gợi ý hỗ trợ (Assist Dial)** tính riêng cho từng ngôn ngữ: giỏi tiếng Anh không có nghĩa nghe tốt tiếng Nhật.

## Phương án đã cân nhắc

- **Một cài đặt toàn cục "ngôn ngữ đang học":** dễ làm nhưng sai ngay trong ví dụ 9 giờ / 10 giờ (phải nhớ đổi trước mỗi cuộc họp), và dễ ghi nhầm dữ liệu vào ngôn ngữ sai. Loại.
- **Mỗi ngôn ngữ một tài khoản hoặc một kho dữ liệu riêng:** tách sạch nhưng mất chuỗi ngày chung và nhân đôi mọi thứ. Loại.
- **Chỉ một model đa ngôn ngữ tự nhận:** gọn nhưng kém chính xác hơn model riêng từng ngôn ngữ ở tiếng Nhật, và chưa có bản streaming đủ tốt. Giữ làm hướng "Tự nhận" ở giai đoạn sau.

## Hệ quả

- Giai đoạn 1 chỉ thêm cột và khoá ngôn ngữ, mặc định `en`, **không đổi hành vi hiện tại**.
- Mỗi ngôn ngữ mới phải qua eval dịch và nhận dạng trước khi được bật cho người dùng.
- Tiếng Nhật có chi phí riêng: tách từ, chữ đọc, mức lịch sự khi soạn câu, so khớp bài gõ. Nên làm tiếng Nhật làm ngôn ngữ thứ hai để kiểm chứng kiến trúc, rồi mới thêm ngôn ngữ khác.
- Đo lại độ trễ (p95) cho từng model nhận dạng; model batch tiếng Nhật chốt câu chậm hơn nhịp ngắn của tiếng Anh.
