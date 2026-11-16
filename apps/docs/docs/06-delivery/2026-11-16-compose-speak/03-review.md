# compose-speak — Review

| Hạng mục                                                  | Kết quả                                                                                                                                                                             |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify` (format, lint, typecheck, test, check:deps) | Xanh                                                                                                                                                                                |
| `pnpm docs:build`                                         | Xanh (khi để dossier admin-console, đang nằm ở nhánh khác, ra ngoài; nó link tới một dossier chỉ có trên nhánh chuyển khoản, sẽ hết lỗi khi hai nhánh gộp)                          |
| Test mới                                                  | `tts.test.ts` (AC4, AC5, giọng thử, AC7), `settings.test.ts` và `settings.int.test.ts` (lưu, giọng lạ bị từ chối, ranh giới người dùng), `speakable-option.test.tsx` (AC1 phần nút) |

## Chưa làm / chưa chạy thật

- Chưa nghe thật cả 6 giọng trên model nhỏ (R1): cần API thật có khoá Gemini và bản đã triển khai. Nếu giọng nào lỗi thì bỏ khỏi `TTS_VOICES`.
- Chưa xem giao diện trên cửa sổ app và trình duyệt: hàng nút Nghe/Sao chép, hàng 6 giọng có vừa chiều ngang không.
- AC2 (vòng quay rồi tiếng, bấm lại để dừng) và AC3 (chữ "Đã sao chép" 2 giây) chỉ kiểm bằng code của `useSpeaker`/`SpeakableOption`, chưa thao tác thật.
- AC6 (hết lượt tạo tiếng thì báo rõ): máy chủ trả 429 có test từ trước; thông báo "Đã dùng hết lượt nghe" trên giao diện chưa làm, hiện chỉ hiện "Không phát được".

## Quyết định ngoài plan

- `SpeakButton`/`useSpeaker` thêm `scope` và `forgetSpokenAudio()`, vì bộ nhớ âm thanh khoá theo văn bản sẽ phát nhầm giọng cũ sau khi đổi giọng.
- Bỏ `selectedIndex`, `copyStatus` và `selectOption` khỏi hook Nói giúp; `copyOption(index, text)` ghi sự kiện `compose_used`.
