# mac-permissions — Xin quyền một lần, bắt đầu họp là nghe ngay

| Trạng thái | Loại | Nhánh / PR                   | Ước lượng → thực tế |
| ---------- | ---- | ---------------------------- | ------------------- |
| Spec       | bug  | `fix/mac-permissions` / _PR_ | M → ?               |

**Phạm vi:**

- **Trong** (app desktop macOS):
  - Xin quyền micro và âm thanh hệ thống ngay ở onboarding.
  - Giữ quyền qua các bản cập nhật.
  - Bắt đầu họp là thu âm ngay.
  - Báo rõ khi thiếu quyền.
  - Nạp sẵn model nhận dạng giọng nói.
- **Ngoài:**
  - Windows (chưa thu âm, đợt B).
  - Ký bằng Apple Developer ID và notarize (xem D3).

## 1. Vấn đề

Người dùng cài bản 0.1.5, bấm Bắt đầu họp thì gặp bốn vấn đề:

1. **Phải chờ khoảng 30 giây mới thấy popup xin quyền**, và sau khi cho phép phải chờ thêm khoảng 30 giây nữa mới có caption.
2. **Chỉ âm thanh hệ thống chạy, micro không nghe được.** Trong lúc họp, trang Cài đặt vẫn báo "Chưa xác định quyền micro".
3. **Mỗi bản cập nhật lại phải xin quyền từ đầu.**
4. **Xin quyền lúc bắt đầu họp là quá muộn**, vì khi đó người dùng đã ở trong cuộc họp.

Nguyên nhân gốc (đã đọc code và kiểm trên máy):

| Vấn đề | Nguyên nhân                                                                                                                                                                                                                             | Chỗ                                                        |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 1      | Sidecar **nạp model trước, xong mới mở thu âm**. Lần đầu chạy một bản mới, macOS biên dịch lại model CoreML, mất khoảng 30 giây. Popup xin quyền chỉ hiện khi bắt đầu thu                                                               | `native/macos-audio/Sources/Sidecar/main.swift`            |
| 2      | `MicCapture` không gọi `AVCaptureDevice.requestAccess`. Khi quyền còn "chưa xác định", `AVAudioEngine` vẫn chạy nhưng chỉ nhận im lặng, và không báo lỗi                                                                                | `native/macos-audio/Sources/AudioCapture/MicCapture.swift` |
| 3      | App ký **ad-hoc** (`signingIdentity: "-"`), còn sidecar mang identifier ngẫu nhiên (`cuelingo-audio-<hash>`). Mỗi bản build có yêu cầu chữ ký khác nhau, nên macOS (TCC) coi bản mới là một app khác và quyền đã cấp không còn tác dụng | `src-tauri/tauri.conf.json`, `scripts/sidecar.mjs`         |
| 4      | Onboarding chỉ mở Cài đặt hệ thống, không gọi hộp thoại xin quyền thật                                                                                                                                                                  | `src/onboarding/PermissionsStep.tsx`                       |

## 2. Quyết định kỹ thuật

| #   | Quyết định                                                                                                                                                                                                                                                                                                                                                                                 | Lý do                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| D1  | **Xin quyền ở onboarding:** micro bằng `requestAccess` (hộp thoại thật của macOS), âm thanh hệ thống bằng lần thử nghe đã có (phát "ping" và bật tap, đồng thời làm hiện hộp thoại). Xin xong thì kiểm lại, hiện trạng thái ✓ hoặc nút mở Cài đặt hệ thống                                                                                                                                 | Người dùng cấp quyền khi chưa vào họp. Bắt đầu họp không còn bị chặn bởi popup                                                                   |
| D2  | **Bắt đầu họp: mở thu âm trước, nạp model song song.** Âm thanh trong lúc nạp được giữ trong bộ đệm, tối đa 60 giây, rồi nhận dạng khi model sẵn sàng. Model được **nạp sẵn ở nền khi app mở** nếu onboarding đã xong                                                                                                                                                                      | Popup (nếu còn) hiện ngay. Câu nói trong lúc nạp không bị mất. Cuộc họp đầu tiên không phải chờ biên dịch                                        |
| D3  | **Ký bằng một chứng chỉ cố định** (self-signed, tạo một lần, lưu trong GitHub Secrets) cho app và sidecar. Sidecar có identifier cố định `vn.cmcai.cuelingo.audio`. Khi có Apple Developer ID thì đổi sang, người dùng chỉ phải cấp lại quyền một lần nữa                                                                                                                                  | Yêu cầu chữ ký giữ nguyên qua các bản, nên macOS giữ quyền. Không tốn phí. Gatekeeper vẫn cảnh báo như bây giờ                                   |
| D4  | **Không còn im lặng:** micro bị từ chối hoặc chưa cấp quyền thì sidecar báo trạng thái, UI hiện một dòng rõ ràng kèm nút "Mở Cài đặt". Caption của âm thanh hệ thống vẫn chạy                                                                                                                                                                                                              | Người dùng biết vì sao micro không có chữ                                                                                                        |
| D5  | **Model nhận dạng trên máy hiện ra rõ và tải ngay ở onboarding:** thêm bước "Tải model nhận dạng" sau bước quyền, ghi dung lượng, có thanh tiến độ, mặc định bật, bỏ qua được. Tải xong thì biên dịch luôn (thay cho nạp sẵn lúc mở app). Cài đặt có một dòng trạng thái model (chưa tải / đang tải / sẵn sàng) và nút tải lại. Ngôn ngữ nhận dạng đám mây (tiếng Việt) không cần bước này | Hiện model chỉ tải ngầm lúc bắt đầu họp, người dùng không biết nó tồn tại. Tải ở onboarding thì cuộc họp đầu không phải chờ, và G4 không còn nữa |

