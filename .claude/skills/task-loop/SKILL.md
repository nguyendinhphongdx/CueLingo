---
name: task-loop
description: Quy trình CueLingo cho task KHÔNG đơn giản (≥ 3 file, nhiều phần, hoặc đụng @cuelingo/shared, migration, event, prompt/model AI, dữ liệu người dùng). Mở hồ sơ docs/06-delivery, đi qua 3 cổng duyệt SPEC → PLAN → RESULT. Invoke TRƯỚC khi lập plan hoặc sửa code. Không dùng cho task vặt 1–2 file.
---

# task-loop — Spec → Plan → Làm → Review

## 0. Phân loại

| Loại           | Dấu hiệu                                                           | Làm gì                                         |
| -------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| Vặt            | 1–2 file, không đụng contract/schema/AI/quyền riêng tư             | **Dừng skill này.** Code thẳng → `pnpm verify` |
| Không đơn giản | Còn lại                                                            | Tiếp tục                                       |
| Nhạy cảm       | DB schema, xoá dữ liệu, bảo mật, nhà cung cấp AI mới, breaking API | Tiếp tục + nêu rủi ro ở mỗi cổng               |

Mở hồ sơ: `cp -r docs/06-delivery/_template docs/06-delivery/<YYYY-MM-DD>-<slug>`

## 1. Spec → `01-specs.md`

- Đọc: `docs/01-product/mvp-scope.md`, `docs/03-parts/<part>/<module>.md` liên quan. **Chưa đọc code** ở bước này.
- Viết §1 Vấn đề (không nói giải pháp), §2 AC theo EARS (mỗi AC kiểm chứng được), §3 Câu hỏi mở.

**⛔ CỔNG SPEC.** Trình `01-specs.md`. Hỏi: _"Vấn đề và AC đúng chưa? Bắt đầu thiết kế được chưa?"_ Chờ người dùng đồng ý.

## 2. Plan → `02-plan.md`

1. Đọc `docs/05-engineering/extension-points.md` → task chạm những điểm mở rộng nào.
2. Đọc convention tương ứng + `CLAUDE.md` của phần + **module mẫu**.
3. Đọc code liên quan (Glob/Grep/Read ở luồng chính; nhiều tài liệu → agent `docs-explorer`).
4. Ghi một lần: bối cảnh code, **≥ 2 phương án**, phương án chọn + lý do, bảng tác động, các bước (mỗi bước ≈ 1 commit), rủi ro.
5. Task nhạy cảm hoặc > 5 bước → giao agent `solution-architect` lập plan.

**⛔ CỔNG PLAN.** Trình `02-plan.md`. Hỏi: _"Cách làm này ổn chưa?"_ Không viết code trước khi được đồng ý.

## 3. Làm

- Thứ tự: contract (`skill contract-sync`) → migration → API module → client → app. Module mới: skill `new-module`. Tác vụ AI: skill `ai-task`.
- Viết test theo AC **trước hoặc cùng lúc** với code.
- Giao việc: TypeScript → agent `ts-engineer`; Swift/Rust → `native-engineer`; hoặc làm ở luồng chính.
- Cập nhật `docs/03-parts/…` khi interface/dữ liệu đổi.
- Sau mỗi bước: `pnpm verify`. Đỏ thì sửa trước khi sang bước sau.

## 4. Review → `03-review.md`

1. Chạy thật luồng vừa làm (API: gọi endpoint; UI: mở trình duyệt/app; native: cuộc gọi thật).
2. Agent `code-reviewer` review diff. Sửa hết 🔴.
3. Điền `03-review.md`: thay đổi so với plan, tự review theo checklist, thứ tự đọc cho người review.

**⛔ CỔNG RESULT.** Báo kết quả `pnpm verify` + những gì đã chạy thật. Hỏi: _"Sẵn sàng commit chưa?"_

## 5. Đóng

- Commit theo bước (skill `git-commit`). Push / PR chỉ khi người dùng bảo.

## Bị từ chối ở cổng

Quay lại pha đó, **ghi thêm** một dòng vào Decision log trong `01-specs.md` (không xoá dòng cũ), trình lại.

## Anti-pattern

- ❌ Mở hồ sơ cho task vặt.
- ❌ Viết code trước cổng PLAN.
- ❌ Plan chỉ có một phương án.
- ❌ AC không kiểm chứng được ("hoạt động tốt", "nhanh").
- ❌ Báo xong khi chưa chạy thật hoặc `pnpm verify` đỏ.
- ❌ Tự commit, push, tạo PR khi người dùng chưa bảo.
