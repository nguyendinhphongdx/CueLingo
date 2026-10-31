# 0007 · UI: React + Next.js + Tailwind + shadcn/ui + TanStack Query

**Trạng thái:** Accepted · 2026-10-31

## Bối cảnh

Desktop (webview của Tauri) và web dùng chung nhiều màn hình: debrief, ôn tập, glossary, tiến bộ. Team nhỏ, phần lớn code do agent AI viết, nên công nghệ phải phổ biến và có tài liệu tốt.

## Quyết định

- **React 19** cho cả desktop (Vite) và web (**Next.js App Router**).
- **Tailwind CSS 4** + **shadcn/ui** (component Radix được copy vào `@cuelingo/ui`, không phụ thuộc thư viện UI đóng). Design tokens sáng/tối nằm trong `@cuelingo/ui`.
- **TanStack Query** bọc `@cuelingo/core-sdk` để lo cache, retry và trạng thái tải. Hook `use-<x>` của feature dùng nó.
- **Zustand** chỉ cho state phiên họp ở desktop. **React Hook Form** + Zod resolver cho form.

## Phương án đã cân nhắc

- **Vite SPA cho web thay vì Next.js:** đơn giản hơn, nhưng thiếu SSR/route cho trang công khai sau này. Next.js phổ biến hơn với agent.
- **MUI / Chakra:** nhanh có component, nhưng khó tuỳ biến overlay nhỏ gọn và bundle nặng.

## Hệ quả

- Feature mẫu `glossary` cần chuyển sang TanStack Query + shadcn khi scaffold (giai đoạn Nền móng).
- Component dùng ở cả hai nơi phải nằm trong `@cuelingo/ui`.
