---
title: task-loop
---

# Workflow · task-loop — Spec → Plan → Làm → Review

Dùng cho mọi task **không đơn giản**. Mỗi cổng ⛔ cần **người dùng đồng ý** trước khi đi tiếp. Agent không tự qua cổng.

## 0. Phân loại

| Loại           | Dấu hiệu                                                           | Làm gì                                      |
| -------------- | ------------------------------------------------------------------ | ------------------------------------------- |
| Vặt            | 1–2 file, không đụng contract/schema/AI/quyền riêng tư             | Bỏ workflow này: code thẳng → `pnpm verify` |
| Không đơn giản | Còn lại                                                            | Tiếp tục                                    |
| Nhạy cảm       | DB schema, xoá dữ liệu, bảo mật, nhà cung cấp AI mới, breaking API | Tiếp tục + nêu rủi ro ở mỗi cổng            |

```bash
cp -r apps/docs/docs/06-delivery/_template apps/docs/docs/06-delivery/<YYYY-MM-DD>-<slug>
git switch -c <feat|fix|chore|docs>/<slug>
```

## 1. Spec → `01-specs.md`

- Đọc: [Phạm vi MVP](../../02-product/03-mvp-scope.md) và trang module liên quan trong `04-modules/`. **Chưa đọc code.**
- Viết §1 Vấn đề (không nói giải pháp), §2 AC theo EARS (mỗi AC kiểm chứng được), §3 Câu hỏi mở.

**⛔ CỔNG SPEC** — trình `01-specs.md`: _"Vấn đề và AC đúng chưa?"_

## 2. Plan → `02-plan.md`

1. [Extension points](../01-extension-points.md) → task chạm điểm mở rộng nào.
2. Convention của tầng + `AGENTS.md` của phần + **module mẫu**; phần chưa dựng → trang [Scaffold](../scaffold/README.md).
3. Đọc code liên quan.
4. Ghi một lần: bối cảnh code, **≥ 2 phương án**, phương án chọn + lý do, bảng tác động, các bước (mỗi bước ≈ 1 commit), rủi ro.
5. Việc sẽ giao cho agent khác → viết `04-brief.md` cho từng phần việc ([agent-collaboration](../agent-collaboration.md)).

**⛔ CỔNG PLAN** — trình `02-plan.md`: _"Cách làm này ổn chưa?"_ Không viết code trước khi được đồng ý.

## 3. Làm

- Thứ tự: contract ([contract-sync](./contract-sync.md)) → migration → API module → client → app. Module mới: [new-module](./new-module.md). AI: [ai-task](./ai-task.md).
- Test theo AC trước hoặc cùng lúc. Cập nhật trang module khi interface/dữ liệu đổi.
- Sau mỗi bước: `pnpm verify` (sửa docs thì thêm `pnpm docs:build`). Đỏ → sửa trước khi sang bước sau.

## 4. Review → `03-review.md`

1. **Chạy thật** luồng vừa làm (API: gọi endpoint; UI: mở trình duyệt/app; native: cuộc gọi thật).
2. Review độc lập bằng một agent **khác** với agent đã viết code nếu có thể (Claude viết → Codex review, hoặc ngược lại), theo [checklist](../conventions/code-review.md). Sửa hết 🔴.
3. Điền `03-review.md`: thay đổi so với plan, tự review, thứ tự đọc cho người review.

**⛔ CỔNG RESULT** — báo kết quả verify + những gì đã chạy thật: _"Sẵn sàng commit chưa?"_

## 5. Đóng

Commit theo bước ([commit](./commit.md)). Push / PR chỉ khi người dùng bảo.

**Bị từ chối ở cổng:** quay lại pha đó, **thêm** một dòng vào Decision log trong `01-specs.md` (không xoá dòng cũ), trình lại.

## Anti-pattern

- ❌ Mở hồ sơ cho task vặt · viết code trước cổng PLAN · plan chỉ một phương án.
- ❌ AC không kiểm chứng được ("hoạt động tốt", "nhanh").
- ❌ Báo xong khi chưa chạy thật hoặc `pnpm verify` đỏ.
- ❌ Tự commit, push, tạo PR khi người dùng chưa bảo.
