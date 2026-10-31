# CueLingo

Trợ lý giao tiếp và học ngoại ngữ lấy AI làm trung tâm cho người đi làm: **giúp bạn giao tiếp trong cuộc họp hôm nay, và dạy bạn để ngày mai cần hỗ trợ ít hơn.**

MVP: app desktop macOS hiển thị caption Anh → Việt realtime trong mọi app họp, debrief sau họp, và ôn tập các cụm từ lấy từ chính cuộc họp của bạn.

## Cấu trúc repo

```
apps/
  desktop/      Tauri + React + Swift: overlay caption, Quick Assist, STT on-device   (MVP)
  web/          Next.js: thư viện cuộc họp, debrief, ôn tập, tiến bộ                    (MVP)
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
  prompts/      Prompt có phiên bản + schema đầu ra
  ui/           Component React dùng chung
ml/
  bench/        Benchmark STT + dịch (đã chạy 31/10/2026)
  eval/         Bộ test hồi quy cho prompt/model
infra/          docker-compose (Postgres + pgvector, Redis), migration DB
docs/           Tài liệu: tổng quan → kiến trúc → từng phần → từng module
```

## Tài liệu

Bắt đầu từ [docs/README.md](docs/README.md).

## Phát triển

```bash
pnpm install
docker compose -f infra/docker-compose.yml up -d
pnpm dev
```

Các package hiện mới là khung (stub). Thứ tự triển khai theo [kế hoạch 12 tuần](docs/01-product/roadmap.md).
