# Extension points

Mỗi tính năng mới phải rơi vào **một** điểm mở rộng dưới đây. Nếu không vừa ô nào thì **dừng lại, đề xuất ADR**, không vá tạm quanh kiến trúc.

| Cần thêm                                        | Điểm mở rộng   | Tạo/sửa ở đâu                                                                                       | Hợp đồng                                                             |
| ----------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Endpoint / tài nguyên backend                   | API module     | `services/api/src/modules/<x>/` (copy `glossary/`), đăng ký trong `src/app.ts`                      | [api-module](conventions/api-module.md)                              |
| Schema request/response, mã lỗi                 | Contract       | `packages/shared/src/dto/<x>.dto.ts`, export ở `src/index.ts`                                       | [shared-contract](conventions/shared-contract.md)                    |
| Hàm gọi API cho app                             | Client         | `packages/core-sdk/src/<x>.ts`, gắn vào `createClient`                                              | [shared-contract § Client](conventions/shared-contract.md#client)    |
| Màn hình / chức năng web                        | Web feature    | `apps/web/src/features/<x>/` (copy `glossary/`)                                                     | [web-feature](conventions/web-feature.md)                            |
| Màn hình / chức năng desktop                    | Desktop module | `apps/desktop/src/<x>/` (UI) · `src-tauri/src` (Rust) · `native/macos-audio` (Swift)                | [native-desktop](conventions/native-desktop.md)                      |
| Tác vụ AI mới (dịch, recap, debrief…)           | AI task        | prompt `packages/prompts/src/<task>/v<n>.ts` + task trong `packages/ai-gateway` + fixture `ml/eval` | [ai-calls](conventions/ai-calls.md)                                  |
| Nhà cung cấp AI mới (STT/LLM/TTS)               | Provider       | `packages/ai-gateway/src/providers/<x>.ts`                                                          | [ai-calls](conventions/ai-calls.md)                                  |
| Tín hiệu học tập / sản phẩm                     | Event          | catalog `packages/shared/src/events/` + ánh xạ trong `packages/learner-model`                       | [events](conventions/events.md)                                      |
| Quy tắc Learner Model (FSRS, giai đoạn, Assist) | Learner rule   | `packages/learner-model/src/` (logic thuần, có test)                                                | [02-architecture/learner-model](../02-architecture/learner-model.md) |
| Việc nền (debrief, TTS, dọn dữ liệu)            | Worker job     | `services/workers/src/jobs/<x>/`                                                                    | [03-parts/workers](../03-parts/workers/README.md)                    |
| Bảng / cột DB                                   | Migration      | `infra/db/migrations/NNNN_<x>.sql` — **chỉ thêm file mới, không sửa file đã chạy**                  | [02-architecture/data-model](../02-architecture/data-model.md)       |
| Quyết định khó đảo ngược                        | ADR            | `docs/adr/NNNN-<x>.md`                                                                              | [adr/README](../adr/README.md)                                       |

Một tính năng thường chạm nhiều ô theo thứ tự: **contract → API module → client → feature**, kèm migration và event nếu cần.
