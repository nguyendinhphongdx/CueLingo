# @cuelingo/agent

> Phần: [Shared packages](./README.md) · Code: `packages/agent/src/` · Quyết định: [ADR 0018](../../08-adr/0018-agent-harness.md) · Hồ sơ: [ai-agent](../../06-delivery/2026-11-05-ai-agent/02-plan.md)

Harness của trợ lý AI, **không I/O**: cổng mô hình, cắt ngữ cảnh, công cụ/plugin và vòng lặp một lượt "nghĩ → gọi công cụ → trả lời".

## Trách nhiệm

Bốn phần tách riêng, mỗi phần một file và một file test (AC18):

| Phần     | File                                   | Việc                                                                                                       |
| -------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Mô hình  | `model.ts`                             | `ModelPort.step(input)` stream một bước. API nối `ai-gateway.chat()` vào đây; thay mô hình chỉ đổi adapter |
| Ngữ cảnh | `context.ts`                           | `buildContext`: cắt theo ngân sách token bằng quy tắc cố định                                              |
| Công cụ  | `tools.ts`, `plugin.ts`, `registry.ts` | `defineTool`, `runTool` (an toàn), `AgentPlugin`, `createToolRegistry` (registry lúc chạy, cầu dao)        |
| Vòng lặp | `loop.ts`                              | `runTurn`: async generator phát `AgentStreamEvent` của `@cuelingo/shared`                                  |

Thêm: `parts.ts` (`createPartsBuilder`, gộp event thành `parts` để lưu tin nhắn), `limits.ts` (hằng số).

## Phạm vi MVP

- Lô 1 của hồ sơ ai-agent: vòng lặp, công cụ, đăng ký/gỡ plugin. Lô 2: registry lúc chạy đầy đủ (trạng thái `loaded/failed/disabled`, bật/tắt, kiểm quyền, cầu dao).

## Interface

```ts
// model.ts
interface ModelPort { step(input: ModelStepInput): AsyncIterable<ModelEvent> }
// ModelStepInput = { language, messages: ModelMessage[], tools: ModelToolDeclaration[], signal }
// ModelEvent = text_delta | tool_call{call:{id,name,input}} | finish{reason, inputTokens?, outputTokens?}

// loop.ts
function runTurn<C>(input: TurnInput<C>): AsyncGenerator<AgentStreamEvent, void, void>
// TurnInput = { model, registry, history, userMessage, language, capabilities, signal?, limits?, hooks?, reservedTokens? }

// context.ts
function buildContext({ history, budgetTokens, reservedTokens? }): { messages, droppedTurns, estimatedTokens }

// tools.ts
function defineTool<C, I, O>({ name, description, kind: 'read' | 'write', input, output, run, toCard?, summarize? }): AgentTool<C>
function runTool(tool, rawInput, { capabilities, signal }, { timeoutMs?, maxOutputBytes? }): Promise<ToolRunResult>

// plugin.ts
interface AgentPlugin<C> { id; version; permissions: AgentPermission[]; tools: AgentTool<C>[]; cardKinds?; setup?(host) }
interface PluginStatus { id; version; state: 'loaded' | 'failed' | 'disabled'; permissions; tools: string[]; disabledBy?: 'admin' | 'breaker'; retryAt? }

// registry.ts
function createToolRegistry<C>({ scope?, clock?, breaker? }): ToolRegistry<C>
// register · unregister · enable · disable · tools · get · list · execute
```

**`runTurn`**

- Luôn kết thúc bằng đúng một `done`, không ném lỗi. Thứ tự: `status{thinking}` (đầu mỗi bước) → `text_delta`\* → `tool_call` → `tool_result` → `card`? → … → `done`.
- `done.status`: `complete` (mô hình trả lời không gọi công cụ), `stopped` (người dùng abort), `limited` (hết 6 bước, 8 lần gọi công cụ, hết 60 giây hoặc `hooks.beforeStep` trả `false`, ví dụ hết quota), `error` (bước mô hình lỗi: phát `error{AGENT_FAILED}` trước `done`).
- Mặc định (`DEFAULT_LIMITS`): 6 bước, tối đa 8 lần gọi tool mỗi lượt (cả tool đọc; vượt thì `done{limited}`), 3 lần gọi tool ghi (lần thứ 4 trở đi nhận `tool_result{ok:false}` "Đã đạt giới hạn…" mà không chạy), 60 giây một lượt, ngân sách ngữ cảnh 24k token, tool 8 giây.
- Mỗi lời gọi tool nhận `callId` do vòng lặp đặt (`s<bước>c<thứ tự>`), không dùng id của mô hình, nên luôn duy nhất và khớp cặp call/result.
- `hooks.beforeStep(step)` để API kiểm quota trước mỗi bước; `hooks.afterStep({step, inputTokens, outputTokens})` để cộng token.

