# 0006 · Mặc định không lưu audio

**Trạng thái:** Accepted · 2026-10-31

## Quyết định

- Không lưu audio trừ khi người dùng bật. Khi bật, lưu theo đoạn và tự xoá sau 30 ngày.
- Xoá phiên → xoá transcript, audio, event trong ≤ 24 giờ. Thẻ ôn giữ lại nhưng bỏ câu gốc.
- Chỉ dùng nhà cung cấp AI cam kết không huấn luyện trên dữ liệu khách hàng.

## Hệ quả

- Tính năng "nghe lại đoạn khó" chỉ có khi người dùng bật lưu audio. Nếu không bật thì phát bằng TTS.
