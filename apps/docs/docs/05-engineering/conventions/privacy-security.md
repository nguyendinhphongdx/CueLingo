# Convention · Quyền riêng tư & bảo mật

Nguyên tắc: [02-architecture/security-privacy](../../03-architecture/05-security-privacy.md). Đây là luật khi code.

| #   | Luật                                                                                                                                   | 🔴 = chặn merge |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| 1   | `userId` chỉ từ auth context; mọi query lọc theo user                                                                                  | 🔴              |
| 2   | Không commit secret; secret qua biến môi trường, mẫu ở `.env.example`                                                                  | 🔴              |
| 3   | Không log transcript, câu nói, audio, token, email đầy đủ. Log id và độ dài                                                            | 🔴              |
| 4   | Audio chỉ rời máy khi người dùng chọn STT cloud; chỉ lưu khi người dùng bật                                                            | 🔴              |
| 5   | Xoá phiên/tài khoản phải xoá hết dữ liệu rút ra (transcript, event, audio); thêm bảng mới chứa dữ liệu người dùng → thêm vào luồng xoá | 🔴              |
| 6   | Nhà cung cấp AI/dịch vụ mới nhận dữ liệu người dùng → cần ADR + ghi vào danh sách dưới                                                 | 🔴              |
| 7   | Model/thư viện mới: kiểm license (tránh NC, AGPL, GPL bundle — [open-source](../../07-research/01-open-source.md))                     | 🔴              |
| 8   | Endpoint mới mặc định yêu cầu đăng nhập                                                                                                | 🟡              |

## Nhà cung cấp được duyệt nhận dữ liệu người dùng

_(chưa có — cập nhật khi chốt STT cloud / LLM / TTS theo ADR-0004)_
