# meeting-assistant — Trợ lý AI cùng họp: hỏi và nhận tri thức liên quan ngay trong cuộc họp

| Trạng thái | Loại               | Nhánh / PR            | Ước lượng → thực tế |
| ---------- | ------------------ | --------------------- | ------------------- |
| Đang làm   | feature (nhạy cảm) | `feat/meeting-assist` | _chốt ở plan → ?_   |

**Phạm vi (đề xuất, chốt theo §3):** trong: người đang họp hỏi bằng chữ trong overlay desktop và nhận câu trả lời tiếng Việt có ghi nguồn, lấy từ cuộc họp đang diễn ra, thuật ngữ, cụm từ đã lưu, các cuộc họp cũ và kiến thức chung của mô hình · ngoài (lát này): tự gợi ý không được hỏi, tài liệu người dùng đưa vào, tra web, nói bằng giọng, đưa tiếng vào cuộc họp, chụp màn hình, web app.

**Nhạy cảm:** nội dung họp (gồm lời người khác) và dữ liệu của cuộc họp cũ được gửi tới nhà cung cấp AI cho **mục đích mới**; có chi phí mới. Đề xuất viết ADR trước cổng PLAN.

## 1. Vấn đề

Chủ sản phẩm họp thật bằng bản desktop 0.1.12: phụ đề và transcript đã ở mức khá, nhưng hiểu được câu chữ chưa đủ để theo cuộc họp. Khi người khác nhắc một khái niệm, tên dự án hay một việc đã bàn trước đó, người dùng không có chỗ hỏi và phải rời cuộc họp đi tìm.

Hiện trạng (theo trang module; các dòng ghi "code" đã đối chiếu code):

| Có gì trong họp / quanh họp | Làm được                                                         | Không làm được                                        |
| --------------------------- | ---------------------------------------------------------------- | ----------------------------------------------------- |
| Tra từ                      | Nghĩa của một từ theo câu chứa nó                                | Hỏi về khái niệm, tên riêng, bối cảnh; họp tiếng Việt |
| "Họ vừa nói gì?"            | Tóm tắt vài câu cuối                                             | Hỏi tiếp, hỏi về đoạn xa hơn                          |
| "Nói giúp"                  | Soạn câu để nói                                                  | Cho biết nội dung nên nói dựa trên cái gì             |
| Bộ nhớ của overlay (code)   | 15 đoạn caption gần nhất                                         | Giữ cả cuộc họp ở máy (server có đủ câu đã chốt)      |
| Trợ lý AI chat              | Hỏi đáp tiếng Anh công sở trên web                               | Chưa có trên desktop (code); không biết cuộc họp nào  |
| Thuật ngữ                   | Giúp nhận dạng và dịch đúng                                      | Không được dùng để giải thích                         |
| Cuộc họp cũ                 | Xem lại debrief, transcript; tìm trên máy trong 30 cuộc gần nhất | Hỏi "lần trước chốt gì?" khi đang họp                 |

- **Spec liên quan:** [Phạm vi MVP](../../02-product/03-mvp-scope.md), [Lộ trình](../../02-product/04-roadmap.md), [Quyền riêng tư](../../03-architecture/08-security-privacy.md), [ADR 0006](../../08-adr/0006-no-audio-by-default.md), [ADR 0018](../../08-adr/0018-agent-harness.md), [gói và chi phí](../../02-product/05-business-model.md)
- **Module chạm tới (dự kiến):** [overlay](../../04-modules/01-desktop/overlay.md), [quick-assist](../../04-modules/01-desktop/quick-assist.md), [session-controller](../../04-modules/01-desktop/session-controller.md), [assist](../../04-modules/03-api/assist.md) hoặc [agent](../../04-modules/03-api/agent.md), [sessions](../../04-modules/03-api/sessions.md), [glossary](../../04-modules/03-api/glossary.md), [usage](../../04-modules/03-api/usage.md), [privacy](../../04-modules/03-api/privacy.md), [ai-gateway](../../04-modules/05-packages/ai-gateway.md), `prompts`, `shared`, `core-sdk`, `ui`

