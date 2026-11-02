---
title: Brief P2-17 · bài nghe–gõ và nghe phát âm (web và desktop)
---

# Brief — P2-17 · Nghe–gõ và phát âm cụm từ

> Nhánh `feat/p2-17-codex` · Worktree `.worktrees/p2-17-codex`

## Bối cảnh

API đã có giọng đọc: `POST /v1/tts` body `{ "text": "…" }` (tối đa 300 ký tự) trả `audio/wav` (đọc `apps/docs/docs/04-modules/03-api/tts.md`). Hàng đợi ôn tập có thêm dạng thẻ **`dictation`** khi client xin bằng `GET /v1/review/queue?dictation=1`: `prompt` và `phrase` là cụm tiếng Anh sẽ được đọc, `choices` rỗng, `answer` là cụm cần gõ đúng, `meaningVi` và `contextEn` hiện sau khi trả lời. Hợp đồng ở `packages/shared/src/dto/review.dto.ts` (đừng đổi). **Client cũ không xin `dictation=1` thì không bao giờ nhận thẻ này**: nên phải làm xong cả hai client trước khi bật.

## Luật quan trọng của repo (luật 11)

Giao diện dùng ở web **và** desktop viết **một lần** trong `packages/ui`, các client chỉ dùng. Cả hai client đã có trang ôn tập riêng (`apps/web/src/features/review`, `apps/desktop/src/study`): giữ nguyên chúng, chỉ cắm phần mới vào. Có bài test `packages/ui/src/shared-ui.test.ts` bắt việc tự vẽ lại component trùng tên.

## Việc cần làm

1. **`packages/ui/src/components/speak-button.tsx`**: nút icon nhỏ "Nghe" (`IconButton` + biểu tượng loa) nhận `loadAudio(): Promise<Blob>`, phát bằng `<audio>`/`Audio`, có trạng thái đang tải (xoay), đang phát, lỗi (tooltip "Không phát được"), bấm lần nữa để dừng; cache blob URL theo văn bản trong bộ nhớ để nghe lại không gọi mạng; thu hồi URL khi huỷ. Có `aria-label` "Nghe phát âm".
2. **`packages/ui/src/components/dictation-card.tsx`**: giao diện thẻ nghe–gõ nhận `{ card, loadAudio, onAnswer(correct: boolean, typed: string, responseMs: number) }`: nút Nghe to ở giữa (tự phát một lần khi thẻ hiện, người dùng có thể chặn tự phát), nút "Nghe chậm" (0,75× qua `playbackRate`), ô gõ, Enter để kiểm tra, "Không nghe ra" để bỏ qua (tính là sai); so khớp **cục bộ** không phân biệt hoa thường, bỏ dấu câu và khoảng trắng thừa (hàm thuần `isSameText` có test, nằm trong `packages/ui/src/lib/dictation.ts`); sau khi kiểm tra hiện đáp án đúng, phần chênh lệch (đánh dấu ký tự sai/thiếu, chữ + gạch chân, không chỉ màu), `meaningVi`, `contextEn`. Dùng token và component hiện có, chữ nhỏ gọn, không gradient.
3. **Web:** trong trang ôn tập thêm dạng `dictation`: client `apps/web/src/lib/client.ts` thêm `review.queue({ dictation: true })` (gọi `GET /v1/review/queue?dictation=1`) và `tts.speak(text): Promise<Blob>` (POST, `credentials: 'include'`, đọc `blob()`); `loadAudio` truyền xuống `DictationCard`. Điểm chấm gợi ý: đúng → "Được", sai → "Lại" (người dùng vẫn sửa được ở bốn nút chấm như các thẻ khác). `exercise: 'dictation'` gửi ở `POST /v1/review/answer`.
4. **Desktop:** tương tự ở `apps/desktop/src/study/` (`study-api.ts` thêm `queue({dictation:true})` và `speak(text)` dùng `currentToken`; `loadAudio` cho `DictationCard`).
5. **Nghe phát âm** (`SpeakButton`) ở: thẻ ôn sau khi trả lời (cụm từ), danh sách Cụm từ (web và desktop, mỗi dòng), và mỗi cụm trong khối "Cụm từ nên lưu" của debrief web.
6. Chỉ xin `?dictation=1` khi client đã có `DictationCard` (cả hai client trong brief này đều có).

## AC

| #   | AC (EARS)                                                                                          | Test                           |
| --- | -------------------------------------------------------------------------------------------------- | ------------------------------ |
| AC1 | `isSameText` bỏ qua hoa thường, dấu câu, khoảng trắng thừa, nhưng phân biệt chữ khác               | unit test                      |
| AC2 | Thẻ dictation: gõ đúng → báo đúng; gõ sai → hiện đáp án và chỗ khác; "Không nghe ra" → sai         | component test                 |
| AC3 | `SpeakButton` gọi `loadAudio` một lần cho cùng một văn bản dù bấm nhiều lần, hiện lỗi khi thất bại | component test với `Audio` giả |
| AC4 | Cả hai client gọi `?dictation=1` và gửi `exercise: 'dictation'` khi trả lời                        | test client                    |
| AC5 | Khi `loadAudio` lỗi thẻ vẫn trả lời được (hiện văn bản và cho gõ)                                  | test                           |
| AC6 | `pnpm verify` và `pnpm --filter @cuelingo/web build` xanh, test `shared-ui` không đỏ               | verify                         |

## Phạm vi file

Được sửa/tạo: `packages/ui/src/components/{speak-button,dictation-card}.tsx`, `packages/ui/src/lib/dictation.ts`, `apps/web/src/features/{review,phrase-bank,debrief}/**`, `apps/web/src/lib/client.ts`, `apps/desktop/src/study/**`. Không sửa `services/**`, `packages/shared/**`, Rust, `package.json`, lockfile.

Quy tắc chung: đọc `AGENTS.md` gốc và của thư mục bạn sửa. Không có mạng, không `pnpm add`, không commit/push. Giao diện tiếng Việt, theo các skill thiết kế trong `.claude/skills/`. Chạy `pnpm verify`; điền mục Kết quả, nêu rõ cái chưa kiểm được.

## Kết quả _(implementer điền)_
