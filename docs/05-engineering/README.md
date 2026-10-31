# 05 · Engineering

Quy ước code cho người và agent. **Đọc convention của tầng mình sửa trước khi viết code.** Khi doc và module mẫu vênh nhau thì **module mẫu thắng** (đó là code đang chạy), và phải sửa doc cho khớp.

| Khi làm                                  | Đọc                                                               | Module mẫu để copy                                   |
| ---------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------- |
| Thêm tính năng mới (bất kỳ)              | [extension-points](extension-points.md)                           | —                                                    |
| Trước khi viết code                      | [lazy-coding](conventions/lazy-coding.md)                         | —                                                    |
| Module trong `services/api`              | [api-module](conventions/api-module.md)                           | `services/api/src/modules/glossary/`                 |
| Feature trong `apps/web` (và UI desktop) | [web-feature](conventions/web-feature.md)                         | `apps/web/src/features/glossary/`                    |
| Schema dùng chung, DTO, mã lỗi           | [shared-contract](conventions/shared-contract.md)                 | `packages/shared/src/dto/glossary.dto.ts`            |
| Gọi API từ app                           | [shared-contract § Client](conventions/shared-contract.md#client) | `packages/core-sdk/src/glossary.ts`                  |
| Gọi model AI, prompt                     | [ai-calls](conventions/ai-calls.md)                               | — (chưa có)                                          |
| Event học tập                            | [events](conventions/events.md)                                   | — (chưa có)                                          |
| Swift / Rust trong `apps/desktop`        | [native-desktop](conventions/native-desktop.md)                   | — (chưa có)                                          |
| Test                                     | [testing](conventions/testing.md)                                 | `services/api/src/modules/glossary/glossary.test.ts` |
| Đặt tên                                  | [naming](conventions/naming.md)                                   | —                                                    |
| Dữ liệu người dùng, bí mật               | [privacy-security](conventions/privacy-security.md)               | —                                                    |
| Review (tự review, agent, người)         | [code-review](conventions/code-review.md)                         | —                                                    |
| Mở hồ sơ một task                        | [06-delivery](../06-delivery/README.md)                           | `docs/06-delivery/_template/`                        |

## Lệnh kiểm tra

```bash
pnpm verify        # format:check + lint + typecheck + test + check:deps — phải xanh trước khi báo xong
pnpm check:deps    # luật phụ thuộc kiến trúc (.dependency-cruiser.cjs)
pnpm test          # vitest, mọi *.test.ts(x) trong apps/services/packages
```

Luật phụ thuộc được máy kiểm (vi phạm là CI đỏ):

| Luật                                                   | Ở đâu                                         |
| ------------------------------------------------------ | --------------------------------------------- |
| `apps/*` không import `services/*` và ngược lại        | `.dependency-cruiser.cjs`                     |
| `packages/*` không import `apps/*`, `services/*`       | `.dependency-cruiser.cjs`                     |
| `@cuelingo/shared` không phụ thuộc package nội bộ khác | `.dependency-cruiser.cjs`                     |
| `@cuelingo/learner-model` không có I/O (fs, net, DB)   | `.dependency-cruiser.cjs`                     |
| Module API / feature web chỉ gọi nhau qua `index.ts`   | `.dependency-cruiser.cjs`                     |
| Không có vòng phụ thuộc                                | `.dependency-cruiser.cjs`                     |
| Không import SDK AI ngoài `packages/ai-gateway`        | `eslint.config.mjs` (`no-restricted-imports`) |