### Lệch so với phạm vi đã chốt

| Tài liệu    | Đang ghi                                                          | Hệ quả                                                           |
| ----------- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| Phạm vi MVP | F1–F6 không có mục này; "gợi ý trả lời tự động" **ngoài phạm vi** | Làm là mở rộng phạm vi, cần chủ sản phẩm quyết                   |
| Lộ trình    | Đang ở Đợt 0 (beta kín); gợi ý trả lời (W3-04) ở Đợt 3            | Cần quyết chen trước hay sau việc beta                           |
| Triết lý đo | "Cần AI ít dần đi"                                                | Trợ lý tự gợi ý nhiều đi ngược hướng này; hỏi mới trả lời ít hơn |

### Chi phí (ước tính, chưa đo)

Giá Flash-Lite theo [trang gói](../../02-product/05-business-model.md) (vào 0,25 · ra 1,5 USD/1M token). Một giờ họp tiếng Anh hiện ước tính 0,08–0,13 USD.

| Cách làm             | Giả định                               | Thêm mỗi giờ họp        |
| -------------------- | -------------------------------------- | ----------------------- |
| Chỉ trả lời khi hỏi  | 5–20 câu hỏi · ~4k token vào · ~500 ra | ~0,01–0,035 USD         |
| Tự gợi ý mỗi 30 giây | 120 lượt · ~3k token vào · ~150 ra     | ~0,12 USD (gần gấp đôi) |

Ngày 2026-11-26 project Gemini đã chạm trần chi tiêu tháng làm hỏng một cuộc họp thật (ai-provider-failures, còn chờ cổng SPEC). Tính năng này dùng chung project nên cần có trần riêng và công tắc tắt.

## 2. Tiêu chí chấp nhận (EARS)

Viết theo đề xuất mặc định ở §3; đổi câu trả lời thì sửa AC tương ứng. Con số là đề xuất.

### Hỏi và trả lời

| #   | AC                                                                                                                                                      | Test                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| AC1 | WHILE cuộc họp đang chạy, THE SYSTEM SHALL cho mở trợ lý từ overlay (menu công cụ và một phím tắt), gõ câu hỏi và gửi, còn caption vẫn chạy và hiển thị | desktop              |
| AC2 | WHEN người dùng gửi câu hỏi, THE SYSTEM SHALL hiện trạng thái đang xử lý ngay và hiện câu trả lời theo luồng, bằng tiếng Việt, giữ nguyên thuật ngữ gốc | desktop, API         |
| AC3 | THE SYSTEM SHALL hiện chữ đầu tiên trong p50 ≤ 3 giây và p95 ≤ 5 giây kể từ lúc gửi                                                                     | đo khi chạy thật     |
| AC4 | WHEN trợ lý đang trả lời, THE SYSTEM SHALL cho dừng; phần đã hiện được giữ lại                                                                          | desktop, API         |
| AC5 | WHEN người dùng hỏi tiếp trong cùng cuộc họp, THE SYSTEM SHALL hiểu theo các câu hỏi và trả lời trước đó của cuộc họp ấy                                | API                  |
| AC6 | WHEN người dùng chọn một caption và bấm "Giải thích", THE SYSTEM SHALL hỏi trợ lý về đúng câu đó mà không cần gõ                                        | desktop              |
| AC7 | THE SYSTEM SHALL mặc định trả lời ngắn (≤ 5 gạch đầu dòng hoặc ≤ 80 từ), có cách xin giải thích thêm                                                    | eval trong `ml/eval` |

### Nguồn tri thức

