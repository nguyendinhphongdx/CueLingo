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

## Môi trường (đọc kỹ)

**Codex không có mạng** (lần chạy đầu thất bại vì `ENOTFOUND registry.npmjs.org`). Lead đã cài sẵn trong worktree này: `clsx tailwind-merge class-variance-authority lucide-react` (dependencies) và `tailwindcss @tailwindcss/cli react react-dom @types/react @types/react-dom` (devDependencies của `packages/ui`) — xem `packages/ui/package.json`. Vì vậy:

- **Không** chạy `pnpm install` / `pnpm add` và **không** dùng shadcn CLI (cần mạng). Viết `button`, `input`, `card` **bằng tay** theo mã nguồn shadcn kiểu "new-york" (Radix `Slot` không cần cho bản này: `Button` không có `asChild`).
- Cần thêm dependency khác → dừng và ghi câu hỏi (mục cuối).
- Chạy lệnh qua `pnpm exec`/`pnpm --filter … <script>` (không tải gì).

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

`pnpm-lock.yaml` và `packages/ui/package.json` đã đổi do lead cài dependency; bạn **chỉ** sửa `packages/ui/package.json` ở phần `exports`, `peerDependencies`, `scripts`. Không commit.

`components.json` của `apps/web` và `apps/desktop` thuộc brief web (B5) và desktop (B3), **không làm ở đây**. Lead sẽ chạy CLI shadcn thật khi tích hợp để kiểm tra `components.json` hợp lệ.

## Các bước

1. Dependency **đã được lead cài sẵn** (xem Môi trường): chỉ đọc phiên bản trong `packages/ui/package.json` và ghi vào mục Kết quả.
2. `packages/ui/package.json`: `exports` như scaffold (`./globals.css`, `./components/*`, `./lib/*`, `./hooks/*`), `peerDependencies: react ^19`, scripts `typecheck` (`tsc --noEmit`) và `build:css` (Tailwind CLI biên dịch `src/styles/globals.css` ra `$TMPDIR` hoặc `dist/globals.css` — `dist/` đã bị gitignore).
3. `packages/ui/tsconfig.json`: `extends ../../tsconfig.base.json`, `jsx: react-jsx`, `lib: [ES2022, DOM, DOM.Iterable]`, `include: [src]`.
4. `src/styles/globals.css`: `@import "tailwindcss";`, `@custom-variant dark (&:is(.dark *));`, token màu sáng (`:root`) và tối (`.dark`) dạng CSS variable theo shadcn (`--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--radius`…), `@theme inline` ánh xạ sang tên màu Tailwind, và hai dòng `@source` tới `apps/web/src`, `apps/desktop/src` (đường dẫn theo scaffold).
5. `src/lib/utils.ts` (`cn`), `components.json` đúng scaffold. Viết tay `button`, `input`, `card` (không có CLI) vào `src/components/`, đúng kiểu và biến thể của shadcn "new-york" (`Button`: variant default/secondary/outline/ghost/destructive, size default/sm/lg/icon dùng `cva`). Tên file kebab-case (`button.tsx`).
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

- File đã đổi: `packages/ui/{package.json,tsconfig.json,components.json,AGENTS.md,CLAUDE.md,README.md}`, `packages/ui/src/styles/globals.css`, `packages/ui/src/lib/{utils.ts,utils.test.ts}`, `packages/ui/src/components/{button.tsx,input.tsx,card.tsx,caption-line.tsx,ui.test.tsx,caption-line.test.tsx}`, `apps/docs/docs/04-modules/05-packages/ui.md`, và mục Kết quả của brief này. `pnpm-lock.yaml` cùng phần dependency/devDependency ban đầu trong `packages/ui/package.json` là thay đổi có sẵn do lead cài dependency.
- Test đã thêm: `utils.test.ts` (AC1), `ui.test.tsx` (AC2), `caption-line.test.tsx` (AC3); tổng cộng 8 test mới.
- Phiên bản đã cài (tailwindcss, shadcn CLI, react…): `tailwindcss` và `@tailwindcss/cli` 4.3.3; `react`/`react-dom` 19.3.1; `@types/react`/`@types/react-dom` 19.3.0; `class-variance-authority` 0.7.1; `clsx` 2.1.1; `tailwind-merge` 3.7.0; `lucide-react` 1.66.0. Shadcn CLI không được cài hoặc chạy theo mục Môi trường.
- `pnpm verify`: xanh — format, lint và typecheck xanh; Vitest 6 file/20 test xanh; dependency-cruiser không có vi phạm (67 module, 72 dependency). Turbo có cảnh báo sandbox `IO error: Operation not permitted` khi typecheck nhưng 10/10 task vẫn thành công và lệnh trả mã 0.
- Đã chạy thật: `pnpm docs:build` sinh static site thành công; `pnpm --filter @cuelingo/ui build:css` bằng Tailwind CLI thành công và `dist/globals.css` có cả `:root` lẫn `.dark`; render server các component bằng `renderToStaticMarkup` qua test; thêm tạm import từ `packages/ui` tới `apps/web`, xác nhận `pnpm check:deps` báo rule `packages-not-to-apps-or-services`, rồi xóa file thử và chạy lại xanh.
- Khác brief (và lý do): Không. Không sửa scaffold vì cấu hình và lệnh thực tế khớp; Button/Input/Card được viết tay như mục Môi trường yêu cầu.
- Câu hỏi còn mở: Không có câu hỏi chặn task. Trang module ghi lại câu hỏi sản phẩm về thời điểm thay bảng màu neutral bằng bảng màu thương hiệu cuối cùng.
