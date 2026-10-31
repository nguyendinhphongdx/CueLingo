---
title: Workflow
---

# Workflow

Quy trình làm việc chung cho **mọi agent** (Claude Code, Codex…) và người. Đây là nguồn duy nhất: skill của Claude Code trong `.claude/skills/` chỉ trỏ về đây; Codex đọc qua `AGENTS.md`.

| Workflow                                         | Dùng khi                                                                                 | Đầu ra                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| [task-loop](./task-loop.md)                      | Mọi task không đơn giản (≥ 3 file, đụng contract/schema/event/prompt/dữ liệu người dùng) | Hồ sơ `06-delivery/<slug>/`, code, 3 cổng duyệt   |
| [new-module](./new-module.md)                    | Thêm API module hoặc web feature                                                         | Module copy từ mẫu `glossary`                     |
| [contract-sync](./contract-sync.md)              | Thêm/đổi schema, mã lỗi, event, job payload                                              | `@cuelingo/shared` + mọi nơi dùng sửa cùng lúc    |
| [ai-task](./ai-task.md)                          | Thêm/sửa tác vụ AI, đổi prompt/model                                                     | Prompt có phiên bản + task gateway + số liệu eval |
| [commit](./commit.md)                            | Commit                                                                                   | Conventional Commits theo bước logic              |
| [agent-collaboration](../agent-collaboration.md) | Chia việc giữa Claude và Codex                                                           | Brief, nhánh riêng, review chéo                   |

Dựng một phần mới của repo (app, service, package): xem [Scaffold](../scaffold/README.md).
