---
title: Tech stack
---

# Tech stack

Một ngôn ngữ chính (**TypeScript**) cho app, backend và package dùng chung. Native (**Swift, Rust**) chỉ dùng cho những gì bắt buộc phải native trên desktop. **Python** chỉ dùng cho ML/eval, không chạy trong production. Mỗi lựa chọn có trạng thái **Đã chốt** (có ADR Accepted hoặc đã có code chạy) hoặc **Đề xuất** (ADR Proposed, chờ duyệt).

Tiêu chí chọn, theo thứ tự ưu tiên: (1) phù hợp với quyền riêng tư và độ trễ realtime, (2) team 3–4 người vận hành được, (3) agent AI viết đúng được (công nghệ phổ biến, tài liệu tốt), (4) license dùng thương mại được.

## Nền tảng chung

| Thành phần        | Lựa chọn                                              | Trạng thái | Ghi chú                                                           |
| ----------------- | ----------------------------------------------------- | ---------- | ----------------------------------------------------------------- |
| Ngôn ngữ          | TypeScript 5 (strict, `noUncheckedIndexedAccess`)     | Đã chốt    | [ADR-0001](../08-adr/0001-monorepo-typescript-first.md)           |
| Runtime           | Node.js 24 LTS                                        | Đề xuất    | Repo đang yêu cầu ≥ 22; nâng lên 24 khi scaffold service đầu tiên |
| Monorepo          | pnpm workspaces + Turborepo                           | Đã chốt    | pnpm cho dependency, Turbo cho task                               |
| Schema / validate | Zod 4                                                 | Đã chốt    | Nguồn sự thật của contract (`@cuelingo/shared`)                   |
| Lint / format     | ESLint 10 (flat config) + typescript-eslint, Prettier | Đã chốt    |                                                                   |
| Luật kiến trúc    | dependency-cruiser                                    | Đã chốt    | `pnpm check:deps`                                                 |
| Test              | Vitest                                                | Đã chốt    | Unit + test HTTP qua `app.inject`                                 |
| Test tích hợp DB  | Testcontainers (Postgres)                             | Đề xuất    | Cho repository Postgres                                           |
| Test E2E web      | Playwright                                            | Đề xuất    | Từ giai đoạn Learn                                                |
| Git hooks / CI    | husky + lint-staged · GitHub Actions                  | Đã chốt    | `pnpm verify` + `pnpm docs:build`                                 |
| Tài liệu          | Docusaurus 3 + Mermaid                                | Đã chốt    | `apps/docs`                                                       |

## Desktop (`apps/desktop`)

| Thành phần         | Lựa chọn                                                        | Trạng thái | Ghi chú                                                        |
| ------------------ | --------------------------------------------------------------- | ---------- | -------------------------------------------------------------- |
| Shell              | Tauri 2 (Rust)                                                  | Đã chốt    | [ADR-0002](../08-adr/0002-desktop-tauri-swift.md)              |
| Audio + STT native | Swift: Core Audio Process Tap / ScreenCaptureKit, AVAudioEngine | Đã chốt    | macOS tối thiểu 13 hay 14.4: chưa chốt                         |
| STT on-device      | FluidAudio (CoreML) + Parakeet-TDT 0.6B v3                      | Đã chốt    | [ADR-0003](../08-adr/0003-stt-on-device-first.md)              |
| VAD                | Silero VAD (ONNX)                                               | Đã chốt    |                                                                |
| UI webview         | React 19 + Vite                                                 | Đã chốt    | Dùng chung UI với web — [ADR-0007](../08-adr/0007-ui-stack.md) |
| Phân phối          | Tauri updater + ký/notarize Apple                               | Đã chốt    |                                                                |

## Web (`apps/web`) và UI dùng chung (`@cuelingo/ui`)

| Thành phần     | Lựa chọn                                              | Trạng thái | Ghi chú                                     |
| -------------- | ----------------------------------------------------- | ---------- | ------------------------------------------- |
| Framework      | Next.js (App Router)                                  | Đã chốt    | [ADR-0007](../08-adr/0007-ui-stack.md)      |
| Styling        | Tailwind CSS 4                                        | Đã chốt    | Design tokens sáng/tối trong `@cuelingo/ui` |
| Component      | shadcn/ui (Radix primitives), copy vào `@cuelingo/ui` | Đã chốt    | Không phụ thuộc thư viện UI đóng            |
| Dữ liệu server | TanStack Query bọc `@cuelingo/core-sdk`               | Đã chốt    | Cache, retry, trạng thái tải                |
| State client   | Zustand (chỉ cho state phiên họp ở desktop)           | Đã chốt    | Web hầu như không cần                       |
| Form           | React Hook Form + Zod resolver                        | Đã chốt    | Dùng chung schema `@cuelingo/shared`        |

