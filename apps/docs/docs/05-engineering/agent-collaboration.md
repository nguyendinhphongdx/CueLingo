---
title: Phối hợp nhiều agent
sidebar_position: 5
---

# Phối hợp nhiều agent (Claude Code ↔ Codex)

Repo được viết để **nhiều agent cùng làm** mà vẫn ra cùng một kiểu code: quy tắc ở `AGENTS.md` (Codex và Claude cùng đọc), workflow và công thức scaffold ở docs, luật kiến trúc kiểm bằng máy. Trang này quy định cách chia việc, bàn giao và review chéo.

## Vai trò mặc định

| Vai             | Làm                                                                        | Thường là                                              |
| --------------- | -------------------------------------------------------------------------- | ------------------------------------------------------ |
| **Lead**        | Spec, plan, chia việc thành brief, tích hợp, trình các cổng cho người dùng | Claude Code                                            |
| **Implementer** | Làm đúng một brief trong nhánh/worktree riêng, báo kết quả                 | Codex (hoặc sub-agent `ts-engineer`/`native-engineer`) |
| **Reviewer**    | Review độc lập theo [checklist](./conventions/code-review.md)              | Agent **khác** với implementer                         |

Vai đổi được theo task. Bất biến: **người viết code không tự review code của mình**; **chỉ người dùng qua cổng** (spec, plan, result).

## Đơn vị bàn giao: brief

Mỗi phần việc giao đi là một file `04-brief.md` trong hồ sơ task (`apps/docs/docs/06-delivery/<slug>/`), viết từ mẫu `06-delivery/_template/04-brief.md`. Brief phải **tự đủ**: agent nhận chỉ cần brief + repo, không cần đọc hội thoại.

| Brief có                                           | Vì sao                         |
| -------------------------------------------------- | ------------------------------ |
| Mục tiêu + AC (EARS) phải đạt                      | Biết khi nào xong              |
| **File được sửa** và **file không được sửa**       | Tránh hai agent đụng cùng file |
| Link workflow / scaffold / convention / module mẫu | Không phải đoán cách làm       |
| Các bước + Definition of Done + lệnh verify        | Kết quả kiểm được              |
| Ngoài phạm vi + khi nào phải dừng hỏi              | Chặn tự quyết                  |
| Mục "Kết quả" để implementer điền                  | Bàn giao ngược có cấu trúc     |

Cỡ brief: ≤ 1 ngày làm, ≤ ~10 file, tốt nhất chạm **một** điểm mở rộng.

## Cô lập: nhánh + worktree riêng

```bash
# lead tạo cho mỗi brief
git worktree add ../cuelingo-<slug>-<agent> -b <feat|chore>/<slug>-<agent>
cd ../cuelingo-<slug>-<agent> && pnpm install
```

- Mỗi agent một worktree, không hai agent cùng sửa một file.
- File dùng chung dễ đụng (`services/api/src/app.ts`, `packages/shared/src/index.ts`, `package.json`, `pnpm-lock.yaml`) → brief ghi rõ ai được sửa; mặc định **lead** sửa khi tích hợp.
- Lead tích hợp bằng merge sau khi review xong; implementer không merge, không push.

## Giao việc cho Codex

| Cách                                                                                                      | Khi nào                                                                    |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Từ Claude Code qua plugin Codex (lệnh `/codex:rescue` kèm đường dẫn brief)                                | Đang làm trong Claude Code, muốn Codex làm song song hoặc làm lại phần khó |
| Codex CLI trong worktree của brief: lời nhắc _"Làm theo `apps/docs/docs/06-delivery/<slug>/04-brief.md`"_ | Người dùng tự chạy Codex                                                   |

Codex đọc `AGENTS.md` gốc và `AGENTS.md` của thư mục nó làm; brief trỏ tới trang workflow/scaffold cần đọc thêm.

## Bàn giao ngược

Implementer điền mục **Kết quả** trong brief: file đã đổi, test đã thêm, output `pnpm verify`, đã chạy thật gì, chỗ làm khác brief và lý do, câu hỏi còn mở. Gặp điều brief không trả lời được → **dừng và ghi câu hỏi**, không tự quyết.

## Review chéo

1. Reviewer đọc brief + diff (`git diff main...<branch>`), chạy `pnpm verify`, soát [checklist](./conventions/code-review.md).
2. Phát hiện ghi vào `03-review.md` (🔴/🟡/🟢); 🔴 trả lại implementer.
3. Lead tích hợp, chạy lại verify trên nhánh tích hợp, trình **cổng RESULT**.

## Không giao cho agent khác

Quyết định ở các cổng · viết/duyệt ADR · quyết định quyền riêng tư hoặc nhà cung cấp AI · đổi prompt/model mặc định · push, PR, mọi hành động ra ngoài repo.
