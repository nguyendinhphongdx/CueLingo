# CueLingo

Trợ lý giao tiếp và học ngoại ngữ lấy AI làm trung tâm cho người đi làm: **giúp bạn giao tiếp trong cuộc họp hôm nay, và dạy bạn để ngày mai cần hỗ trợ ít hơn.**

MVP: app desktop macOS hiển thị caption Anh → Việt realtime trong mọi app họp, debrief sau họp, và ôn tập các cụm từ lấy từ chính cuộc họp của bạn.

## Cấu trúc repo

```
apps/
  desktop/      Tauri + React + Swift: overlay caption, Quick Assist, STT on-device   (MVP)
  web/          Next.js: thư viện cuộc họp, debrief, ôn tập, tiến bộ                    (MVP)
  docs/         Docusaurus: toàn bộ tài liệu, từ toàn cảnh đến từng module
  extension/    Browser extension                                                     (giai đoạn 2)
  mobile/       App mobile                                                            (giai đoạn 3)
services/
  api/          Fastify modular monolith: REST + WebSocket realtime                   (MVP)
  workers/      Job nền: debrief, Learner Model, TTS, dọn dữ liệu                     (MVP)
packages/
  shared/       Kiểu domain, schema API/WS, catalog event
  core-sdk/     SDK client cho desktop và web
  learner-model/ Logic Learner Model (FSRS, lexicon, Assist Dial)
  ai-gateway/   Trừu tượng hoá STT/LLM/TTS, routing, log chi phí
  agent/        Harness trợ lý AI không I/O (vòng lặp, công cụ, plugin)
  prompts/      Prompt có phiên bản + schema đầu ra
  ui/           Component React dùng chung
ml/
  bench/        Benchmark STT + dịch (đã chạy 31/10/2026)
  eval/         Bộ test hồi quy cho prompt/model
infra/          docker-compose (Postgres + pgvector, Redis), migration DB
```

## Tài liệu

Toàn bộ tài liệu ở `apps/docs` (Docusaurus): `pnpm docs:dev` → http://localhost:3100. Bắt đầu từ [Bức tranh toàn cảnh](apps/docs/docs/01-overview/01-big-picture.md). Làm việc với AI agent: đọc [AGENTS.md](AGENTS.md).

## Phát triển

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm verify   # format · lint · typecheck · test · luật kiến trúc
```

Module mẫu đã chạy thật: `glossary` (shared → api → core-sdk → web). Các module khác mới là khung (stub). Thứ tự triển khai theo [kế hoạch 12 tuần](apps/docs/docs/02-product/04-roadmap.md).
