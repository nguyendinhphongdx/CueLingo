# Review — ui-redesign, đợt 1 (nền)

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                                                                | Chi tiết (lý do nếu khác plan)                                                                                                                                       |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟢 ADDED    | `badge`, `tabs`, `skeleton`, `status-row`, `notice-strip`, `empty-state`                                                      | `Tabs` có phím mũi tên, Home, End, `aria-controls`                                                                                                                   |
| 🟢 ADDED    | token `--scrim`, `--elev-*`, `--motion-*`; test `contrast.test.ts`, `tabs.test.tsx`, `states.test.tsx`                        | `--elev-*` ánh xạ sang `--shadow-*` trong `@theme inline`; `--motion-*` thay `--ease-*` để không đè `ease-out` của Tailwind                                          |
| 🟡 MODIFIED | `globals.css`, `brand.css`, base component                                                                                    | Bỏ hex, `dark:`, `text-white`, `bg-black`; `--success`, `--warning`, `--destructive` sáng đậm hơn bản vẽ để chữ trên nền nhạt đạt 4.5:1 (đo bằng `contrast.test.ts`) |
| 🟡 MODIFIED | `--brand` giữ `#4f46e5` ở cả tối                                                                                              | Chữ trắng trên `surface-live` giữ tương phản                                                                                                                         |
| 🟡 DEVIATED | phông `@fontsource/be-vietnam-pro` (tĩnh 400–700), không phải bản variable                                                    | Be Vietnam Pro không có gói variable trên npm (404); JetBrains Mono dùng variable                                                                                    |
| ⏭ DEFERRED  | `FilterCard`, căn `Card`/`StatCard`/`Kbd`, AC5 (quét logo chép tay), AC2 (test không client nào khai lại token), token cỡ chữ | Làm cùng đợt 2 khi có màn dùng tới                                                                                                                                   |

**Docs đã cập nhật:** `04-modules/05-packages/ui.md`, `05-engineering/conventions/shared-ui.md`.

## Tự review

Đã chạy agent `code-reviewer`; sửa: lớp phủ dialog ở chế độ tối, bàn phím cho Tabs, tương phản Badge, token bóng không có tác dụng, ghi đè `--ease-out`, focus ring cũ, `h-9` lệch, site chưa nhận phông, `--brand` tối.

```bash
pnpm verify   # format, lint, typecheck, 2134 test xanh; check:deps xanh khi chạy ngoài sandbox
pnpm docs:build
```

Đã chạy thật: mở desktop UI (`localhost:1420`) sáng và tối, token và phông nạp đúng, không cuộn ngang. Chưa chạy: web, ba khổ 375/768/1280 (AC20), dialog ở chế độ tối.

## Cho người review — đọc theo thứ tự

| #   | File                                                 | Soi gì                       |
| --- | ---------------------------------------------------- | ---------------------------- |
| 1   | `packages/ui/src/styles/globals.css`                 | giá trị token sáng/tối       |
| 2   | `packages/ui/src/styles/contrast.test.ts`            | cặp tương phản được kiểm     |
| 3   | `packages/ui/src/components/tabs.tsx`                | phím tắt và id               |
| 4   | `packages/ui/src/components/button.tsx`, `input.tsx` | chiều cao 40, focus ring 2px |
