# Convention · Đặt tên

| Cái gì           | Quy tắc                                                                                                      | Ví dụ                                    |
| ---------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| File TS          | kebab-case; vai trò làm hậu tố                                                                               | `glossary.service.ts`, `use-glossary.ts` |
| Component React  | PascalCase, file cùng tên                                                                                    | `GlossaryPage.tsx`                       |
| Hàm tạo          | `create<X>` (factory, không dùng class trừ lỗi)                                                              | `createGlossaryService`                  |
| Zod schema       | `<X>Schema`, `Create<X>Schema`, `Update<X>Schema`                                                            | `GlossaryTermSchema`                     |
| Bảng, cột DB     | snake_case, bảng số nhiều                                                                                    | `glossary_terms.created_at`              |
| JSON API         | camelCase                                                                                                    | `createdAt`                              |
| URL              | `/v1/<resource-số-nhiều>` kebab-case                                                                         | `/v1/glossary`, `/v1/review/queue`       |
| Event            | snake_case                                                                                                   | `phrase_saved`                           |
| Package          | `@cuelingo/<tên>`                                                                                            | `@cuelingo/learner-model`                |
| Nhánh git        | `feat/…`, `fix/…`, `docs/…`, `chore/…`                                                                       | `feat/realtime-translate`                |
| Thuật ngữ domain | Theo [glossary](../../00-overview/glossary.md); giữ tiếng Anh: Session, Segment, Assist level, Learner Model | —                                        |
