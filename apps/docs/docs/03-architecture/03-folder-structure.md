---
title: Tổ chức thư mục
---

# Tổ chức thư mục

Cây thư mục **đích** của repo và **thứ tự dựng dần**. Thư mục chỉ được tạo khi có code thật đầu tiên. Không tạo thư mục rỗng để "chờ", và thư mục mới copy cấu trúc từ module mẫu.

Ký hiệu: ✅ đã có code chạy · 🟡 đã có khung (stub) · ⬜ sẽ tạo (kèm giai đoạn dựng).

## Gốc repo

```text
cuelingo/
├── apps/
│   ├── desktop/        🟡 Tauri + React + Swift — app trong cuộc họp
│   ├── web/            ✅ Next.js — xem lại, debrief, ôn tập (feature mẫu: glossary)
│   ├── docs/           ✅ Docusaurus — toàn bộ tài liệu
│   ├── extension/      ⬜ giai đoạn Learn
│   └── mobile/         ⬜ giai đoạn Coach
├── services/
│   ├── api/            ✅ Fastify modular monolith (module mẫu: glossary)
│   └── workers/        🟡 pg-boss jobs
├── packages/
│   ├── shared/         ✅ Zod contract, ErrorCode
│   ├── core-sdk/       ✅ client có kiểu
│   ├── learner-model/  🟡 logic thuần: FSRS, giai đoạn, Assist Dial
│   ├── ai-gateway/     🟡 STT/LLM/TTS provider, routing, chi phí
│   ├── prompts/        🟡 prompt có phiên bản
│   └── ui/             🟡 design system dùng chung
├── ml/                 ✅ bench (đã chạy) · 🟡 eval
├── infra/              ✅ docker-compose, db/migrations
├── .claude/            ✅ harness agent
├── .github/workflows/  ✅ CI
└── AGENTS.md · CLAUDE.md · package.json · turbo.json · tsconfig.base.json · eslint/prettier/dependency-cruiser
```

## `services/api`

```text
services/api/
├── src/
│   ├── server.ts                 ✅ đọc env, tạo DB client, listen
│   ├── app.ts                    ✅ composition root — nối repository → service → routes
│   ├── config.ts                 ⬜ (Nền móng) parse env bằng Zod, một chỗ duy nhất
│   ├── lib/
│   │   ├── errors.ts             ✅ AppError + error handler
│   │   ├── http.ts               ✅ parse(schema, data)
│   │   ├── auth.ts               ✅ hook userId (tạm: dev header)
│   │   ├── db.ts                 ✅ postgres.js client
│   │   └── queue.ts              ⬜ (Nền móng) pg-boss client để enqueue
│   └── modules/
│       ├── glossary/             ✅ MODULE MẪU
│       │   ├── index.ts · glossary.routes.ts · glossary.service.ts
│       │   ├── glossary.repository.ts · glossary.repository.memory.ts
│       │   └── glossary.test.ts
│       ├── auth/                 ⬜ (Nền móng) Better Auth handler + session → userId
│       ├── sessions/             🟡 (tuần 2–5)
│       ├── realtime/             🟡 (tuần 2–5) WS: hello · segment.final · translation
│       ├── assist/               🟡 (tuần 5–6)
│       ├── events/               🟡 (tuần 2–5)
│       ├── debrief/              🟡 (tuần 5–8)
│       ├── review/               🟡 (tuần 7–9) phrases + review
│       ├── learner/              🟡 (tuần 8–10)
│       ├── progress/             🟡 (tuần 8–10)
│       └── privacy/              🟡 (tuần 9–10)
├── test/integration/             ⬜ (Nền móng) repository Postgres với Testcontainers
└── package.json · tsconfig.json · CLAUDE.md · README.md
```

## `services/workers`

```text
services/workers/
└── src/
    ├── worker.ts                 ⬜ (Nền móng) khởi động pg-boss, đăng ký job
    ├── lib/                      ⬜ dùng chung giữa job (db, logger)
    └── jobs/<job>/
        ├── index.ts              🟡 đăng ký: tên job, schema payload (Zod), handler
        ├── <job>.handler.ts      ⬜ logic, idempotent
        └── <job>.test.ts         ⬜
            # debrief (tuần 5–8) · learner-recompute (8–10) · tts-cache (7–9) · retention (9–10)
```

## `apps/web`

```text
apps/web/
├── src/
│   ├── app/                      ⬜ (Nền móng) Next.js App Router: chỉ route + layout, render component từ features
│   │   ├── (auth)/login/
│   │   └── (app)/{library,sessions/[id]/debrief,review,phrases,progress,glossary,settings}/
│   ├── features/<x>/             ✅ glossary (MẪU) · 🟡 library, debrief, review, phrase-bank, progress, account
│   │   ├── index.ts · <X>Page.tsx · use-<x>.ts · <x>.test.tsx
│   └── lib/
│       ├── client.ts             ✅ API client duy nhất
│       └── query.ts              ⬜ (Nền móng) TanStack Query provider
└── next.config.ts · package.json · CLAUDE.md
```

