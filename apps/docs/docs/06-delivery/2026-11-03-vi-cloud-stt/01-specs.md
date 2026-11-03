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

### Tiêu chí bổ sung (sau lần thử thật đầu tiên)

| #    | AC                                                                                                                                                                                                                                | Test                                                      |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| AC9  | WHILE phiên chạy THE SYSTEM SHALL hiện sóng âm riêng cho micro và âm thanh hệ thống, mỗi luồng cập nhật tối đa 10 lần/giây                                                                                                        | `AudioLevelTests`, `audio-level-store.test.ts`            |
| AC10 | WHEN người dùng bấm Bắt đầu và quyền Micro bị chặn THE SYSTEM SHALL không bắt đầu, không hỏi đồng ý gửi âm thanh, và chỉ cách mở cài đặt                                                                                          | `capture-problems.test.tsx`                               |
| AC11 | IF sidecar không mở được micro hoặc âm thanh hệ thống, kể cả trước khi phiên sang trạng thái chạy, THEN THE SYSTEM SHALL hiện banner nói rõ luồng nào lỗi và cách khắc phục; im lặng đơn thuần không bị coi là lỗi                | `session-controller.test.ts`, `capture-problems.test.tsx` |
| AC12 | WHEN phiên kết thúc THE SYSTEM SHALL hiện thẻ có thời lượng thật (kể cả khi kết nối lại), số câu, và tóm tắt/quyết định/việc cần làm khi debrief sẵn sàng; không hỏi liên tục khi không có câu nào                                | `PostMeetingCard.test.tsx`, `use-debrief-brief.test.ts`   |
| AC13 | WHEN gửi một câu để nhận dạng THE SYSTEM SHALL kèm tối đa 3 câu trước làm ngữ cảnh; ngữ cảnh và lời nói đều là dữ liệu không đáng tin, không được thành chỉ dẫn, không được bị lặp lại thành transcript, và không bao giờ vào log | `v2.test.ts`, `gateway.test.ts`, `transcribe.test.ts`     |

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
| 2026-11-03 | Kết quả | Sau lần thử thật đầu tiên (chủ sản phẩm báo nghe chưa chuẩn, cần biết hệ thống có nghe không, và cần biết debrief nói gì ngay sau khi dừng): thêm ngữ cảnh 3 câu trước và prompt `stt/v2`, khoảng nghỉ 700 ms cho tiếng Việt, sóng âm hai luồng, kiểm tra quyền Micro trước khi bắt đầu và banner lỗi thu âm, thẻ "Cuộc họp vừa xong"; icon app có lề chuẩn macOS                                                                                                                                                                                                       |