## 3. Tiêu chí chấp nhận (EARS)

| #   | AC                                                                                                                                                                                                                                                 | Test                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| AC1 | WHEN người dùng bấm "Cho phép micro" ở onboarding THE SYSTEM SHALL hiện hộp thoại xin quyền micro của macOS trong vòng 1 giây, rồi hiện trạng thái đã cấp hoặc bị từ chối. Bị từ chối thì có nút mở Cài đặt hệ thống                               | `PermissionsStep.test.tsx`; chạy thật trên Mac                             |
| AC2 | WHEN người dùng bấm "Cho phép âm thanh hệ thống" THE SYSTEM SHALL hiện hộp thoại xin quyền (lần đầu), phát tiếng thử và báo "Đã nghe được" hoặc hướng dẫn                                                                                          | `PermissionsStep.test.tsx`; chạy thật                                      |
| AC3 | WHILE quyền đã được cấp THE SYSTEM SHALL không hỏi lại khi mở app, khi bắt đầu họp, hay **sau khi cập nhật lên bản mới** được ký cùng chứng chỉ                                                                                                    | Chạy thật: cài X, cấp quyền, cập nhật lên X+1, không có popup              |
| AC4 | WHEN bắt đầu họp THE SYSTEM SHALL mở thu âm trong vòng 1 giây, kể cả khi model chưa nạp xong. Câu nói trong lúc nạp (tối đa 60 giây) vẫn ra caption khi model sẵn sàng                                                                             | Test Swift (pipeline buffer); chạy thật: đo từ lúc bấm đến khi mức âm động |
| AC5 | IF quyền micro bị từ chối hoặc chưa cấp lúc bắt đầu họp THEN THE SYSTEM SHALL hiện "Micro chưa được cấp quyền" kèm nút "Mở Cài đặt", và caption âm thanh hệ thống vẫn chạy                                                                         | `capture-problems.test.tsx`; test sidecar protocol                         |
| AC6 | WHEN app mở và onboarding đã xong THE SYSTEM SHALL nạp sẵn model nhận dạng ở nền, không chặn UI, chỉ một lần mỗi phiên bản                                                                                                                         | Test Rust/TS cho lệnh prewarm; chạy thật lần đầu sau cài                   |
| AC7 | Bản phát hành SHALL được ký bằng chứng chỉ cố định. Sidecar có identifier `vn.cmcai.cuelingo.audio`. CI kiểm `codesign -d -r-` ra đúng yêu cầu chữ ký mong đợi, sai thì job đỏ                                                                     | Bước kiểm trong `release.yml`                                              |
| AC8 | Không đổi hành vi trên Windows. Bản dev (không có chứng chỉ) vẫn build được với ký ad-hoc                                                                                                                                                          | CI Windows; `pnpm tauri dev` chạy được                                     |
| AC9 | WHEN onboarding tới bước model và ngôn ngữ dùng nhận dạng trên máy THE SYSTEM SHALL hiện dung lượng, tải model kèm tiến độ, kiểm checksum, rồi biên dịch; lỗi mạng thì báo rõ và cho thử lại hoặc bỏ qua. Cài đặt SHALL luôn hiện trạng thái model | `ModelStep.test.tsx`; chạy thật trên máy chưa có model                     |

UI tiếng Việt. Thành phần dùng chung đặt ở `@cuelingo/ui` nếu cả web và desktop đều dùng.

## 4. Cần chủ sản phẩm làm

- [ ] **Tạo chứng chỉ ký và lưu vào GitHub Secrets.** Mình tạo chứng chỉ trên máy bạn, rồi đặt `MACOS_CERT_P12` và `MACOS_CERT_PASSWORD` bằng `gh secret set`. Cần bạn đồng ý, vì đây là thao tác ra ngoài repo.
- [ ] **Sau khi cập nhật lên bản đầu tiên được ký bằng chứng chỉ cố định, cấp quyền lại một lần.** Từ bản đó trở đi không phải cấp lại nữa.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                                      |
| ---------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-16 | Spec | Mở hồ sơ theo phản hồi trên 0.1.5: micro không nghe, popup đến muộn khoảng 30 giây, mỗi bản lại xin quyền. Chủ sản phẩm yêu cầu xin quyền một lần ngay từ đầu, luồng trơn tru, và để techlead tự quyết hướng làm. D1–D4 do techlead chốt. Spec và plan gộp một cổng duyệt.                         |
| 2026-11-16 | Spec | Chủ sản phẩm: người dùng không biết model nhận dạng tồn tại; muốn hiện ở đâu đó hoặc mặc định tải lúc onboarding. Thêm D5 và AC9 (bước tải model ở onboarding, trạng thái ở Cài đặt). G4 (tự tải lúc mở app) bỏ.                                                                                   |
| 2026-11-16 | Plan | Plan duyệt, D5 đã vào plan (bước onboarding "Mô hình nhận dạng"; bỏ nạp sẵn lúc mở app). Chưa duyệt tạo chứng chỉ: code ký và CI rơi về ad-hoc khi thiếu secret. AC6 ("nạp sẵn lúc mở app") được D5 thay bằng AC9; AC6 còn lại ở dạng: prewarm không chạy khi đang họp và bị dừng khi bắt đầu họp. |