**`runTool`** không bao giờ ném: kiểm input bằng Zod, chạy với `AbortSignal` gộp (abort của lượt + timeout), kiểm output bằng Zod, cắt output vào ngữ cảnh còn ≤ 2 KB (UTF-8; quá thì thành JSON `{truncated:true, preview}` vẫn hợp lệ). Mọi lỗi (`unknown_tool`, `invalid_input`, `timeout`, `aborted`, `failed`, `invalid_output`, `limit`) thành `ok:false` kèm **một câu tiếng Việt** (`TOOL_ERRORS_VI`); nội dung lỗi gốc không đi ra ngoài. `toCard` (nếu có) được kiểm bằng `AgentCardSchema` trước khi thành event `card`.

**`buildContext`**: gom tin thành lượt (mỗi lượt bắt đầu ở tin `user`); bỏ lượt **cũ nhất** nguyên vẹn đến khi vừa ngân sách; luôn giữ lượt cuối kể cả khi vượt; cặp call/result không bị tách, call không có result (hoặc ngược lại) bị loại. Ước lượng 4 ký tự ≈ 1 token. System prompt do gateway thêm nên truyền kích thước vào `reservedTokens`.

**`ToolRegistry`** (`registry.ts`, runtime của plugin nội bộ, [ADR 0018](../../08-adr/0018-agent-harness.md)):

- **Trạng thái.** `loaded` (đã nạp, đang bật), `failed` (`setup` ném lỗi, trùng tên tool hoặc trùng `id` plugin đã nạp; `enable` không cứu được), `disabled` (admin tắt, hoặc cầu dao tắt tạm; `disabledBy` cho biết, `retryAt` là lúc thử lại). `register` không bao giờ ném: plugin hỏng thành `failed`, plugin khác chạy bình thường (AC17).
- **Danh sách gửi mô hình.** `tools()`/`get()` chỉ gồm plugin `loaded`, theo thứ tự đăng ký. `register`/`unregister`/`enable`/`disable` đổi danh sách ngay ở lượt sau, không chạm lõi (AC16). `list()` trả mọi plugin kèm quyền và tên tool cho màn admin.
- **Quyền.** Plugin chỉ nhận `ctx.capabilities` đã dựng sẵn cho người dùng (không `userId`, không SQL). `execute` đưa capabilities qua `options.scope(capabilities, plugin.permissions)` nên một tool chỉ chạm được thứ plugin của nó khai báo trong `permissions`.
- **Cầu dao.** `execute(name, input, ctx)` chạy `runTool` rồi ghi kết quả: `failed`/`timeout`/`invalid_output` tính là lỗi, input sai của mô hình hoặc người dùng dừng thì không. 3 lỗi liên tiếp của một tool (thành công thì đếm lại) tắt **cả plugin** 10 phút (`BREAKER` trong `limits.ts`). Hết hạn là nửa mở: lượt gọi kế tiếp là thử, thành công thì đóng, lỗi thì mở lại ngay 10 phút. `enable` của admin xoá cầu dao. Đồng hồ tiêm được (`clock`) để test.
- `runTurn` gọi `registry.execute` nên cầu dao và kiểm quyền áp dụng cho mọi tool mà không cần plugin biết.

## Phụ thuộc

- `@cuelingo/shared` (kiểu event, thẻ, mã lỗi) và `zod`. Không gì khác.
- Luật `agent-has-no-io` trong `.dependency-cruiser.cjs`: cấm fs/mạng/DB, SDK AI và import `ai-gateway`, `prompts`, `core-sdk`, `learner-model`, `ui`.

## Dữ liệu & sự kiện

- Không lưu gì. Người gọi lưu `parts` (qua `createPartsBuilder`) và ghi `ai_call` (gateway). Không log nội dung tin nhắn hay output tool.

## Câu hỏi mở

- Trạng thái bật/tắt và cầu dao nằm trong bộ nhớ, mất khi khởi động lại (chấp nhận với một container, ADR 0011).
