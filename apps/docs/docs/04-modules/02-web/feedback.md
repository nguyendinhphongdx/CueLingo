---
title: Góp ý
---

# Góp ý

> Code: `apps/web/src/features/feedback/`, route `/feedback` · API: [feedback](../03-api/feedback.md)

Trang cho người thử gửi lỗi hoặc góp ý. Form là `FeedbackForm` trong `@cuelingo/ui` (dùng chung với desktop): chọn **Báo lỗi / Góp ý**, đếm ký tự trên 2000, dòng "Không gửi kèm transcript hay âm thanh".

- Web gửi `appVersion: 'web'` và `os` = `navigator.platform` (cắt 80 ký tự), không gửi user agent.
- Mục "Góp ý" nằm trong `packages/ui/src/lib/roadmap.ts`, nhóm Ứng dụng, nên sidebar hai client đều thấy.
