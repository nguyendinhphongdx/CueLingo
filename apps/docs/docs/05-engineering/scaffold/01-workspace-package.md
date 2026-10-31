---
title: Workspace package
---

# Scaffold · Workspace package

**Kết quả:** một package TypeScript mới trong `packages/<name>` (thư viện dùng chung) hoặc `services/<name>` / `apps/<name>` (tiến trình chạy được), có trong workspace, typecheck, test, luật phụ thuộc và tài liệu.

## Điều kiện trước

- Đã xác định package thuộc [điểm mở rộng](../01-extension-points.md) nào và vì sao không đặt vào package có sẵn ([lazy-coding](../conventions/lazy-coding.md)).
- Tên theo [naming](../conventions/naming.md): `@cuelingo/<name>`.

## Các bước

```bash
mkdir -p packages/<name>/src
cp packages/learner-model/tsconfig.json packages/<name>/   # extends ../../tsconfig.base.json
```

`packages/<name>/package.json`:

```json
{
  "name": "@cuelingo/<name>",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": { "typecheck": "tsc --noEmit" },
  "dependencies": { "@cuelingo/shared": "workspace:*" }
}
```

`packages/<name>/src/index.ts`: một dòng comment mô tả + link tài liệu, rồi export công khai.

```ts
/**
 * @cuelingo/<name> — <một câu trách nhiệm>.
 * Design: apps/docs/docs/04-modules/05-packages/<name>.md
 */
export {};
```

Rồi:

```bash
pnpm install                       # nối workspace
pnpm --filter @cuelingo/<name> typecheck
```

## Nối dây

| Việc                                                                 | Ở đâu                                                                                 |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Package tiêu thụ thêm dependency `"@cuelingo/<name>": "workspace:*"` | `package.json` của bên dùng                                                           |
| Luật phụ thuộc riêng (ví dụ "không I/O", "không import app")         | `.dependency-cruiser.cjs` — thêm rule + `comment` giải thích                          |
| `AGENTS.md` của package: mục đích, luật cứng, anti-pattern           | `packages/<name>/AGENTS.md` (+ `CLAUDE.md` chỉ chứa `@AGENTS.md`)                     |
| Trang tài liệu                                                       | `apps/docs/docs/04-modules/05-packages/<name>.md` theo khuôn 6 mục                    |
| Bảng package                                                         | `packages/README.md`, [Tổ chức thư mục](../../03-architecture/03-folder-structure.md) |

Service/app chạy được còn cần script `dev` (và `build` nếu có), xem trang scaffold riêng của loại đó.

## Definition of Done

- [ ] `pnpm verify` xanh; có ít nhất một test (`src/*.test.ts`).
- [ ] `pnpm check:deps` bắt được vi phạm luật mới (thử bằng một import sai rồi xoá).
- [ ] `AGENTS.md`, trang tài liệu, bảng package đã cập nhật.

## Anti-pattern

- ❌ Package mới chỉ để chứa 1–2 hàm — đặt vào package có sẵn.
- ❌ Package dùng chung import `apps/*` hoặc `services/*`.
- ❌ `"main": "dist/index.js"` khi chưa có bước build — workspace dùng thẳng `src/`.
