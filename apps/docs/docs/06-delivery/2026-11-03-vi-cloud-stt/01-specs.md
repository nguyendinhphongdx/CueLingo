# vi-cloud-stt — Họp tiếng Việt: transcript lưu lại và brief cuối buổi

| Trạng thái | Loại    | Nhánh / PR             | Ước lượng → thực tế |
| ---------- | ------- | ---------------------- | ------------------- |
| Kết quả    | feature | `feat/m1-live-caption` | _1 ngày → ?_        |

**Phạm vi:** trong: tiếng Việt chọn được làm ngôn ngữ cuộc họp; nhận dạng bằng đám mây (Gemini) từng câu qua API và `@cuelingo/ai-gateway`; transcript lưu thành segment như họp tiếng Anh; debrief tiếng Việt (tóm tắt, quyết định, việc cần làm); thông báo đồng ý trước khi gửi âm thanh; ADR · ngoài: lưu file ghi âm, dịch vi→en, khối học (cụm từ khó, câu nên nói) cho họp tiếng Việt, nhãn người nói, partial caption.

## 1. Vấn đề

Chủ sản phẩm có một cuộc họp **tiếng Việt hôm nay hoặc ngày mai** và muốn dùng hệ thống để lấy transcript, lưu lại để làm brief cuối buổi. Hệ thống hiện chỉ nhận dạng tiếng Anh và tiếng Nhật trên máy (Parakeet không có tiếng Việt), nên tiếng Việt không chọn được và không có transcript. Chưa cần ghi âm.

- **Spec liên quan:** `apps/docs/docs/08-adr/0013-multi-language.md`, `0006-no-audio-by-default.md`, `0003-stt-on-device-first.md` (có chế độ STT đám mây dự phòng)
- **Module chạm tới:** `desktop/local-stt`, `desktop/session-controller`, `api/realtime`, `api/sessions`, `workers/debrief-job`, `packages/ai-gateway`, `packages/prompts`, `packages/shared`

## 2. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                                           | Test                                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| AC1 | WHEN người dùng chọn tiếng Việt và bắt đầu họp THE SYSTEM SHALL tách từng câu nói trên máy (không tải model) và gửi âm thanh của câu đó tới API để nhận dạng                                 | sidecar test + `session-controller.test.ts`        |
| AC2 | WHEN API nhận âm thanh một câu THE SYSTEM SHALL trả văn bản tiếng Việt qua task `stt.transcribe` của ai-gateway và ghi một `ai_call` không chứa âm thanh hay văn bản                         | `transcribe.test.ts`, `gateway.test.ts`            |
| AC3 | WHEN có văn bản THE SYSTEM SHALL hiện caption và lưu thành segment của cuộc họp như họp tiếng Anh, p95 ≤ 4 giây sau khi câu kết thúc                                                         | `session-controller.test.ts`, đo thật              |
| AC4 | WHILE ngôn ngữ cuộc họp là `vi` THE SYSTEM SHALL không gọi task dịch                                                                                                                         | `realtime.test.ts`                                 |
| AC5 | WHEN cuộc họp kết thúc THE SYSTEM SHALL tạo debrief tiếng Việt có tóm tắt, quyết định, việc cần làm                                                                                          | `debrief.test.ts`, chạy thật                       |
| AC6 | IF một yêu cầu nhận dạng lỗi hoặc quá hạn THEN THE SYSTEM SHALL thử lại một lần, nếu vẫn lỗi thì đánh dấu câu đó "[không nhận dạng được]" và không dừng cuộc họp                             | `session-controller.test.ts`                       |
| AC7 | THE SYSTEM SHALL hỏi người dùng đồng ý một lần ("âm thanh cuộc họp sẽ được gửi tới Google để nhận dạng") và không gửi âm thanh trước khi đồng ý; server không lưu và log không chứa âm thanh | `session-controller.test.ts`, `transcribe.test.ts` |
| AC8 | THE SYSTEM SHALL chỉ nhận âm thanh cho phiên của chính người dùng (`userId` từ auth), giới hạn kích thước và tần suất                                                                        | `transcribe.test.ts` (ranh giới người dùng)        |

## 3. Câu hỏi mở

- [ ] **Đồng ý gửi âm thanh tới Google (Gemini)** cho cuộc họp này. Người dự họp cần được báo trước (trách nhiệm của bạn, hệ thống chỉ nhắc).
- [ ] **Model Gemini** dùng cho nhận dạng (chất lượng tiếng Việt, chi phí mỗi giờ họp); chốt khi thử.
- [ ] **Đồng ý một lần hay mỗi cuộc họp?** Đề xuất: một lần, hiện biểu tượng "đang gửi âm thanh" suốt cuộc họp.
- [ ] **Ngôn ngữ của khối học trong debrief** cho họp tiếng Việt: bỏ trống (đề xuất) hay tạo như họp tiếng Anh.

## Decision log

| Ngày       | Pha     | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-03 | Spec    | Mở hồ sơ. Chủ sản phẩm chọn: chưa cần ghi âm, cần transcript lưu lại để brief cuối buổi; họp hôm nay hoặc ngày mai. Gộp spec và plan vào một lần duyệt vì gấp (chờ đồng ý)                                                                                                                                                                                                                                                                                                                                                                                              |
| 2026-11-03 | Plan    | Chủ sản phẩm duyệt ("gộp đi xong làm luôn"); đồng ý gửi âm thanh tới Google cho cuộc họp tiếng Việt. Đồng ý một lần mỗi người dùng, có chỉ báo suốt cuộc họp; khối học của debrief tiếng Việt để trống                                                                                                                                                                                                                                                                                                                                                                  |
| 2026-11-03 | Kết quả | Review độc lập (Claude `code-reviewer` và Codex) tìm 🔴: API từ chối câu dài hơn 25 giây một khung (đổi thành 25,5 giây); bấm Dừng làm mất các câu cuối và vẫn gửi tải lên sau Dừng (đổi thành xả hàng đợi có hạn 3 giây nhận thêm, 15 giây tổng); byte lẻ bị cắt ngầm (nay là 400). Quyết định thêm: overlay đi theo cuộc họp (bỏ nút hiện/ẩn và nút chạy thử); thử lại chỉ với lỗi có thể khỏi; nhãn im lặng 25 giây cho nhận dạng đám mây. Chưa làm: đổi vi→en giữa chừng có khoảng mất caption khi model tiếng Anh đang nạp; tra từ trên caption tiếng Việt vẫn bật |
