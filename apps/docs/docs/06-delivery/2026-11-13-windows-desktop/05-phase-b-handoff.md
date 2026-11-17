# Bàn giao đợt B — làm trên máy Windows thật

Dành cho Claude Code (hoặc người) chạy **trên PC Windows**. Đợt A đã xong và đã merge vào `main` (logic sidecar, STT Parakeet, UI theo nền tảng, release hai nền tảng, trang tải theo hệ điều hành, nút tải Windows đang ẩn). Đợt B là phần **chỉ làm và kiểm được trên Windows thật**. Plan gốc: [02-plan.md](./02-plan.md) (các bước 7, 10 đến 14, spike S1, S3, S4), quyết định: [ADR 0020](../../08-adr/0020-windows-capture-stt.md) và 0021.

## 1. Chuẩn bị máy

| Cần                                                 | Ghi chú                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Windows 10 22H2 (build 19045) hoặc Windows 11       | x64; có micro và loa/tai nghe; **nên thêm một VM Win10 sạch** để thử bản cài (AC3)    |
| Node ≥ 22.19 (khuyến nghị 24, xem `.nvmrc`) và pnpm | Máy Mac dùng 22.14 nên `pnpm test:int` không chạy được; Windows cần đúng Node         |
| Rust stable (MSVC) + Visual Studio Build Tools      | `cargo`, `link.exe`, Windows SDK                                                      |
| Inno Setup 6 (`ISCC`), WebView2 Evergreen           | cho bước 10                                                                           |
| Git, `gh` đã đăng nhập                              | chỉ để xem CI; **không push, không tag** nếu chưa được người dùng bảo                 |
| Docker (tuỳ chọn)                                   | `pnpm test:int` (cần Postgres) cho migration `20261117090000_feedback_kind_other.sql` |

```bash
git fetch && git checkout feat/ui-redesign   # hoặc main nếu nhánh này đã merge
pnpm install
pnpm verify                                  # nền tảng phải xanh trước khi sửa gì
pnpm --filter @cuelingo/desktop dev          # giao diện trong trình duyệt (cổng 1420)
cd apps/desktop/native/windows-audio && cargo test
```

Đọc trước: `AGENTS.md`, `apps/desktop/AGENTS.md`, plan và ADR ở trên. Luật 7 (`apps/desktop`): mọi thay đổi audio phải thử bằng **một cuộc gọi thật** (Meet/Zoom/Teams).

## 2. Việc cần làm, theo thứ tự

| #   | Việc                                                                                                                                                                                                                                                                                                                                           | Qua khi                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **S1 + bước 7: thu âm WASAPI** trong `native/windows-audio/src/capture.rs` (đang trả `Unavailable`). Loopback thiết bị output mặc định + micro mặc định (`cpal`; dự phòng crate `wasapi`), mở lại khi đổi thiết bị; `--permissions` đọc `ConsentStore\microphone`; `--check-system-audio`; lỗi mang tiền tố `system audio:` hoặc `microphone:` | Cả hai luồng có tiếng; frame đầu < 500 ms; lệch < 1 % sau cuộc Meet 10 phút; cắm/rút tai nghe và Bluetooth HFP vẫn tiếp tục; tắt quyền micro thì báo đúng và luồng kia vẫn chạy |
| 2   | **Họp thật end to end:** bật họp trong app, caption tiếng Anh hiện qua STT on-device, mức âm, "Câu mới nhất", debrief                                                                                                                                                                                                                          | Một cuộc họp 10 phút thật có caption, không treo, RAM ≤ 1,5 GB, p95 ≤ 1,0 s cho câu ≤ 8 s (đo lại **S2 trên PC thật**, đợt A chỉ đo trên runner CI)                             |
| 3   | **S4: overlay** trong suốt, luôn trên cùng, `contentProtected` khi chia sẻ màn hình trên Teams, Zoom, Meet (Chrome), cả khi app họp toàn màn hình                                                                                                                                                                                              | Overlay không lọt vào bản chia sẻ, nằm trên app họp, không giành focus (nếu không: `WS_EX_NOACTIVATE` qua HWND, ghi hạn chế vào ADR 0020)                                       |
| 4   | **S3 + bước 11: updater với bản cài Inno** (chọn 2c-A hoặc 2c-B trong plan)                                                                                                                                                                                                                                                                    | Cập nhật không UI, không UAC; app tự mở lại đúng bản; gói sai `.sig` bị từ chối; cài/gỡ không cần admin; `cuelingo://` mở đúng instance đang chạy                               |
| 5   | **Bước 10: bản cài Inno** (`CueLingo.iss`, `scripts/windows-installer.mjs`) chạy trên VM Win10 sạch                                                                                                                                                                                                                                            | Cài không UAC, có WebView2, Start Menu, gỡ xoá model và token                                                                                                                   |
| 6   | **Bước 12: `release.yml` job `windows`** và **tag thử** trên fork/repo phụ trước tag thật (R12: job Windows hỏng sẽ chặn cả bản macOS)                                                                                                                                                                                                         | Job Windows xanh trên đường phát hành thật                                                                                                                                      |
| 7   | **Bước 14: kiểm tay AC3 đến AC9** trên VM Win10 và máy Win11; **cập nhật thật X → X+1**; sau đó mới mở nút tải Windows (đặt `NEXT_PUBLIC_DOWNLOAD_URL_WINDOWS`, `VITE_DOWNLOAD_URL_WINDOWS`)                                                                                                                                                   | Checklist ở [02-plan.md](./02-plan.md) mục 10 đều tích                                                                                                                          |

