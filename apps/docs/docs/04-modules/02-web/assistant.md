# Assistant

> Phần: [Web app](./README.md) · Code: `apps/web/src/features/assistant/` · Hồ sơ: [ai-agent](../../06-delivery/2026-11-05-ai-agent/02-plan.md) · Quyết định: [ADR 0018](../../08-adr/0018-agent-harness.md), [ADR 0019](../../08-adr/0019-ai-generated-ui.md)

Trò chuyện với trợ lý AI về tiếng Anh công sở và chuẩn bị cho cuộc họp (tính năng thử nghiệm, lô 1). Câu trả lời đến theo từng đoạn, kèm các bước công cụ và thẻ học; nhấp đúp vào một từ để tra nghĩa, nghe hoặc lưu vào Cụm từ.

## Trách nhiệm

- Danh sách cuộc trò chuyện (`/assistant`), đổi tên và xoá (hộp xác nhận, xoá mềm 7 ngày) và khung chat (`/assistant/<id>`)
- Gửi tin qua `client.agent.sendMessage` (SSE), hiện tin của người dùng ngay, đổ câu trả lời vào bản nháp, **nút Dừng** huỷ request; sau `done` đọc lại hội thoại từ server để cái hiện ra là cái đã lưu
- Trạng thái rỗng với bốn câu gợi ý bấm một lần
- Nhấp đúp vào chữ của trợ lý mở `WordActionsMenu`: **Tra nghĩa** (`POST /v1/assist/lookup` kèm câu chứa từ), **Nghe** (`/v1/tts`), **Lưu** (`phrases.save` kèm `context` là câu đó; ghi event `phrase_saved`). "Đã lưu" hiện ngay và cũng hiện cho từ đã có sẵn: so bằng `normalizePhrase` với `phrases.list` (cùng khoá cache `['phrases', language]` với trang Cụm từ)
- Không mở desktop: mục roadmap `assistant` có `desktop: 'soon'`

## Phạm vi MVP

- Lô 1 của ai-agent (thử nghiệm). Khối HTML/JS trong hộp cát (lô 3) chưa có.

## Cấu trúc

| File                                                     | Việc                                                                                                                                              |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `AssistantPage.tsx`                                      | Container: ghép hook, danh sách, khung chat, menu từ, hộp xác nhận xoá                                                                            |
| `ChatView.tsx`, `ConversationList.tsx`, `RenameForm.tsx` | Trình bày thuần, nhận dữ liệu và callback; ô nhập: Enter gửi, Shift+Enter xuống dòng, không gửi khi đang gõ dấu (IME)                             |
| `use-chat.ts`                                            | Truy vấn hội thoại, gửi/dừng, tin tạm, tạo hội thoại ở tin đầu rồi chuyển địa chỉ, lỗi thân thiện                                                 |
| `chat-state.ts`                                          | Hàm thuần: gấp `AgentStreamEvent` vào bản nháp, ghép tin đã lưu với tin tạm (khoá `seq-N` giữ nguyên để thẻ không dựng lại), `settleConversation` |
| `use-conversations.ts`                                   | Danh sách, đổi tên, xoá                                                                                                                           |
| `use-word-actions.ts`, `word-selection.ts`               | Đọc từ và câu từ `getSelection`, tra/nghe/lưu, so "Đã lưu"                                                                                        |
| `starter-prompts.ts`                                     | Câu gợi ý                                                                                                                                         |

Route: `src/app/(app)/assistant/[[...id]]/page.tsx` chỉ render `AssistantPage`.

## Lỗi hiện cho người dùng

`describeAgentError` (`src/lib/errors.ts`) không bao giờ hiện chữ của server:

| Tình huống                                    | Câu hiện                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------ |
| 409 `CONFLICT`                                | Trợ lý đang trả lời tin trước đó, đợi một chút                                       |
| 429 `AGENT_QUOTA_EXCEEDED`                    | Hết lượt hỏi hôm nay (từ `details`: số lượt và giờ làm mới `HH:mm` theo múi giờ máy) |
| 503 `AGENT_DISABLED`                          | Trợ lý AI đang tạm tắt                                                               |
| Mất mạng, hoặc stream đóng khi chưa có `done` | Mất kết nối tới máy chủ, kiểm tra mạng                                               |
| `error{AGENT_FAILED}` trong stream            | Trợ lý gặp sự cố khi trả lời; tin ghi chú "chưa trả lời được"                        |

Lỗi trước khi stream (409, 429, 503, mất mạng) bỏ tin tạm và **trả lại chữ** vào ô nhập để gửi lại.

## Dừng

Bấm Dừng thì `signal.abort()`; server lưu `stopped` kèm chữ đã sinh. Server ghi trạng thái đó sau khi thấy kết nối đóng nên client đọc lại tối đa 5 lần (cách nhau 0,4 giây) khi tin vẫn là `streaming`.

## Phụ thuộc

- `@cuelingo/core-sdk` (`conversations`, `agent`), `@cuelingo/shared`, `@cuelingo/ui` (`ChatMessage`, `WordActionsMenu`, `ConfirmDialog`, `useSpeaker`…), TanStack Query
- API: [conversations](../03-api/conversations.md), [agent](../03-api/agent.md), [assist](../03-api/assist.md), `/v1/phrases`, `/v1/tts`

## Dữ liệu & sự kiện

- Không lưu gì ở trình duyệt. Ghi event `phrase_saved` khi lưu từ trong chat (như các nơi lưu cụm từ khác).
- Không log nội dung tin nhắn.

## Câu hỏi mở

- Chưa có endpoint đọc `AgentQuota` nên không hiện "còn N lượt" trước khi hết.
- Các bộ thẻ `flashcards` cùng lắng nghe phím trên `window` (do `FlashcardDeck`); nếu một trang có nhiều bộ thẻ thì phím mũi tên và Space tác động lên tất cả.
- Chưa có test tương tác trong trình duyệt (repo chưa có jsdom): luồng gửi/dừng và menu được kiểm bằng hàm thuần và markup tĩnh; cần kiểm tay hoặc e2e (bước 14).
