# Tài liệu

Tài liệu đi từ tổng quát đến chi tiết. Người mới nên đọc theo thứ tự 00 → 01 → 02, rồi đi thẳng tới phần mình làm ở 03.

| Tầng                                         | Nội dung                                                            | Đọc khi                         |
| -------------------------------------------- | ------------------------------------------------------------------- | ------------------------------- |
| [00 · Tổng quan](00-overview/)               | Tầm nhìn, sơ đồ hệ thống, thuật ngữ                                 | Lần đầu vào dự án               |
| [01 · Sản phẩm](01-product/)                 | Tính năng, phạm vi MVP, lộ trình                                    | Cần biết làm gì và vì sao       |
| [02 · Kiến trúc](02-architecture/)           | Luồng realtime, Learner Model, AI, dữ liệu, bảo mật                 | Thiết kế xuyên nhiều phần       |
| [03 · Từng phần](03-parts/)                  | Mỗi phần (app/service/package) một thư mục, mỗi module một tài liệu | Bắt tay code một module         |
| [04 · Nghiên cứu](04-research/)              | Khảo sát open source, benchmark                                     | Chọn công nghệ, model           |
| [05 · Engineering](05-engineering/README.md) | Convention, extension points, checklist review, module mẫu          | **Trước khi viết code**         |
| [06 · Delivery](06-delivery/README.md)       | Hồ sơ từng task: spec, plan, review                                 | Bắt đầu một task không đơn giản |
| [ADR](adr/)                                  | Các quyết định kiến trúc và lý do                                   | Muốn biết vì sao chọn X         |

## 00 · Tổng quan

- [Tầm nhìn & nguyên tắc](00-overview/vision.md)
- [Sơ đồ hệ thống](00-overview/system-overview.md)
- [Thuật ngữ](00-overview/glossary.md)

## 01 · Sản phẩm

- [Bản đồ tính năng](01-product/features.md)
- [Phạm vi MVP](01-product/mvp-scope.md)
- [Lộ trình](01-product/roadmap.md)

## 02 · Kiến trúc

- [Luồng realtime trong cuộc họp](02-architecture/realtime-pipeline.md)
- [Learner Model](02-architecture/learner-model.md)
- [Kiến trúc AI](02-architecture/ai-architecture.md)
- [Mô hình dữ liệu](02-architecture/data-model.md)
- [Bảo mật & quyền riêng tư](02-architecture/security-privacy.md)

## 03 · Từng phần

| Phần                                           | Code               | Modules                                                                                                 |
| ---------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------- |
| [Desktop app](03-parts/desktop/README.md)      | `apps/desktop`     | audio-capture, local-stt, tauri-core, session-controller, overlay, quick-assist, onboarding, settings   |
| [Web app](03-parts/web/README.md)              | `apps/web`         | library, debrief, review, phrase-bank, progress, glossary, account-privacy                              |
| [API service](03-parts/api/README.md)          | `services/api`     | auth, sessions, realtime, assist, debrief, phrases-review, learner, progress, glossary, privacy, events |
| [Workers](03-parts/workers/README.md)          | `services/workers` | debrief-job, learner-recompute, tts-cache, retention                                                    |
| [Shared packages](03-parts/packages/README.md) | `packages/*`       | shared, core-sdk, learner-model, ai-gateway, prompts, ui                                                |
| [ML & evaluation](03-parts/ml/README.md)       | `ml/`              | bench, eval                                                                                             |

Mỗi tài liệu module có cùng cấu trúc: Trách nhiệm · Phạm vi MVP · Interface · Phụ thuộc · Dữ liệu & sự kiện · Câu hỏi mở.

## 04 · Nghiên cứu

- [Open source cho từng thành phần](04-research/open-source.md)
- [Benchmark STT + dịch](04-research/benchmark-stt-mt.md)

## 05 · Engineering

- [Extension points](05-engineering/extension-points.md) · [Convention theo tầng](05-engineering/README.md) · [Checklist review](05-engineering/conventions/code-review.md)

## 06 · Delivery

- [Cách mở hồ sơ task](06-delivery/README.md) · [Mẫu](06-delivery/_template/)

## Quy ước

- Viết tài liệu bằng tiếng Việt; tên code, API, bảng, event giữ tiếng Anh.
- Khi đổi thiết kế một module, sửa tài liệu module trong cùng PR với code.
- Quyết định khó đảo ngược → thêm một ADR mới, không sửa ADR cũ (đánh dấu "Superseded").
