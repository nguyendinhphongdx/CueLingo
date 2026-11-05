# AGENTS.md — packages/agent

Harness của trợ lý AI: vòng lặp "nghĩ → gọi công cụ → trả lời". Quyết định: [ADR 0018](../../apps/docs/docs/08-adr/0018-agent-harness.md). Thiết kế: [agent](../../apps/docs/docs/04-modules/05-packages/agent.md).

- **Không I/O** (máy kiểm, luật `agent-has-no-io`): không fs, mạng, DB, không SDK AI, không `ai-gateway`/`prompts`. Mô hình, công cụ và khoá được **tiêm vào** (`ModelPort`, `AgentPlugin`); API nối chúng với gateway và repository.
- Bốn phần tách riêng, mỗi phần một file và một file test: `model.ts` (cổng mô hình), `context.ts` (cắt ngữ cảnh), `tools.ts` + `plugin.ts` (công cụ), `loop.ts` (`runTurn`). Thay mô hình hoặc thêm công cụ không được chạm phần khác.
- Test dùng `ModelPort` giả; không gọi mạng. Hằng số (số bước, timeout, cỡ output) có tên ở `limits.ts`.
- Lỗi công cụ không bao giờ kèm nội dung lỗi gốc hay dữ liệu người dùng ra ngoài: chỉ một câu tiếng Việt.
- **Package mới / mở rộng:** [workspace-package](../../apps/docs/docs/05-engineering/scaffold/01-workspace-package.md). Quy trình AI: [ai-task](../../apps/docs/docs/05-engineering/workflows/ai-task.md).
