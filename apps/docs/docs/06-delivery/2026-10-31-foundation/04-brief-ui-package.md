---
title: Brief B2 · UI package
---

# Brief — foundation · B2 UI package

> Giao cho: Codex · Nhánh: `feat/foundation-ui-codex` (tách từ `feat/foundation`) · Worktree: `.worktrees/foundation-ui-codex`
> Quy tắc phối hợp: `apps/docs/docs/05-engineering/agent-collaboration.md`

## Mục tiêu

Dựng `@cuelingo/ui` (Tailwind 4 + shadcn/ui) theo công thức `apps/docs/docs/05-engineering/scaffold/05-ui-package.md`: design tokens sáng/tối, `cn()`, và bốn component **Button, Input, Card, CaptionLine** mà web (Next.js) và desktop (Vite) sẽ cùng import từ `@cuelingo/ui/components/*`.

## AC phải đạt

| #   | AC (EARS)                                                                                                                                                                                                                                                                                                                       | Test                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| AC1 | WHEN `cn()` nhận các class xung đột của Tailwind THE SYSTEM SHALL giữ class đứng sau (ví dụ `cn('px-2', 'px-4')` → `px-4`) và bỏ giá trị falsy                                                                                                                                                                                  | `packages/ui/src/lib/utils.test.ts`                                        |
| AC2 | WHEN render `Button`, `Input`, `Card` từ server (`renderToStaticMarkup`) THE SYSTEM SHALL sinh đúng thẻ (`button`, `input`, `div`) và nhận `className` bổ sung                                                                                                                                                                  | `packages/ui/src/components/ui.test.tsx`                                   |
| AC3 | WHEN `CaptionLine` nhận `text`, `translation`, `hardWords=['push back']` THE SYSTEM SHALL hiện câu gốc, bản dịch bên dưới, và bọc từng cụm trong `hardWords` bằng thẻ `<u>`; WHEN `partial` là true THE SYSTEM SHALL thêm `data-partial="true"` và kiểu mờ; WHEN không có `translation` THE SYSTEM SHALL không render dòng dịch | `packages/ui/src/components/caption-line.test.tsx`                         |
| AC4 | WHEN Tailwind CLI biên dịch `src/styles/globals.css` THE SYSTEM SHALL thành công và đầu ra chứa biến màu cho cả `:root` (sáng) và `.dark` (tối)                                                                                                                                                                                 | script `pnpm --filter @cuelingo/ui build:css` (xem bước 6), chạy tay + DoD |

## Đọc trước

- `AGENTS.md` (gốc), `packages/shared/AGENTS.md` (mẫu một package `AGENTS.md`)
- Scaffold: `apps/docs/docs/05-engineering/scaffold/05-ui-package.md` — **làm đúng trang này**; nếu lệnh/định dạng của shadcn CLI hoặc Tailwind khác trang, theo tài liệu chính thức của bản đã cài rồi **sửa trang scaffold** cho khớp (ghi vào mục Kết quả).
- ADR: `apps/docs/docs/08-adr/0007-ui-stack.md`
- Convention: `apps/docs/docs/05-engineering/conventions/web-feature.md` (component UI chung không gọi API), `naming.md`
- Module mẫu cho tests: `packages/shared/src/dto/glossary.dto.test.ts` (Vitest)
- Hiện thực CaptionLine bám theo `apps/docs/docs/04-modules/01-desktop/overlay.md` (partial nhạt, final đậm, từ khó gạch chân)

## Phạm vi file

