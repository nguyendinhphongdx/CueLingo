# Convention · Lười có kỷ luật

Trước khi viết code mới, đi lần lượt từng bậc và **dừng ở bậc đầu tiên giải quyết được**:

1. **Có cần không?** Không có AC/spec đòi hỏi → không làm (YAGNI).
2. **Đã có trong repo chưa?** Tìm trong `packages/*`, module mẫu, `lib/`.
3. **Thư viện chuẩn / dependency đang dùng làm được không?** (zod, fastify, postgres, ts-fsrs…)
4. **Tính năng có sẵn của nền tảng?** (Postgres constraint thay cho code kiểm tra, pg-boss thay cho queue tự viết)
5. **Một dòng có đủ không?**
6. Chỉ khi đó mới viết phần tối thiểu cần thiết.

Không áp dụng "lười" cho: kiểm tra ranh giới người dùng, validate input, xử lý lỗi, quyền riêng tư.

## Thêm dependency mới

Kiểm license, độ bảo trì, kích thước. Dependency chạy trong app desktop/web phải nhẹ. Ghi lý do trong PR.