## Backend (`services/api`, `services/workers`)

| Thành phần        | Lựa chọn                                               | Trạng thái | Ghi chú                                                 |
| ----------------- | ------------------------------------------------------ | ---------- | ------------------------------------------------------- |
| HTTP              | Fastify 5                                              | Đã chốt    | Module mẫu `glossary` đang chạy                         |
| Realtime          | `@fastify/websocket`                                   | Đề xuất    | Một kết nối WS mỗi phiên họp                            |
| Truy cập DB       | postgres.js (SQL tagged template, không ORM)           | Đã chốt    | Repository viết SQL tay                                 |
| Migration         | dbmate (file `.sql` thuần trong `infra/db/migrations`) | Đã chốt    | [ADR-0009](../08-adr/0009-migrations-dbmate.md)         |
| Hàng đợi job      | pg-boss (trên Postgres)                                | Đã chốt    | [ADR-0005](../08-adr/0005-modular-monolith-postgres.md) |
| Auth              | Better Auth (self-host, Postgres)                      | Đã chốt    | [ADR-0008](../08-adr/0008-auth-better-auth.md)          |
| Spaced repetition | ts-fsrs                                                | Đã chốt    | Trong `@cuelingo/learner-model`                         |
| Chạy dev          | tsx                                                    | Đã chốt    |                                                         |

## AI (`@cuelingo/ai-gateway`, `@cuelingo/prompts`)

| Thành phần           | Lựa chọn                                                    | Trạng thái | Ghi chú                                                                   |
| -------------------- | ----------------------------------------------------------- | ---------- | ------------------------------------------------------------------------- |
| Lớp gọi LLM          | Vercel AI SDK (`ai`) bên trong gateway                      | Đã chốt    | [ADR-0010](../08-adr/0010-ai-gateway-on-ai-sdk.md)                        |
| Dịch realtime        | LLM nhỏ (cloud) hoặc TranslateGemma 4B / Qwen3-4B self-host | Đề xuất    | [ADR-0004](../08-adr/0004-translation-via-llm.md); chốt sau so sánh cloud |
| Debrief              | LLM mạnh (cloud)                                            | Đề xuất    | Chọn nhà cung cấp khi có ADR quyền riêng tư                               |
| STT cloud (dự phòng) | Chưa chọn                                                   | Mở         | So 1–2 nhà cung cấp trong benchmark streaming                             |
| TTS                  | Kokoro (EN) / VieNeu-TTS (VI) self-host, hoặc TTS cloud     | Mở         | Chỉ cần cho thẻ ôn, có cache                                              |
| Eval                 | Python + uv, COMET, LLM-as-judge (`ml/eval`)                | Đã chốt    |                                                                           |

## Dữ liệu & hạ tầng

| Thành phần     | Lựa chọn                                                      | Trạng thái | Ghi chú                                                |
| -------------- | ------------------------------------------------------------- | ---------- | ------------------------------------------------------ |
| Database       | PostgreSQL 16 + pgvector                                      | Đã chốt    | Một DB duy nhất cho MVP                                |
| Object storage | S3-compatible (Cloudflare R2 hoặc S3)                         | Đã chốt    | Chỉ audio người dùng cho phép + cache TTS              |
| Local dev      | Docker Compose (Postgres, Redis dự phòng)                     | Đã chốt    | `infra/docker-compose.yml`                             |
| Triển khai     | Container (API, workers) + Postgres managed, region Singapore | Đã chốt    | [ADR-0011](../08-adr/0011-deployment-containers-sg.md) |
| Quan sát       | OpenTelemetry + Sentry · PostHog (product analytics)          | Đề xuất    | Không gửi transcript vào công cụ quan sát              |

## Không chọn (và vì sao)

| Không chọn            | Vì sao                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------- |
| Electron              | Nặng RAM khi chạy song song app họp ([ADR-0002](../08-adr/0002-desktop-tauri-swift.md)) |
| ORM (Prisma, TypeORM) | SQL đơn giản, cần kiểm soát query lọc theo user; bớt một lớp agent dễ dùng sai          |
| Kafka / Redis queue   | pg-boss đủ cho MVP, bớt một hệ thống phải vận hành                                      |
| NLLB, Seamless, XTTS  | License cấm thương mại ([Open source](../07-research/01-open-source.md))                |
| Microservices         | Team nhỏ; modular monolith + luật phụ thuộc là đủ ranh giới                             |