| Được sửa / tạo                                                                                                                                       | Không được sửa                                                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/ui/**` (kể cả `package.json`, `tsconfig.json`, `components.json`, `AGENTS.md`, `README.md`), `apps/docs/docs/04-modules/05-packages/ui.md` | `apps/**` (trừ `apps/docs/docs/04-modules/05-packages/ui.md`), `services/**`, `packages/{shared,core-sdk,learner-model,ai-gateway,prompts}/**`, `.dependency-cruiser.cjs`, `eslint.config.mjs`, `vitest.config.ts`, `package.json` gốc, `.github/**` |

`pnpm-lock.yaml` sẽ đổi trong worktree của bạn khi cài dependency — điều đó bình thường, **đừng commit**; lead tạo lại lockfile khi tích hợp.

Component shadcn chạy lệnh `add` từ `apps/web` sẽ thêm `components.json` vào `apps/web`; việc đó thuộc brief web (B5), **không làm ở đây**. Ở brief này chạy CLI từ `packages/ui` (hoặc viết tay theo mã nguồn shadcn "new-york" nếu CLI không dùng được trong môi trường của bạn, ghi rõ vào Kết quả).

## Các bước

1. `pnpm install` trong worktree. Cài đúng như scaffold bước 1: `clsx tailwind-merge class-variance-authority lucide-react`; devDependencies: `tailwindcss @tailwindcss/cli react react-dom @types/react @types/react-dom`. Ghim major (`pnpm add <pkg>@<major>`); ghi các phiên bản vào mục Kết quả.
2. `packages/ui/package.json`: `exports` như scaffold (`./globals.css`, `./components/*`, `./lib/*`, `./hooks/*`), `peerDependencies: react ^19`, scripts `typecheck` (`tsc --noEmit`) và `build:css` (Tailwind CLI biên dịch `src/styles/globals.css` ra `$TMPDIR` hoặc `dist/globals.css` — `dist/` đã bị gitignore).
3. `packages/ui/tsconfig.json`: `extends ../../tsconfig.base.json`, `jsx: react-jsx`, `lib: [ES2022, DOM, DOM.Iterable]`, `include: [src]`.
4. `src/styles/globals.css`: `@import "tailwindcss";`, `@custom-variant dark (&:is(.dark *));`, token màu sáng (`:root`) và tối (`.dark`) dạng CSS variable theo shadcn (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--radius`…), `@theme inline` ánh xạ sang tên màu Tailwind, và hai dòng `@source` tới `apps/web/src`, `apps/desktop/src` (đường dẫn theo scaffold).
5. `src/lib/utils.ts` (`cn`), `components.json` đúng scaffold. Thêm `button`, `input`, `card` bằng shadcn (hoặc viết tay) vào `src/components/`. Tên file kebab-case (`button.tsx`).
6. `src/components/caption-line.tsx`: component thuần trình bày, **không gọi API, không dùng state ngoài props**. Props: `text: string`, `translation?: string`, `hardWords?: string[]`, `partial?: boolean`, `className?`. Gạch chân bằng `<u>` quanh cụm khớp (không phân biệt hoa thường, cụm dài ưu tiên trước). Export kiểu props.
7. Test AC1–AC3 (Vitest chạy từ gốc repo: `pnpm test`). Test component dùng `react-dom/server` `renderToStaticMarkup`, **không** thêm jsdom hay testing-library.
8. `AGENTS.md` cho `packages/ui` theo mẫu `packages/shared/AGENTS.md` (mục đích, luật cứng: không import `apps/*`, không gọi API, token thay vì mã màu cứng; link scaffold) + file `CLAUDE.md` chỉ chứa `@AGENTS.md`. Cập nhật `README.md` và trang `apps/docs/docs/04-modules/05-packages/ui.md` (Interface: các export; Phụ thuộc; Câu hỏi mở).
9. Chạy `pnpm verify` ở gốc worktree, rồi `pnpm --filter @cuelingo/ui build:css`, kiểm đầu ra có cả `:root` và `.dark`.

## Definition of Done

- [ ] AC1–AC3 có test và xanh; AC4 chạy được và đầu ra đúng
- [ ] `pnpm verify` xanh; `pnpm docs:build` xanh (vì sửa trang docs)
- [ ] Đã chạy thật: biên dịch CSS bằng Tailwind CLI; `pnpm check:deps` bắt được nếu `packages/ui` import thử `apps/web` (thử rồi xoá)
- [ ] Trang `04-modules/05-packages/ui.md` cập nhật; scaffold `05-ui-package.md` sửa nếu thực tế khác
- [ ] Không commit, không push (lead tích hợp)

## Ngoài phạm vi · Dừng và hỏi khi

- Ngoài phạm vi: các component khác (PhraseCard, ReviewCard, DebriefBlocks), cấu hình Tailwind/shadcn trong `apps/web` và `apps/desktop`, bảng màu cuối cùng (dùng bảng neutral mặc định của shadcn), icon riêng của CueLingo.
- Dừng và ghi câu hỏi nếu: cần sửa file ngoài danh sách · cần thêm dependency lớn ngoài danh sách (ví dụ `radix-ui` khác với những gì `button/input/card` kéo theo) · định dạng `components.json` của shadcn đã đổi khác trang scaffold đến mức không làm theo được.

## Kết quả _(implementer điền)_

- File đã đổi:
- Test đã thêm:
- Phiên bản đã cài (tailwindcss, shadcn CLI, react…):
- `pnpm verify`:
- Đã chạy thật:
- Khác brief (và lý do):
- Câu hỏi còn mở:
