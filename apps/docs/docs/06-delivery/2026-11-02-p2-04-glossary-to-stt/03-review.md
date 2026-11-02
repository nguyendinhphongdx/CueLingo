# Review — p2-04-glossary-to-stt

**Trạng thái:** chờ AC7 (chạy thật trên máy). Mọi thứ còn lại đã kiểm xong.

## Thay đổi so với plan

| Dấu         | File / hành vi                                                                      | Chi tiết (lý do nếu khác plan)                                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🟡 MODIFIED | `src-tauri/src/commands.rs`                                                         | `clean_vocabulary` bỏ mục lỗi, chỉ từ chối khi nhận về hơn 200 mục; lệnh `session_set_vocabulary`; `SessionStartOpts.vocabulary`. Khác plan: bỏ mục lỗi thay vì từ chối cả danh sách (review) |
| 🟡 MODIFIED | `src-tauri/src/audio_bridge.rs`                                                     | `sidecar_command` (đặt `CUELINGO_VOCAB`), `set_vocabulary`, `vocab_line`. Tách `sidecar_command` để test được đường bắt đầu (review)                                                          |
| 🟡 MODIFIED | `src-tauri/src/lib.rs`                                                              | Đăng ký lệnh                                                                                                                                                                                  |
| 🟡 MODIFIED | `src/lib/native.ts`                                                                 | `Vocabulary` (≤ 200 × 120), `native.setVocabulary` (async)                                                                                                                                    |
| 🟡 MODIFIED | `src/session/session-controller.ts`, `use-session.ts`                               | Tải glossary có hạn 1,5 s, `refreshVocabulary` gom 500 ms, số thứ tự lượt tải, cờ làm mới khi đang khởi động, thay ngay khi đổi ngôn ngữ                                                      |
| 🟡 MODIFIED | `src/insights/use-glossary.ts`, `index.ts`                                          | Báo thay đổi sau mỗi lần sửa; export `insightsApi` để `session` gọi qua `index.ts`                                                                                                            |
| 🟢 ADDED    | `src/lib/glossary-changes.ts`, `src/session/glossary-refresh.ts` và các file test   | Sự kiện nội bộ và hàm nối sự kiện (tách ra để test)                                                                                                                                           |
| 🟡 MODIFIED | `apps/docs/docs/04-modules/01-desktop/{tauri-core,local-stt,session-controller}.md` | Lệnh mới, giao thức `vocab`, giới hạn cụm nhiều từ, hành vi làm mới                                                                                                                           |

**Docs chưa cập nhật (cố ý):** `06-backlog.md` và `01-features.md` ở nhánh `docs/roadmap-b2c`, không có trên nhánh này. P2-04 giữ ◐ cho tới khi AC7 xong, rồi đổi ✅ ở nhánh docs.

## Tự review

Theo [checklist](../../05-engineering/conventions/code-review.md):

- [x] Ranh giới & bảo mật — thuật ngữ không bị log, mã lỗi cố định; ký tự điều khiển bị bỏ nên một thuật ngữ không thể chèn lệnh vào stdin của sidecar
- [x] Hợp đồng — không đổi `@cuelingo/shared`
- [x] Kiến trúc — Rust chỉ kiểm và chuyển tiếp; TS gọi API qua lớp đã có; `session` gọi `insights` qua `index.ts`; `depcruise` không báo vi phạm
- [x] AI — không đổi
- [x] Test — AC1–AC4, AC6 có test; AC5 kiểm bằng mã lỗi không chứa thuật ngữ (không có lệnh log trong module)
- [x] Docs — ba trang module
- [x] Phạm vi — không sửa Swift, không đụng API glossary

```bash
pnpm format:check && pnpm lint && pnpm typecheck && pnpm test   # 473 test xanh
pnpm exec depcruise apps services packages --config .dependency-cruiser.cjs --exclude '(^|/)\.env'   # không vi phạm
cd apps/desktop/src-tauri && cargo test && cargo clippy -- -D warnings   # 13 test xanh, clippy sạch
pnpm docs:build   # xanh
```

**Chưa chạy được trọn vẹn:** `pnpm check:deps` đứng nguyên đỏ trong sandbox vì không đọc được `apps/desktop/.env` (EPERM); đã chạy `depcruise` cùng cấu hình nhưng loại `.env` ra khỏi phần quét.

**Đã chạy thật:** chưa. AC7 (caption hiện đúng "SLA" trong một cuộc họp thật) cần người dùng, xem bên dưới.

## AC7 — cách kiểm tay

1. Chạy API (`pnpm --filter @cuelingo/api dev`) và app desktop (`pnpm --filter @cuelingo/desktop tauri dev`), đăng nhập.
2. Trang Thuật ngữ, thêm "SLA" (và vài thuật ngữ thật của bạn, ví dụ tên sản phẩm 5 chữ trở lên).
3. Bắt đầu một cuộc họp (Zoom/Meet hoặc phát một video tiếng Anh) rồi nói/phát câu chứa "SLA" ("the SLA is tight").
4. Đọc caption tiếng Anh gốc: "SLA" phải hiện đúng, không phải "sla" hay "slaw". Ghi lại vài từ thường bị sửa nhầm sang thuật ngữ (nếu có).
5. Khi đang họp, thêm thuật ngữ mới ở trang Thuật ngữ, chờ vài giây, nói câu chứa nó và xem có được sửa không (AC2).

Kết quả: _chưa có_

## Cho người review — đọc theo thứ tự

| #   | File                                                  | Soi gì                                                                        |
| --- | ----------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | `src-tauri/src/commands.rs` (`clean_vocabulary`)      | Giới hạn, bỏ mục lỗi, không lộ thuật ngữ trong lỗi                            |
| 2   | `src-tauri/src/audio_bridge.rs`                       | `sidecar_command`, `vocab_line`: không thể chèn lệnh thứ hai                  |
| 3   | `src/session/session-controller.ts`                   | Số thứ tự lượt tải, hạn 1,5 s, làm mới khi đang khởi động, dọn timer khi dừng |
| 4   | `src/session/session-controller.test.ts` (khối races) | Test có thật sự đỏ khi hành vi hỏng                                           |

## Lỗi tìm thấy khi review/test

| Lỗi                                                                                             | Tìm ở                  | Sửa                                                           |
| ----------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------- |
| Một thuật ngữ có tab/xuống dòng làm `session_start` thất bại, họp không bắt đầu được (trái AC4) | Review `code-reviewer` | Bỏ mục lỗi ở Rust, lọc cùng luật ở TS; test với "Acme\tCloud" |
| Danh sách cũ có thể ghi đè danh sách mới (lượt tải muộn)                                        | Cả hai review          | Số thứ tự lượt tải; 3 test đảo thứ tự                         |
| Giới hạn 200 mục kiểm sau khi bỏ mục rỗng                                                       | Review Codex           | Kiểm trên danh sách nhận về trước khi lọc                     |
| Lần sửa glossary lúc đang khởi động bị mất                                                      | Review `code-reviewer` | Cờ `refreshPending`, chạy ngay khi thu âm bắt đầu             |
| `session` import thẳng `insights/insights-api`                                                  | Review Codex           | Export qua `insights/index.ts`                                |
| Thiếu test đường bắt đầu của Rust và đường nối sự kiện glossary → controller                    | Review Codex           | `sidecar_command` + test; `glossary-refresh.ts` + test        |

**Không sửa:** test bắt log cho AC5 (Rust không có logging, đã đổi cách kiểm trong spec). Nhánh kiểm `language !== meetingLanguage` giờ thừa trên mọi đường hiện tại; giữ lại làm lớp bảo vệ thứ hai.
