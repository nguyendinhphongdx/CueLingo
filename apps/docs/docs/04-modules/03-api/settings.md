# Settings

> Phần: [API service](./README.md) · Code: `services/api/src/modules/settings/`

Cài đặt cá nhân đi theo tài khoản giữa web và các máy desktop.

## Interface

| Method  | Path              | Input                | Output         |
| ------- | ----------------- | -------------------- | -------------- |
| `GET`   | `/v1/me/settings` | —                    | `UserSettings` |
| `PATCH` | `/v1/me/settings` | `UpdateUserSettings` | `UserSettings` |

PATCH nhận một phần; riêng `overlay` được deep merge. Schema strict từ chối khoá lạ và giá trị ngoài khoảng.

## Dữ liệu

- `learner_profiles.assist_default`: `0 | 1 | 3 | 4`
- `learner_profiles.settings.overlay`: `fontSize` 14–28, `opacity` 55–100, `theme` sáng/tối
- `learner_profiles.settings.saveAudio`: boolean, mặc định `false`
- Không cần migration mới; mọi `SELECT`/`UPDATE` lọc bằng `request.userId` từ auth context

Mặc định đầy đủ: Assist 4, chữ 18 px, nền 88%, giao diện tối, không lưu audio.
