# Convention · Checklist review

**Checklist duy nhất** cho tự review, agent `code-reviewer` và người review. Các nơi khác trỏ vào đây, không chép lại.

Mức: 🔴 chặn merge · 🟡 nên sửa · 🟢 tuỳ chọn.

## 1. Ranh giới & bảo mật — 🔴

- [ ] `userId` chỉ từ auth context; mọi query lọc theo user; có test user B không chạm được dữ liệu user A
- [ ] Không secret, không log dữ liệu nhạy cảm ([privacy-security](privacy-security.md))
- [ ] Input không tin cậy đi qua `parse(Schema)`

## 2. Hợp đồng — 🔴

- [ ] Schema/DTO ở `@cuelingo/shared`, không khai báo lại ở app/service
- [ ] Đổi schema → API, client, app sửa cùng commit
- [ ] Migration chỉ thêm file mới

## 3. Kiến trúc — 🔴

- [ ] Đúng điểm mở rộng ([extension-points](../extension-points.md)); không vá quanh kiến trúc
- [ ] `pnpm check:deps` xanh; không gọi SDK AI ngoài gateway
- [ ] Layout giống module mẫu; routes không chứa business logic

## 4. AI — 🔴 nếu đụng AI

- [ ] Prompt có phiên bản; đầu ra có schema; có kết quả `ml/eval` khi đổi model/prompt
- [ ] Ghi chi phí qua gateway

## 5. Test — 🟡

- [ ] Mỗi AC có test; test ranh giới người dùng cho module API
- [ ] `pnpm verify` xanh; đã chạy thật luồng vừa sửa

## 6. Docs — 🟡

- [ ] Doc module trong `docs/03-parts/` khớp code (Interface, Dữ liệu & sự kiện)
- [ ] Thuật ngữ mới đã vào [glossary](../../00-overview/glossary.md); quyết định lớn có ADR

## 7. Phạm vi & vệ sinh — 🟢

- [ ] Không làm vượt phạm vi task; không refactor "tiện thể"
- [ ] Không code chết, không `console.log`, không `any` vô cớ
