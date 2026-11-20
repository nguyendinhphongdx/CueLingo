# Thông báo hệ thống

> Code: `apps/desktop/src/notifications` · Hồ sơ: [06-delivery/2026-11-19-system-notifications](../../06-delivery/2026-11-19-system-notifications/01-specs.md)

## Trách nhiệm

Khi CueLingo chạy nền (không cửa sổ nào của app đang ở trước), báo bằng thông báo của hệ điều hành. Chữ cố định, **không chứa** lời thoại, tên người, tiêu đề họp hay thuật ngữ.

## Phạm vi MVP

| Sự kiện                          | Tiêu đề / nội dung                                          | Bấm vào mở |
| -------------------------------- | ----------------------------------------------------------- | ---------- |
| Debrief tạo xong (`ready`)       | Debrief đã sẵn sàng                                         | Cuộc họp   |
| Micro không dùng được            | Không dùng được micro nên CueLingo chưa nghe được giọng bạn | Cài đặt    |
| Không thu được âm thanh hệ thống | Không thu được âm thanh hệ thống của cuộc họp               | Cài đặt    |

Không làm: hết hạn mức dịch, lịch họp sắp tới.

## Interface

| Thành phần                       | Việc                                                                                                |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| `createNotifier(deps)`           | Logic thuần: tắt công tắc → im; app đang ở trước → im; mỗi `kind:key` chỉ một lần; lỗi gửi bị nuốt. |
| `useSystemNotifications(onOpen)` | Gắn ở `App`: theo dõi `micFailed`, `systemFailed` (khoá = `startedAt`) và debrief (khoá = id họp).  |
| `NotificationSettings`           | Công tắc trong Cài đặt → Họp và caption. Bật lần đầu thì xin quyền hệ thống.                        |
| `native-gate`                    | Bọc `@tauri-apps/plugin-notification` và `getAllWindows().isFocused()`.                             |

- Công tắc lưu **trên máy** (`localStorage` `cuelingo.notifications`), mặc định bật.
- Hệ điều hành từ chối quyền → Cài đặt giải thích và có nút **Mở cài đặt** (`PRIVACY_PANES.notifications`, nằm trong allowlist `open_external`).
- Không xác định được trạng thái cửa sổ → coi như app đang ở trước (im lặng).

## Bấm vào thông báo

Plugin trên desktop **không có callback khi bấm** (chỉ mobile). Hệ điều hành tự đưa app lên trước; app nhớ đích của thông báo gần nhất trong 2 phút (`TARGET_TTL_MS`) và điều hướng khi cửa sổ chính lấy lại focus (`meetings` hoặc `settings`).

## Quyền riêng tư

Chữ cố định, không log, không gửi ra ngoài. Không thêm nhà cung cấp mới.

## Kiểm thử

Logic thuần có test (`notifications.test.ts`). Hiện thông báo thật chỉ thấy từ app đã đóng gói trên macOS (`tauri dev` mượn danh tính Terminal); Windows chưa thử.