## `apps/desktop`

```text
apps/desktop/
├── src/                          React UI (Vite)
│   ├── main.tsx                  ⬜ (tuần 1–4) entry, router cửa sổ: overlay · menubar · settings
│   ├── session/                  🟡 store phiên họp (Zustand) + kết nối WS
│   ├── overlay/ · quick-assist/ · onboarding/ · settings/   🟡
│   └── lib/{client.ts,native.ts} ⬜ core-sdk + wrapper Tauri command/event có kiểu (Zod)
├── src-tauri/                    Rust
│   ├── src/
│   │   ├── lib.rs                🟡 khởi tạo app, đăng ký command/plugin
│   │   ├── commands.rs           ⬜ session_start · session_stop · permissions_status · set_assist_level
│   │   ├── windows.rs            ⬜ overlay luôn nổi, ẩn khi chia sẻ màn hình
│   │   ├── hotkeys.rs            ⬜ ⌘⇧L · ⌘⇧W · ⌘⇧S
│   │   └── audio_bridge.rs       ⬜ cầu nối Swift ↔ Rust ↔ webview
│   ├── tauri.conf.json · Cargo.toml · capabilities/
└── native/macos-audio/           Swift Package
    ├── Package.swift             ⬜
    ├── Sources/AudioCapture/     🟡 Process Tap / SCK + mic + VAD
    ├── Sources/LocalSTT/         🟡 FluidAudio Parakeet
    ├── Sources/Bridge/           ⬜ C ABI cho Rust
    └── Tests/
```

## `packages/*`

| Package         | Cấu trúc `src/`                                                                                                   | Trạng thái                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| `shared`        | `dto/<x>.dto.ts` · `errors/` · `events/<event>.ts` · `ws/messages.ts` · `index.ts`                                | ✅ dto, errors · ⬜ events, ws (tuần 2–5) |
| `core-sdk`      | `http.ts` · `<resource>.ts` · `stream.ts` (WS, reconnect, đệm 60 s) · `events.ts` (hàng đợi offline) · `index.ts` | ✅ http, glossary · ⬜ stream, events     |
| `learner-model` | `fsrs/` · `lexicon/` · `comprehension.ts` · `assist-dial.ts` · `apply-event.ts` · `constants.ts`                  | 🟡                                        |
| `ai-gateway`    | `providers/<x>.ts` · `tasks.ts` (task → model, timeout, fallback) · `cost.ts` · `index.ts`                        | 🟡                                        |
| `prompts`       | `<task>/v<n>.ts` (build + schema đầu ra) · `<task>/fixtures/`                                                     | 🟡                                        |
| `ui`            | `tokens.css` · `components/<Component>.tsx` (shadcn) · `index.ts`                                                 | 🟡                                        |

## Lộ trình dựng dần

| Giai đoạn                         | Dựng gì                                                                                                                                                                                                                                                         | Kết quả kiểm chứng được                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **0 · Khung + harness**           | Monorepo, harness agent, module mẫu `glossary`, docs                                                                                                                                                                                                            | ✅ xong — `pnpm verify`, `pnpm docs:build` xanh                                                                                       |
| **1 · Nền móng** (tuần 1–2)       | `config.ts` + migration bằng dbmate · `auth` (Better Auth) thay header dev · `worker.ts` + `lib/queue.ts` · Next.js App Router + `@cuelingo/ui` (Tailwind, shadcn) + TanStack Query · scaffold Tauri + Swift package rỗng chạy được · integration test Postgres | Đăng nhập thật trên web; trang Glossary chạy trên Next.js với DB thật; app desktop mở được overlay rỗng; một job mẫu chạy qua pg-boss |
| **2 · Đường realtime** (tuần 1–6) | audio-capture → local-stt → `shared/ws` → `realtime` → `ai-gateway` (translate) → overlay; `sessions`, `events`, quick-assist                                                                                                                                   | Caption song ngữ trong một cuộc gọi Zoom thật; alpha nội bộ tuần 6                                                                    |
| **3 · Vòng học** (tuần 5–10)      | `debrief` job + trang · `review` + `learner-model` (FSRS) · `progress` · `privacy` + `retention`                                                                                                                                                                | Debrief sau họp; ôn tập; xoá dữ liệu hoạt động                                                                                        |
| **4 · Beta** (tuần 10–12)         | Đo độ trễ, eval, onboarding                                                                                                                                                                                                                                     | Closed beta                                                                                                                           |

Mỗi giai đoạn đi qua skill `task-loop` (spec → plan → làm → review). Lịch theo tuần: [Lộ trình](../02-product/04-roadmap.md).
