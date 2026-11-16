# compose-speak — Câu "Nói giúp" có nút nghe, sao chép, trạng thái tải

| Trạng thái | Loại    | Nhánh / PR | Ước lượng → thực tế |
| ---------- | ------- | ---------- | ------------------- |
| Spec       | feature | _chưa cắt_ | M → ?               |

**Phạm vi:**

- **Trong:**
  - Mỗi câu AI soạn trong bảng "Nói giúp" có hàng nút riêng: nghe thử (loa), sao chép, kèm trạng thái đang tải.
  - Giọng đọc có mặc định và người dùng đổi được trong Cài đặt.
- **Ngoài:**
  - Đưa tiếng vào cuộc họp (micro ảo). Cần spec và ADR riêng vì đụng âm thanh và quyền riêng tư.
  - Họp tiếng Việt (bảng "Nói giúp" vốn không hỗ trợ).

## 1. Hiện trạng (đã đọc code)

| Mục                | Hiện tại                                                                                                                                                         | Chỗ                                                                                                        |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Soạn câu           | Trả về nhiều phương án `{en, noteVi}`; bấm một câu để chọn, rồi mới hiện nút "Sao chép câu đã chọn"                                                              | `apps/desktop/src/quick-assist/QuickAssistPanel.tsx`                                                       |
| TTS                | Đã có. `POST` tts, Gemini TTS (`gemini-3.8-flash-lite-tts`, dự phòng `flash-tts`), tối đa 300 ký tự, cache theo hash văn bản, 20 lượt tạo mới mỗi phút mỗi người | `services/api/src/modules/tts/`, `packages/ai-gateway/src/speech.ts`, `packages/shared/src/dto/tts.dto.ts` |
| Giọng              | **Cố định `Kore`** trong `tts.service.ts` và `DEFAULT_VOICE`; người dùng không chọn được; cache không phân biệt giọng                                            | cùng chỗ                                                                                                   |
| Nút nghe           | Đã có hook `useSpeaker` (trạng thái idle / loading / playing / error, cache URL theo văn bản) và `SpeakButton` dùng chung                                        | `packages/ui/src/components/speak-button.tsx`                                                              |
| Cài đặt người dùng | `UserSettings` có `saveAudio`, overlay, mức hỗ trợ; chưa có giọng                                                                                                | `packages/shared/src/dto/settings.dto.ts`                                                                  |

Kết luận nghiên cứu: không cần nhà cung cấp hay model mới. Dùng lại Gemini TTS đang chạy cho Ôn tập, nên không cần ADR về nhà cung cấp (luật: nhà cung cấp mới nhận dữ liệu mới phải ADR). Phần mới là chọn giọng và UI.

## 2. Quyết định kỹ thuật

| #   | Quyết định                                                                                                                                                                                        | Lý do                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| D1  | Mỗi phương án là một hàng: chữ, rồi hàng nút **Nghe** (loa, vòng quay khi đang tải, ô vuông để dừng), **Sao chép** (hiện "Đã sao chép" tại chỗ). Không còn bước "chọn rồi mới sao chép"           | Một thao tác cho một việc; nút nằm ngay câu              |
| D2  | Component hàng này viết **một lần ở `@cuelingo/ui`**, desktop dùng; web dùng khi có "Nói giúp"                                                                                                    | Luật 11                                                  |
| D3  | Giọng: thêm `ttsVoice` vào `UserSettings` (enum một danh sách ngắn các giọng Gemini, ví dụ Kore, Puck, Charon, Aoede, Fenrir, Leda). **Mặc định `Kore`** như hiện tại, nên cache cũ vẫn dùng được | Không đổi hành vi với người chưa chọn                    |
| D4  | `tts.service` đọc giọng từ cài đặt người dùng (lấy `userId` từ auth), khoá cache thêm giọng. Nhiều giọng thì cache không lẫn nhau                                                                 | Luật 3; đúng cache                                       |
| D5  | Cài đặt có mục "Giọng đọc" kèm nút nghe thử một câu mẫu cố định; thay đổi giọng có hiệu lực cho cả Ôn tập, tra từ và "Nói giúp"                                                                   | Một cài đặt cho mọi chỗ phát tiếng                       |
| D6  | Nghe thử đi qua loa/tai nghe của máy bạn, **không** vào cuộc họp. Nút ghi rõ "Nghe thử" để không gây hiểu lầm                                                                                     | Đưa tiếng vào cuộc họp là tính năng khác (ngoài phạm vi) |

## 3. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                       | Test                                          |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------- |
| AC1 | WHEN bảng hiện các phương án THE SYSTEM SHALL hiện nút Nghe và Sao chép ngay trên từng phương án, không cần chọn trước                                                   | `QuickAssistPanel.test.tsx`                   |
| AC2 | WHEN bấm Nghe THE SYSTEM SHALL hiện biểu tượng đang tải đến khi có tiếng, rồi biểu tượng dừng khi đang phát; bấm lại để dừng; lỗi thì hiện "Không phát được" kèm thử lại | test hàng nút; chạy thật                      |
| AC3 | WHEN bấm Sao chép THE SYSTEM SHALL chép câu tiếng Anh và hiện "Đã sao chép" tại hàng đó trong 2 giây; lỗi thì báo rõ                                                     | test hàng nút                                 |
| AC4 | WHERE người dùng chưa chọn giọng THE SYSTEM SHALL dùng `Kore`                                                                                                            | `settings.dto.test.ts`, `tts.service.test.ts` |
| AC5 | WHEN người dùng đổi giọng trong Cài đặt THE SYSTEM SHALL dùng giọng đó cho mọi lần phát sau, và cache không trộn giọng                                                   | `tts.service.test.ts`                         |
| AC6 | IF vượt hạn mức tạo tiếng THEN THE SYSTEM SHALL báo "Đã dùng hết lượt nghe, thử lại sau 1 phút" thay vì im lặng                                                          | test lỗi 429                                  |
| AC7 | Giọng không nằm trong danh sách SHALL bị từ chối ở API (400); không ghi log nội dung câu                                                                                 | test API                                      |

## 4. Cần chủ sản phẩm quyết

- [ ] **Danh sách giọng:** đề xuất 6 giọng trên, mặc định Kore. Chọn nhiều hơn hay ít hơn?
- [ ] **Lưu giọng ở đâu:** `UserSettings` hiện đồng bộ qua API. Nếu lưu cột mới thì cần migration (cần duyệt); nếu lưu trong JSON cài đặt sẵn có thì không. Mình cần đọc kỹ chỗ lưu trước khi chốt trong plan.
- [ ] **Hạn mức theo gói:** hiện 20 lượt tạo mới mỗi phút, không phân gói. Giữ nguyên không?

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                   |
| ---------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-16 | Spec | Mở hồ sơ theo yêu cầu: mỗi câu "Nói giúp" có icon tải, sao chép, loa để nghe; tìm hiểu model giọng, cài đặt người dùng và mặc định. Kết quả: dùng lại Gemini TTS có sẵn, chỉ thêm chọn giọng (mặc định Kore) và UI. Chưa duyệt. |
| 2026-11-16 | Spec | **Duyệt spec** theo đề xuất: 6 giọng (Kore, Puck, Charon, Aoede, Fenrir, Leda), mặc định Kore; giữ 20 lượt tạo mới mỗi phút.                                                                                                    |
