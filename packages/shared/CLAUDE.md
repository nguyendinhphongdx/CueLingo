# CLAUDE.md — packages/shared

Contract giữa các app/service. Convention: [shared-contract](../../apps/docs/docs/05-engineering/conventions/shared-contract.md). Mẫu: [`src/dto/glossary.dto.ts`](src/dto/glossary.dto.ts).

- Chỉ phụ thuộc `zod`. Không framework, không package nội bộ khác (máy kiểm).
- Zod schema là nguồn sự thật; type bằng `z.infer`/`z.input`/`z.output`.
- Đổi schema → sửa api, core-sdk, app trong cùng commit (skill `contract-sync`).