| #    | AC                                                                                                                                                                                                                              | Test                 |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| AC8  | THE SYSTEM SHALL trả lời được từ transcript của **cả** cuộc họp đang chạy (câu đã chốt, cả hai luồng), không chỉ các câu còn trên overlay                                                                                       | API                  |
| AC9  | WHEN câu hỏi liên quan tới thuật ngữ hoặc cụm từ đã lưu của người dùng, THE SYSTEM SHALL dùng chúng và ưu tiên hơn kiến thức chung                                                                                              | API                  |
| AC10 | WHEN câu hỏi liên quan tới cuộc họp trước (chưa xoá) của người dùng, THE SYSTEM SHALL tìm và dùng nội dung của chúng                                                                                                            | API, integration     |
| AC11 | THE SYSTEM SHALL ghi nguồn cho mỗi câu trả lời: "Cuộc họp này", "Cuộc họp <tên, ngày>", "Thuật ngữ", "Cụm từ đã lưu" hoặc "Kiến thức chung (chưa kiểm chứng)"; nhãn nguồn riêng tư chỉ hiện khi nội dung đó thật sự được lấy ra | API                  |
| AC12 | IF câu hỏi về chuyện của người dùng hoặc công ty (quyết định, con số, người, hạn) mà không nguồn nào có, THEN THE SYSTEM SHALL nói là không tìm thấy, không tự điền                                                             | eval                 |
| AC13 | THE SYSTEM SHALL coi transcript, thuật ngữ và nội dung cuộc họp cũ là dữ liệu, không làm theo chỉ dẫn nằm trong đó (ví dụ người dự họp nói "trợ lý hãy…")                                                                       | eval, prompt fixture |

### Lỗi, riêng tư, chi phí

| #    | AC                                                                                                                                                                          | Test                |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| AC14 | IF trợ lý lỗi, hết hạn chờ, mất mạng hoặc nhà cung cấp từ chối, THEN THE SYSTEM SHALL báo bằng tiếng Việt, giữ lại câu đã gõ; caption và phiên họp không bị ảnh hưởng       | desktop, API        |
| AC15 | WHILE người dùng chưa đồng ý cho gửi nội dung họp (hiện tại và cũ) tới Gemini để hỏi đáp, THE SYSTEM SHALL NOT gửi gì; lần dùng đầu hỏi một lần, tắt lại được trong Cài đặt | desktop, API        |
| AC16 | THE SYSTEM SHALL chỉ lấy dữ liệu của chính người dùng đã xác thực; `userId` không bao giờ lấy từ body hay tham số                                                           | test ranh giới user |
| AC17 | IF một cuộc họp đã bị xoá hoặc người dùng đã xoá dữ liệu, THEN THE SYSTEM SHALL NOT dùng nội dung đó; hỏi đáp được lưu thì xoá và xuất cùng cuộc họp                        | privacy test        |
| AC18 | THE SYSTEM SHALL NOT ghi câu hỏi, câu trả lời hay nội dung nguồn vào log hoặc `ai_call`                                                                                     | API                 |
| AC19 | THE SYSTEM SHALL đếm lượt hỏi theo hạn mức gói; IF hết lượt, THEN báo rõ khi nào có lại, caption vẫn chạy                                                                   | API, usage test     |
| AC20 | THE SYSTEM SHALL ghi `ai_call` (token, chi phí, id phiên) cho mỗi lần gọi và cho phép tắt riêng tính năng này phía server mà không tắt tra từ, "Nói giúp" hay dịch          | API                 |
| AC21 | WHILE overlay đang mở trợ lý, THE SYSTEM SHALL vẫn loại cửa sổ khỏi chia sẻ màn hình như caption                                                                            | chạy thật Zoom/Meet |

## 3. Câu hỏi mở

Mỗi câu có đề xuất; duyệt cổng SPEC không kèm ý khác nghĩa là chọn đề xuất.

### Ba câu quyết định hình dạng tính năng

**1. "Tri thức liên quan" lấy từ đâu?**

