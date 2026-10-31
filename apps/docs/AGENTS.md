# AGENTS.md — apps/docs

Docusaurus 3, nơi duy nhất chứa tài liệu của CueLingo. Convention: [writing-docs](docs/05-engineering/conventions/writing-docs.md).

- Nội dung ở `docs/`; thứ tự bằng tiền tố `NN-` và `_category_.json`; `README.md` là trang mục lục của thư mục.
- Link giữa các trang: đường dẫn tương đối tới `.md`. Code trong repo: ghi đường dẫn dạng `code`, không link.
- `.md` là CommonMark; chỉ dùng `.mdx` khi cần component. Sơ đồ bằng Mermaid.
- Trước khi commit: `pnpm docs:build` (dừng nếu link hỏng). Xem trực tiếp: `pnpm docs:dev`.
- Workflow dùng chung cho mọi agent nằm ở `docs/05-engineering/workflows/`; công thức dựng từng phần ở `docs/05-engineering/scaffold/`.
