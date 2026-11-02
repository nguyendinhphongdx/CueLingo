# Web app

> Code: `apps/web/` · Stack: Next.js (App Router) + React/TypeScript · Giai đoạn: MVP

Nơi xem lại cuộc họp, đọc debrief, ôn tập, xem tiến bộ và quản lý dữ liệu. Dùng được trên điện thoại qua trình duyệt.

## Modules

| Module                                    | Code                       | Trách nhiệm                                                      |
| ----------------------------------------- | -------------------------- | ---------------------------------------------------------------- |
| [Meeting library](./library.md)           | `src/features/library`     | Danh sách cuộc họp, tìm kiếm, lọc theo người và ngày.            |
| [Debrief view](./debrief.md)              | `src/features/debrief`     | Hiển thị debrief sau họp và đưa cụm từ vào ôn tập.               |
| [Review](./review.md)                     | `src/features/review`      | Phiên ôn tập FSRS với 3 dạng bài.                                |
| [Phrase Bank](./phrase-bank.md)           | `src/features/phrase-bank` | Danh sách cụm từ đã lưu, trạng thái receptive/productive, nguồn. |
| [Progress](./progress.md)                 | `src/features/progress`    | Tiến bộ theo tuần: % hiểu, số cụm đã học, streak.                |
| [Glossary](./glossary.md)                 | `src/features/glossary`    | Quản lý thuật ngữ và tên riêng dùng cho STT và dịch.             |
| [Account & privacy](./account-privacy.md) | `src/features/account`     | Cài đặt tài khoản, quyền riêng tư, xoá dữ liệu.                  |
| [Số liệu nội bộ](./admin-metrics.md)      | `src/features/admin`       | Chỉ số vận hành tổng hợp cho admin trong allowlist.              |

## Quan hệ với phần khác

Xem [sơ đồ hệ thống](../../01-overview/04-system-overview.md).
