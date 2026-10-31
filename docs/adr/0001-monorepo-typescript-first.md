# 0001 · Monorepo pnpm + Turborepo, TypeScript là chính

**Trạng thái:** Accepted · 2026-10-31

## Bối cảnh
Desktop (React trong Tauri), web (Next.js), API và workers cùng dùng chung kiểu dữ liệu, schema WebSocket, catalog event và logic Learner Model. Team nhỏ (3–4 người).

## Quyết định
- Một monorepo, pnpm workspaces + Turborepo: `apps/*`, `services/*`, `packages/*`.
- TypeScript cho app và backend để chia sẻ `@cuelingo/shared`, `@cuelingo/learner-model`, `@cuelingo/prompts`.
- Python chỉ dùng trong `ml/` (benchmark, eval). Không chạy trong production ở MVP.
- Code native: Swift (audio, STT trên macOS) và Rust (Tauri core) nằm trong `apps/desktop`.

## Hệ quả
- Đổi schema ở một chỗ, mọi bên đều thấy lỗi kiểu ngay.
- Nếu sau này cần pyannote/WhisperX cho debrief thì thêm một Python worker riêng (ADR mới).
