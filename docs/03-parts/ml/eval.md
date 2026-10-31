# Eval

> Phần: [ML & evaluation](README.md) · Code: `ml/eval/`

Bộ test hồi quy cho prompt/model: dịch, recap, debrief. Chạy trước mỗi lần đổi model hoặc prompt.

## Trách nhiệm

- Golden set 20 cuộc họp (được phép dùng)
- Chấm tự động (COMET, LLM-as-judge) + mẫu cho người review
- Báo cáo so sánh phiên bản

## Phạm vi MVP

- Tiêu chí nghiệm thu: WER ≤ 12%, ≥ 90% câu dịch đúng ý

## Interface

- `python run_eval.py --task translate --prompt v2`

## Phụ thuộc

- (chưa có)

## Dữ liệu & sự kiện

- (chưa có)

## Câu hỏi mở

- Nguồn 20 cuộc họp test có đồng ý
