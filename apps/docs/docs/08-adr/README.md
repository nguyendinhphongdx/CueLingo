# Architecture Decision Records

Mỗi quyết định khó đảo ngược có một ADR: bối cảnh, quyết định, hệ quả. Không sửa ADR đã chấp nhận. Muốn đổi thì viết ADR mới và đánh dấu ADR cũ là "Superseded by NNNN".

| #                                           | Quyết định                                                             | Trạng thái |
| ------------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| [0001](./0001-monorepo-typescript-first.md) | Monorepo pnpm + Turborepo, TypeScript là chính, Python chỉ trong `ml/` | Accepted   |
| [0002](./0002-desktop-tauri-swift.md)       | Desktop: Tauri 2 + module Swift cho audio/STT trên macOS               | Accepted   |
| [0003](./0003-stt-on-device-first.md)       | STT on-device (Parakeet) mặc định, cloud dự phòng                      | Accepted   |
| [0004](./0004-translation-via-llm.md)       | Dịch bằng LLM qua `ai-gateway`, chốt model sau khi so với cloud        | Proposed   |
| [0005](./0005-modular-monolith-postgres.md) | Backend modular monolith + Postgres, event log là nguồn sự thật        | Accepted   |
| [0006](./0006-no-audio-by-default.md)       | Mặc định không lưu audio                                               | Accepted   |
| [0007](0007-ui-stack.md)                    | UI: React + Next.js + Tailwind + shadcn/ui + TanStack Query            | Accepted   |
| [0008](0008-auth-better-auth.md)            | Auth: Better Auth self-host trên Postgres                              | Accepted   |
| [0009](0009-migrations-dbmate.md)           | Migration: dbmate với file SQL thuần                                   | Accepted   |
| [0010](0010-ai-gateway-on-ai-sdk.md)        | AI gateway xây trên Vercel AI SDK                                      | Accepted   |
| [0011](0011-deployment-containers-sg.md)    | Triển khai: container + Postgres managed, region Singapore             | Accepted   |
