# <slug> — <tiêu đề>

| Trạng thái | Loại                  | Nhánh / PR           | Ước lượng → thực tế |
| ---------- | --------------------- | -------------------- | ------------------- |
| Spec       | feature / bug / chore | `feat/<slug>` / _PR_ | _? → ?_             |

**Phạm vi:** trong: … · ngoài: …

## 1. Vấn đề

_Cái gì, vì sao, ai bị ảnh hưởng. Không nói giải pháp._

- **Spec liên quan:** _docs/01-product/…, apps/docs/docs/04-modules/…_
- **Module chạm tới:** _docs/03-parts/<part>/<module>.md_

_(Bug) Tái hiện: bước · hiện tại / mong đợi · nguyên nhân gốc_

## 2. Tiêu chí chấp nhận (EARS)

_Mỗi AC kiểm chứng được = ít nhất 1 test._ Mẫu: `WHEN` sự kiện · `IF … THEN` đường lỗi · `WHILE` trạng thái → `THE SYSTEM SHALL` …

| #   | AC                           | Test                   |
| --- | ---------------------------- | ---------------------- |
| AC1 | WHEN … THE SYSTEM SHALL …    | `<file>.test.ts` › `…` |
| AC2 | IF … THEN THE SYSTEM SHALL … | …                      |

## 3. Câu hỏi mở

- [ ] …

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối |
| ---------- | ---- | ----------------------------- |
| YYYY-MM-DD | Spec | Mở hồ sơ                      |