Thứ tự này khớp phụ thuộc trong plan (7 → 8 đã có → 10 → 11 → 12 → 14). Bước nào không qua tiêu chí dừng thì **dừng và báo người dùng** (đừng tự đổi sang STT đám mây: phải có ADR, migration, bước đồng ý).

## 3. Kiểm giao diện mới trên Windows

Giao diện vừa được thiết kế lại (nhánh `feat/ui-redesign`, hồ sơ `../2026-11-16-ui-redesign/`). Chưa ai mở nó trên Windows. Khi chạy app thật, xem:

- Phông Be Vietnam Pro nạp (bundle sẵn, không cần mạng), thanh cuộn mảnh, cửa sổ không dùng `dragRegion`, sidebar không bị đè bởi thanh tiêu đề.
- Trang Phiên họp: danh sách sẵn sàng. Trên Windows **không có quyền "ghi âm hệ thống"**: dòng đó phải hiện "Không cần cấp quyền", micro bị chặn thì có nút mở `ms-settings:privacy-microphone`; ẩn mục Lịch.
- Overlay: NoticeBar và ngăn kéo Nói giúp không giành focus; nút "Mở Cài đặt" đưa cửa sổ chính lên (đã thêm quyền `core:window:allow-show`, `allow-set-focus` trong `src-tauri/capabilities/default.json`, kiểm thật trên Windows).
- Phím tắt hiện `Ctrl+Shift+L/W/S`, onboarding 6 bước, nội dung các trang chiếm hết chiều rộng ở 1280 và 1920.
- Chế độ sáng và tối theo hệ điều hành.

Lỗi nào thuộc UI chung thì sửa trong `packages/ui` (luật 11), không vá riêng ở desktop.

## 4. Quy tắc làm việc

- Làm theo [task-loop](../../05-engineering/workflows/task-loop.md): mở nhánh riêng (`feat/windows-phase-b`), mỗi bước ≈ 1 commit, `pnpm verify` xanh trước khi sang bước sau; sửa docs thì `pnpm docs:build`.
- Chỉ **commit khi người dùng bảo**; không push, không tạo tag, không đổi khoá ký, không đụng secret.
- Đổi interface hoặc hành vi của module: sửa trang trong `apps/docs/docs/04-modules/01-desktop/` cùng commit; ghi kết quả spike và lệch plan vào [03-review.md](./03-review.md) (hiện còn là mẫu).
- Tiếng Việt cho UI và docs; code, comment, commit bằng tiếng Anh.

## 5. Câu lệnh mở đầu cho Claude Code trên Windows

```text
Đọc AGENTS.md, apps/desktop/AGENTS.md và apps/docs/docs/06-delivery/2026-11-13-windows-desktop/05-phase-b-handoff.md rồi làm đợt B theo đúng thứ tự trong mục 2. Bắt đầu bằng việc chạy pnpm verify và cargo test, sau đó spike S1 + bước 7 (thu âm WASAPI). Dừng và hỏi tôi khi một tiêu chí dừng không qua; chỉ commit khi tôi bảo.
```
