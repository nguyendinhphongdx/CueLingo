---
title: Viết tài liệu
---

# Convention · Viết tài liệu

Toàn bộ tài liệu nằm trong `apps/docs/docs/` và được dựng bằng Docusaurus. **Một chủ đề một chỗ**: không chép nội dung giữa các trang, hãy trỏ link.

## Cấu trúc

| Thư mục                            | Chứa                                                 | Thêm trang khi                                       |
| ---------------------------------- | ---------------------------------------------------- | ---------------------------------------------------- |
| `01-overview/`                     | Toàn cảnh, tầm nhìn, người dùng, hệ thống, thuật ngữ | Hiếm khi; sửa trang có sẵn                           |
| `02-product/`                      | Tính năng, hành trình, MVP, lộ trình, kinh doanh     | Có giai đoạn/sản phẩm mới                            |
| `03-architecture/`                 | Thiết kế xuyên nhiều phần                            | Có cơ chế mới dùng chung (ví dụ realtime cho mobile) |
| `04-modules/<NN-part>/`            | Mỗi module một trang, `README.md` là trang của phần  | **Mỗi module mới**                                   |
| `05-engineering/`                  | Extension points, convention                         | Có tầng/loại code mới                                |
| `06-delivery/<YYYY-MM-DD>-<slug>/` | Hồ sơ task (spec, plan, review)                      | Mỗi task không đơn giản                              |
| `07-research/`                     | Khảo sát, benchmark                                  | Mỗi nghiên cứu                                       |
| `08-adr/NNNN-<slug>.md`            | Quyết định kiến trúc                                 | Mỗi quyết định khó đảo ngược                         |

- Tiền tố `NN-` quyết định thứ tự trong sidebar và **bị bỏ khỏi URL** (`02-product/03-mvp-scope.md` → `/product/mvp-scope`).
- `README.md` trong thư mục là trang mục lục của thư mục đó. `_category_.json` đặt nhãn và vị trí.
- Thư mục/tệp bắt đầu bằng `_` (ví dụ `06-delivery/_template/`) không được xuất bản.

## Trang module

Giữ đúng 6 mục: **Trách nhiệm · Phạm vi MVP · Interface · Phụ thuộc · Dữ liệu & sự kiện · Câu hỏi mở.** Interface hoặc dữ liệu đổi trong code → sửa trang này trong cùng commit.

## Link

| Link tới                | Viết                                     | Ví dụ                                                     |
| ----------------------- | ---------------------------------------- | --------------------------------------------------------- |
| Trang tài liệu khác     | Đường dẫn tương đối tới file `.md`       | `[Learner Model](../03-architecture/02-learner-model.md)` |
| Một mục trong trang     | Thêm `#anchor`                           | `../03-architecture/02-learner-model.md#assist-dial`      |
| Code, config trong repo | **Không link** — ghi đường dẫn dạng code | `` `services/api/src/modules/glossary/` ``                |
| Bên ngoài               | URL đầy đủ                               | `https://…`                                               |

Build dừng nếu có link hỏng (`onBrokenLinks: 'throw'`).

## Định dạng

- `.md` là CommonMark (an toàn với `<x>`, `{}`); chỉ dùng `.mdx` khi cần component React.
- Sơ đồ bằng Mermaid (` ```mermaid `): luồng, kiến trúc, trạng thái, hành trình.
- Bảng và code hơn văn xuôi. Câu ngắn. Không mở đầu bằng "Tài liệu này mô tả…" — câu đầu tiên là ý chính.
- Ngắn: trang thường ≤ 150 dòng, trang hướng dẫn sâu ≤ 200. Dài hơn thì tách.

## Kiểm tra

```bash
pnpm --filter @cuelingo/docs dev   # xem trực tiếp: http://localhost:3100
pnpm docs:build                    # build + kiểm link hỏng — chạy trước khi commit docs
```
