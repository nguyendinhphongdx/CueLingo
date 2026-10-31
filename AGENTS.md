# AGENTS.md — CueLingo

Nguồn sự thật duy nhất cho mọi coding agent (Claude Code, Cursor, Codex…) và người làm việc trong repo, theo chuẩn [agents.md](https://agents.md). `CLAUDE.md` chỉ trỏ về đây.

## Repo là gì

CueLingo: trợ lý giao tiếp + học ngoại ngữ lấy AI làm trung tâm. MVP là app desktop macOS hiển thị caption Anh → Việt trong mọi app họp, debrief sau họp và ôn tập cụm từ từ chính cuộc họp. Monorepo TypeScript (pnpm + Turborepo); Swift/Rust trong `apps/desktop`; Python chỉ trong `ml/`. Node ≥ 22, **pnpm** (không npm/yarn).

```text
apps/       desktop (Tauri+React+Swift) · web (Next.js) · docs (Docusaurus — toàn bộ tài liệu) · extension, mobile (chưa làm)
services/   api (Fastify modular monolith) · workers (pg-boss jobs)
packages/   shared · core-sdk · learner-model · ai-gateway · prompts · ui
ml/         bench · eval (Python)        infra/  docker-compose, db/migrations
apps/docs/docs/  01 tổng quan → 02 sản phẩm → 03 kiến trúc → 04 phần & module → 05 engineering → 06 delivery → 07 nghiên cứu → 08 adr
.claude/    settings, hooks, skills, agents, commands (harness Claude Code)
```

Mỗi phần có `CLAUDE.md` (quy ước riêng) và `README.md`. Đọc cả hai trước khi sửa code trong phần đó.

## Đọc gì trước khi làm

| Câu hỏi                                    | Đọc                                                                                                              |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Sản phẩm này là gì, toàn cảnh              | [apps/docs/docs/01-overview/01-big-picture.md](apps/docs/docs/01-overview/01-big-picture.md)                     |
| Tính năng mới đặt ở đâu                    | [apps/docs/docs/05-engineering/01-extension-points.md](apps/docs/docs/05-engineering/01-extension-points.md)     |
| Quy ước code của tầng mình sửa             | [apps/docs/docs/05-engineering/README.md](apps/docs/docs/05-engineering/README.md) → convention + **module mẫu** |
| Module này làm gì, interface ra sao        | `apps/docs/docs/04-modules/<part>/<module>.md`                                                                   |
| Luồng realtime, Learner Model, AI, dữ liệu | [apps/docs/docs/03-architecture](apps/docs/docs/03-architecture)                                                 |
| Phạm vi MVP, user story, AC                | [apps/docs/docs/02-product/03-mvp-scope.md](apps/docs/docs/02-product/03-mvp-scope.md)                           |
| Vì sao chọn X                              | [apps/docs/docs/08-adr](apps/docs/docs/08-adr)                                                                   |
| Thuật ngữ                                  | [apps/docs/docs/01-overview/05-glossary.md](apps/docs/docs/01-overview/05-glossary.md)                           |

> **Đừng đoán từ kiến thức chung.** Repo có quyết định riêng. Khi doc và module mẫu vênh nhau, module mẫu thắng và phải sửa doc.

**Thứ tự ưu tiên khi xung đột:** `apps/docs/docs/05-engineering` > `CLAUDE.md` của phần > file này.

## Module mẫu (copy cấu trúc, không tự nghĩ layout)

| Tầng        | Mẫu                                       |
| ----------- | ----------------------------------------- |
| API module  | `services/api/src/modules/glossary/`      |
| Contract    | `packages/shared/src/dto/glossary.dto.ts` |
| Client      | `packages/core-sdk/src/glossary.ts`       |
| Web feature | `apps/web/src/features/glossary/`         |

## Luật cứng

1. **Không làm vượt phạm vi spec/AC.** Chưa có spec → hỏi hoặc đề xuất, không tự quyết.
2. **Một tính năng = một điểm mở rộng.** Không vừa ô nào → dừng, đề xuất ADR.
3. **`userId` chỉ từ auth context**; mọi query lọc theo user; mỗi module API có test ranh giới người dùng.
4. **Contract ở `@cuelingo/shared`** (Zod là nguồn sự thật). Không khai báo lại type ở app/service.
5. **Mọi lời gọi AI qua `@cuelingo/ai-gateway`**; prompt có phiên bản ở `@cuelingo/prompts`.
6. **`@cuelingo/learner-model` là logic thuần**, không I/O.
7. **Migration chỉ thêm file mới**, không sửa file đã chạy.
8. **Quyền riêng tư:** không log transcript/audio/token; không lưu audio nếu người dùng chưa bật; nhà cung cấp mới nhận dữ liệu → ADR.
9. **Spec ↔ code đồng bộ:** đổi interface/dữ liệu của module → sửa trang module trong `apps/docs/docs/04-modules/` trong cùng commit. Tài liệu chỉ nằm trong `apps/docs/docs/` ([cách viết](apps/docs/docs/05-engineering/conventions/writing-docs.md)).
10. **UI tiếng Việt; code, comment, commit tiếng Anh. Docs tiếng Việt.**

Luật 2–7 phần lớn được **máy kiểm** (`pnpm check:deps`, ESLint, typecheck). Vi phạm là CI đỏ.

## Cách làm việc

- **Phân loại task** trước. Vặt (1–2 file, không đụng contract/schema/AI/quyền riêng tư) → code thẳng rồi `pnpm verify`. Còn lại → skill **`task-loop`**: hồ sơ `apps/docs/docs/06-delivery`, ba cổng duyệt (spec, plan, kết quả).
- **Plan trước** cho task ≥ 3 file hoặc ≥ 3 bước (`/plan`).
- **Thay đổi tối thiểu.** Không refactor "tiện thể". Đi qua [lazy-coding](apps/docs/docs/05-engineering/conventions/lazy-coding.md) trước khi viết code mới.
- **Ghi rõ giả định** khi spec mơ hồ (trong hồ sơ hoặc commit).
- **Verify trước khi báo xong:** `pnpm verify` xanh **và** chạy thật luồng vừa sửa. Sửa docs → `pnpm docs:build` xanh. Native: thử trên máy với một cuộc gọi thật.

## Lệnh

```bash
pnpm install
pnpm verify                     # format:check · lint · typecheck · test · check:deps
pnpm test                       # vitest
pnpm check:deps                 # luật phụ thuộc kiến trúc
pnpm format                     # prettier
pnpm docs:dev                   # tài liệu: http://localhost:3100
pnpm docs:build                 # build docs + kiểm link hỏng — chạy khi sửa docs
docker compose -f infra/docker-compose.yml up -d
pnpm --filter @cuelingo/api dev # DATABASE_URL=… DEV_AUTH=1
```

## Harness Claude Code (`.claude/`)

| Loại    | Tên                                    | Dùng khi                                                         |
| ------- | -------------------------------------- | ---------------------------------------------------------------- |
| Skill   | `task-loop`                            | Task không đơn giản: spec → plan → làm → review, có cổng duyệt   |
| Skill   | `new-module`                           | Thêm API module / web feature từ module mẫu                      |
| Skill   | `contract-sync`                        | Thêm/đổi schema ở `@cuelingo/shared` và đồng bộ api, client, app |
| Skill   | `ai-task`                              | Thêm tác vụ AI: prompt + gateway + eval                          |
| Skill   | `git-commit`                           | Commit theo Conventional Commits                                 |
| Agent   | `solution-architect`                   | Lập plan cho task lớn (không viết code)                          |
| Agent   | `ts-engineer`                          | Code TypeScript theo plan đã duyệt                               |
| Agent   | `native-engineer`                      | Code Swift/Rust trong `apps/desktop`                             |
| Agent   | `code-reviewer`                        | Review độc lập trước khi commit                                  |
| Agent   | `docs-explorer`                        | Đọc nhiều tài liệu, trả về bản tóm tắt                           |
| Command | `/plan` `/review` `/new-module` `/adr` | Lối tắt cho người dùng                                           |

## Khi nào phải hỏi người

DB schema · xoá dữ liệu · bảo mật / quyền riêng tư · nhà cung cấp AI hoặc dịch vụ mới · breaking API · đổi stack/framework · spec có ≥ 2 cách hiểu hợp lý · push, tạo PR, mọi hành động ra ngoài repo.

## Không được làm

- ❌ Đoán API/kiến trúc từ kiến thức chung khi docs đã quyết khác.
- ❌ Lấy `userId` từ body/params; bỏ qua lọc theo user "tạm thời".
- ❌ Import SDK AI, `fetch` trực tiếp trong app, hoặc import chéo `services/*` ↔ `apps/*`.
- ❌ Sửa migration đã chạy, sửa prompt version đã dùng.
- ❌ Commit `.env`, secret, `node_modules`, dữ liệu/model trong `ml/bench`.
- ❌ Báo "xong" khi `pnpm verify` đỏ hoặc chưa chạy thật.
- ❌ Viết docs lan man: bảng và code hơn văn xuôi; một chủ đề một chỗ; skill ≤ 120 dòng.
