---
title: Scaffold
---

# Scaffold

Mỗi trang ở đây là một **công thức** để dựng một phần của repo, viết sao cho một agent bất kỳ (Claude Code, Codex…) hoặc một người mới làm theo từ đầu đến cuối mà không phải đoán. Mỗi trang có cùng khuôn: **Kết quả · Điều kiện trước · Các bước · File khung · Nối dây · Definition of Done · Anti-pattern**.

| Dựng gì                                              | Trang                                          | Giai đoạn      | Trạng thái |
| ---------------------------------------------------- | ---------------------------------------------- | -------------- | ---------- |
| Package/app mới trong workspace                      | [Workspace package](./01-workspace-package.md) | Bất kỳ         | Dùng được  |
| Nền móng API: config, migration, queue, auth, Docker | [API foundation](./02-api-foundation.md)       | Nền móng       | Chưa dựng  |
| Worker pg-boss + job mẫu                             | [Worker](./03-worker.md)                       | Nền móng       | Chưa dựng  |
| Next.js App Router cho `apps/web`                    | [Web (Next.js)](./04-web-nextjs.md)            | Nền móng       | Chưa dựng  |
| `@cuelingo/ui`: Tailwind 4 + shadcn/ui               | [UI package](./05-ui-package.md)               | Nền móng       | Chưa dựng  |
| App desktop: Vite + React + Tauri 2                  | [Desktop (Tauri)](./06-desktop-tauri.md)       | Nền móng       | Chưa dựng  |
| Swift package audio/STT + cầu nối Rust               | [Native Swift](./07-native-swift.md)           | Đường realtime | Chưa dựng  |
| Python project cho `ml/eval`                         | [ML (Python)](./08-ml-python.md)               | Vòng học       | Chưa dựng  |

Thêm **module** vào một phần đã có (API module, web feature, contract, client) không phải scaffold. Việc đó làm theo workflow [new-module](../workflows/new-module.md).

## Luật chung cho mọi scaffold

1. **Đi qua [task-loop](../workflows/task-loop.md)**: scaffold luôn là task không đơn giản.
2. **Ghim phiên bản** khi cài (`pnpm add <pkg>@<major>`), ghi phiên bản đã dùng vào hồ sơ task. Lệnh tạo dự án (`create-*`, `init`) thay đổi theo thời gian: chạy `--help` trước, đối chiếu tài liệu chính thức nếu câu hỏi/flag khác với trang này, rồi **sửa trang này** cho khớp.
3. **Không giữ file mẫu thừa** do generator sinh ra (logo, trang demo, CSS mẫu). Cây thư mục kết quả phải khớp [Tổ chức thư mục](../../03-architecture/03-folder-structure.md).
4. **Nối vào harness ngay trong cùng task:** `package.json` có script `typecheck`; luật phụ thuộc mới (nếu có) thêm vào `.dependency-cruiser.cjs`; `AGENTS.md` của phần được tạo/cập nhật; CI chạy được.
5. **Cập nhật tài liệu:** đổi ký hiệu ⬜ → ✅ trong [Tổ chức thư mục](../../03-architecture/03-folder-structure.md); sửa trang phần trong `04-modules/`.

## Definition of Done chung

- [ ] `pnpm install --frozen-lockfile` chạy được từ repo sạch.
- [ ] `pnpm verify` xanh; `pnpm docs:build` xanh nếu sửa docs.
- [ ] Phần vừa dựng **chạy thật** (server trả `/healthz`, trang mở được, cửa sổ app hiện ra) — ghi cách đã thử vào `03-review.md`.
- [ ] Một agent khác có thể làm theo trang scaffold này mà ra cùng kết quả (trang đã được sửa nếu thực tế khác).
