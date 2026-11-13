# Architecture Decision Records

Mỗi quyết định khó đảo ngược có một ADR: bối cảnh, quyết định, hệ quả. Không sửa ADR đã chấp nhận. Muốn đổi thì viết ADR mới và đánh dấu ADR cũ là "Superseded by NNNN".

| #                                                     | Quyết định                                                                       | Trạng thái |
| ----------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- |
| [0001](./0001-monorepo-typescript-first.md)           | Monorepo pnpm + Turborepo, TypeScript là chính, Python chỉ trong `ml/`           | Accepted   |
| [0002](./0002-desktop-tauri-swift.md)                 | Desktop: Tauri 2 + module Swift cho audio/STT trên macOS                         | Accepted   |
| [0003](./0003-stt-on-device-first.md)                 | STT on-device (Parakeet) mặc định, cloud dự phòng                                | Accepted   |
| [0004](./0004-translation-via-llm.md)                 | Dịch bằng LLM qua `ai-gateway`, chốt model sau khi so với cloud                  | Proposed   |
| [0005](./0005-modular-monolith-postgres.md)           | Backend modular monolith + Postgres, event log là nguồn sự thật                  | Accepted   |
| [0006](./0006-no-audio-by-default.md)                 | Mặc định không lưu audio                                                         | Accepted   |
| [0007](0007-ui-stack.md)                              | UI: React + Next.js + Tailwind + shadcn/ui + TanStack Query                      | Accepted   |
| [0008](0008-auth-better-auth.md)                      | Auth: Better Auth self-host trên Postgres                                        | Accepted   |
| [0009](0009-migrations-dbmate.md)                     | Migration: dbmate với file SQL thuần                                             | Accepted   |
| [0010](0010-ai-gateway-on-ai-sdk.md)                  | AI gateway xây trên Vercel AI SDK                                                | Accepted   |
| [0011](0011-deployment-containers-sg.md)              | Triển khai: container + Postgres managed, region Singapore                       | Accepted   |
| [0012](0012-realtime-transport.md)                    | Đường realtime: WebSocket trực tiếp ở M1, Centrifugo cho pub/sub về sau          | Accepted   |
| [0013](0013-multi-language.md)                        | Đa ngôn ngữ: ngôn ngữ theo từng cuộc họp, dữ liệu học theo từng ngôn ngữ         | Proposed   |
| [0014](0014-cloud-stt-for-vietnamese.md)              | Nhận dạng đám mây cho ngôn ngữ chưa có model trên máy (tiếng Việt)               | Accepted   |
| [0015](0015-email-provider-resend.md)                 | Email đăng nhập (magic link) gửi qua Resend                                      | Accepted   |
| [0016](0016-cloud-stt-for-japanese-korean-chinese.md) | Nhận dạng đám mây cho tiếng Nhật, Hàn, Trung                                     | Accepted   |
| [0017](0017-beta-distribution-adhoc-updater.md)       | Phát hành beta: ký ad-hoc, GitHub Releases, tự cập nhật Tauri                    | Accepted   |
| [0018](0018-agent-harness.md)                         | Agent harness: package `@cuelingo/agent`, SSE, plugin nội bộ                     | Accepted   |
| [0019](0019-ai-generated-ui.md)                       | Giao diện do AI sinh ra: thẻ JSON trước, HTML/JS trong hộp cát sau               | Accepted   |
| [0020](0020-windows-capture-stt.md)                   | Windows: sidecar Rust, WASAPI loopback, Parakeet ONNX trên CPU                   | Proposed   |
| [0021](0021-windows-release-inno.md)                  | Phát hành Windows: Inno Setup per-user, chưa ký mã, một release cho hai nền tảng | Proposed   |