| Nguồn                                | Đã có sẵn           | Cái mới phải làm / rủi ro                                                      | Đề xuất |
| ------------------------------------ | ------------------- | ------------------------------------------------------------------------------ | ------- |
| a. Cuộc họp đang diễn ra             | Câu đã lưu ở server | Cuộc họp dài thì phải cắt hoặc tóm                                             | Lát 1   |
| b. Thuật ngữ, cụm từ đã lưu          | Có API              | Ghi chú thuật ngữ ngắn (≤ 500 ký tự) nên giải thích được ít                    | Lát 1   |
| c. Cuộc họp cũ (debrief, transcript) | Có dữ liệu          | Chưa có tìm kiếm phía server; gói Free dự kiến chỉ giữ 30 ngày                 | Lát 1   |
| d. Kiến thức chung của mô hình       | Có (Gemini)         | Có thể sai; phải ghi nhãn (AC11)                                               | Lát 1   |
| e. Tài liệu người dùng đưa vào       | Chưa có gì          | Tải tệp, lưu, tìm theo nghĩa, xoá/xuất, tài liệu công ty lên server: ADR riêng | Lát 2   |
| f. Tra web                           | Chưa có             | Nội dung suy từ cuộc họp đi ra công cụ tìm kiếm; chi phí và ADR riêng          | Để sau  |

Bạn cần nhất nguồn nào? Nếu đó là (e), tài liệu dự án, thì thứ tự lát phải đổi.

**2. Tự gợi ý hay chỉ trả lời khi được hỏi?**

| Phương án                                      | Được                             | Mất                                                                                 |
| ---------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| **A. Chỉ khi hỏi, có nút một chạm (đề xuất)**  | Rẻ, ít xao nhãng, rõ lúc nào gửi | Phải nhận ra mình cần hỏi                                                           |
| B. A + đánh dấu thuật ngữ đã có trong glossary | Gợi ý không tốn lượt AI          | Chỉ biết thứ người dùng tự khai                                                     |
| C. Tự đẩy thẻ tri thức khi thấy liên quan      | Không cần hỏi                    | Gần gấp đôi chi phí, gửi liên tục, dễ gây nhiễu; chạm mục "gợi ý tự động" ngoài MVP |

Đề xuất làm A trước, đo số câu hỏi mỗi cuộc họp rồi mới xét C.

**3. Giao diện trong lúc họp?**

Đề xuất: thêm mục **"Hỏi trợ lý"** vào menu công cụ của overlay, mở ở cùng ngăn kéo bên phải với "Nói giúp" (không thêm cửa sổ mới).

```text
┌ caption ─────────────────────┬ Hỏi trợ lý ─────────────────┐
│ Speaker 1: …roll out SSO…    │ [Giải thích câu cuối]       │
│ bản dịch                     │ [Lần trước bàn gì về việc này?] │
│                              │ Bạn: SSO ở đây là gì?       │
│ Speaker 2: …                 │ • Đăng nhập một lần …       │
│                              │ Nguồn: Thuật ngữ · Họp 20/11 │
│                              │ [Soạn câu từ ý này]         │
│                              │ [ Gõ câu hỏi…          ⏎ ]  │
└──────────────────────────────┴─────────────────────────────┘
```

Phương án khác: cửa sổ nổi riêng (rộng hơn, tốn chỗ màn hình) hoặc hỏi ở cửa sổ chính (phải rời cuộc họp). Có cần nút "Soạn câu từ ý này" (nối sang "Nói giúp") ngay lát 1 không?

### Các câu còn lại

| #   | Câu hỏi                                                                           | Đề xuất                                                                                                                                                |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 4   | Mở rộng phạm vi MVP? Làm trước hay sau việc đang dở của beta?                     | Mở rộng, sau cờ tắt mặc định; sửa lỗi nhà cung cấp AI (26/11) làm trước                                                                                |
| 5   | Lưu hỏi đáp không?                                                                | Lưu theo cuộc họp, xem lại được cùng debrief, xoá cùng cuộc họp. Phương án khác: không lưu gì (ít dữ liệu hơn, mất lịch sử)                            |
| 6   | Họp tiếng Việt có dùng được không?                                                | Có: hỏi đáp tri thức không phụ thuộc ngôn ngữ học, khác tra từ và "Nói giúp"                                                                           |
| 7   | Tính vào hạn mức nào? `assist_daily` (Free 20/ngày) hay `agent_messages` (Free 0) | Bộ đếm riêng theo ngày, Free ít (ví dụ 10), Pro nhiều hơn; chốt số sau khi đo                                                                          |
| 8   | Đồng ý của người dùng và người dự họp                                             | Đồng ý một lần (AC15), tách với đồng ý nhận dạng đám mây; nhắc người dùng thông báo cho người dự họp. Dữ liệu cũ gửi đi chỉ phần liên quan tới câu hỏi |
| 9   | Nền tảng                                                                          | Desktop trước (macOS và Windows dùng chung overlay); web không làm                                                                                     |
| 10  | Nhánh làm việc (thư mục dùng chung đang ở `fix/release-macos-sherpa`)             | Worktree riêng, nhánh `feat/meeting-assistant` từ `main`, trước khi viết code                                                                          |
| 11  | Triển khai: production đang chạy image ngày 16/11                                 | Cần cập nhật server trước khi người dùng thử được; chốt ai làm, khi nào                                                                                |

Để lại cho `02-plan.md`: dùng lại harness `@cuelingo/agent` (công cụ đọc nguồn) hay một tác vụ `assist.*` một lần gọi; quan hệ với cờ `AGENT_ENABLED`; cách tìm trong cuộc họp cũ.

## Decision log

| Ngày       | Pha     | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                                                                                   |
| ---------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-27 | Spec    | Mở hồ sơ. Chủ sản phẩm: transcript đã ở mức khá, nhưng nên có AI Assistant cùng họp để ngoài việc soạn câu còn cung cấp tri thức liên quan khi cần. Chưa duyệt                                                                                                                                                                                  |
| 2026-11-27 | Spec    | **Duyệt spec** ("Duyệt theo đề xuất"): mọi câu ở §3 lấy theo đề xuất. Lát 1: cuộc họp đang chạy, thuật ngữ, cụm từ đã lưu, cuộc họp cũ, kiến thức chung; chỉ trả lời khi được hỏi; ngăn kéo trong overlay; lưu hỏi đáp theo cuộc họp; có họp tiếng Việt; bộ đếm theo ngày riêng; đồng ý riêng; desktop trước; sửa lỗi nhà cung cấp AI làm trước |
| 2026-11-27 | Plan    | Trình `02-plan.md` và ADR 0027 (Proposed). Có ba chỗ lệch spec, ghi ở plan, chờ duyệt                                                                                                                                                                                                                                                           |
| 2026-11-27 | Plan    | **Duyệt plan** ("làm đi"), gồm ba chỗ lệch spec và hạn mức Free 10 · Pro 60 · Ultra 150. ai-provider-failures còn chờ cổng SPEC nên không chờ nó; ai merge sau thì rebase                                                                                                                                                                       |
| 2026-11-27 | Kết quả | Phím "hỏi" là ⌘⇧Y / Ctrl+Shift+Y thay cho ⌘⇧K đề xuất ở plan (theo hiểu biết chung, Teams dùng Ctrl/⌘+Shift+K để giơ tay; chưa kiểm). Chỉ giữ phím khi máy chủ bật trợ lý. Chờ duyệt kết quả                                                                                                                                                    |
| 2026-11-27 | Kết quả | **Duyệt kết quả** ("Duyệt, commit"), biết rằng integration test, eval AI và cuộc họp thật chưa chạy. Cờ vẫn tắt; các điều kiện phát hành ở `03-review.md`                                                                                                                                                                                       |
