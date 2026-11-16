# admin-console — Thanh bên chia nhóm thu gọn được và khu Quản trị

| Trạng thái | Loại    | Nhánh / PR                  | Ước lượng → thực tế |
| ---------- | ------- | --------------------------- | ------------------- |
| Review     | feature | `feat/admin-console` / _PR_ | L → L               |

**Phạm vi:**

- **Trong:**
  - Thanh bên dùng chung (`SidebarNav` trong `@cuelingo/ui`): mỗi nhóm (Họp, Học, Ứng dụng…) thu gọn hoặc mở được.
  - Nhóm mới **Quản trị** trong thanh bên chính, chỉ admin thấy. Nhóm này thay thanh liên kết `AdminNav` hiện có.
  - Các trang thống kê cho admin, chỉ dùng dữ liệu đã có: Tổng quan, Người dùng và gói, Doanh thu, Lượng dùng, Hoạt động app. Giữ các trang Trợ lý AI và Mã mời.
- **Ngoài:**
  - Xuất CSV.
  - Phân quyền nhiều cấp admin (vẫn dùng `ADMIN_EMAILS`).
  - Gửi dữ liệu cho dịch vụ analytics bên ngoài.
  - Xem nội dung cuộc họp hay transcript.
  - Thống kê theo nền tảng và phiên bản app: chưa có dữ liệu, xem Q4.

**Phụ thuộc:**

- [admin-users-plans](../2026-11-15-admin-users-plans/01-specs.md) (trang Người dùng và gói, `GET /v1/admin/dashboard`).
- [W2-03](../2026-11-15-w2-03-vietqr-upgrade/01-specs.md) (`billing_orders`).

Cả hai đều chưa merge (xem Q5).

## 1. Vấn đề

**Thanh bên ngày càng dài.** Các nhóm Họp, Học, Ứng dụng luôn mở, nên khi thêm mục thì thanh bên dài ra.

**Khu admin bị tách khỏi app.** Admin nằm ở các URL `/admin/...`, không có trong thanh bên, và chỉ có một thanh liên kết riêng (`AdminNav`).

**Chủ sản phẩm thiếu một nơi để xem tình hình kinh doanh và sử dụng:**

- bao nhiêu người đang dùng, dùng bao nhiêu, ở gói nào;
- doanh thu theo ngày và tháng, tỉ lệ đơn được trả;
- ai sắp chạm hạn mức;
- app có đang được dùng đều không.

Hiện chỉ có `/admin/metrics`: số liệu tổng, không có biểu đồ, không có doanh thu hay lượng dùng theo gói.

**Người bị ảnh hưởng:**

- Admin hoặc chủ sản phẩm (chính).
- Mọi người dùng, gián tiếp, vì thanh bên đổi hành vi.

**Spec và module liên quan:**

- [Số liệu nội bộ](../../04-modules/02-web/admin-metrics.md), [Admin API](../../04-modules/03-api/admin.md), [usage](../../04-modules/03-api/usage.md)
- Trang module `ui` (`SidebarNav`, `AppFrame`, `roadmap.ts`) và [shared-ui](../../05-engineering/conventions/shared-ui.md)

## 2. Tiêu chí chấp nhận (EARS)

| #    | AC                                                                                                                                                                                                                                                                                      | Test                                       |
| ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| AC1  | WHEN người dùng bấm tiêu đề một nhóm trong thanh bên (chuột, Enter hoặc Space) THE SYSTEM SHALL thu gọn hoặc mở nhóm đó, với `aria-expanded` đúng trạng thái. Áp dụng cho cả web và desktop vì cùng component.                                                                          | `sidebar-nav.test.tsx` › collapse          |
| AC2  | WHEN mở lại app hoặc trang THE SYSTEM SHALL giữ trạng thái thu gọn của từng nhóm trên thiết bị đó. Nhóm chứa trang đang mở luôn mở. Thanh bên thu gọn thì vẫn hiện được ở màn hình hẹp.                                                                                                 | `sidebar-nav.test.tsx` › persist           |
| AC3  | WHILE người dùng là admin (API xác nhận) THE SYSTEM SHALL hiện nhóm **Quản trị** cuối thanh bên với các mục: Tổng quan · Người dùng & gói · Doanh thu · Lượng dùng · Hoạt động app · Trợ lý AI · Mã mời. IF không phải admin, hoặc chưa xác nhận xong, THEN nhóm này không render.      | `sidebar-nav.test.tsx` › admin group       |
| AC4  | IF người không phải admin mở bất kỳ trang `/admin/*` THEN trang hiện `404`. Mọi endpoint thống kê mới trả `403` cho người không phải admin và `401` khi chưa đăng nhập.                                                                                                                 | `admin-analytics.test.ts` › forbidden      |
| AC5  | WHEN admin mở **Tổng quan** THE SYSTEM SHALL hiện: tổng người dùng; người mới 7 và 30 ngày; người hoạt động 1, 7 và 30 ngày; số người Free/Pro/Ultra (gói còn hạn); doanh thu tháng này; số gói sắp hết hạn trong 7 ngày; biểu đồ người mới và người hoạt động theo ngày trong 30 ngày. | `admin-analytics.test.ts` › overview       |
| AC6  | WHEN admin mở **Doanh thu** THE SYSTEM SHALL hiện doanh thu theo ngày (30 ngày) và theo tháng (12 tháng, giờ VN); doanh thu chia theo gói và kỳ; số đơn theo trạng thái; tỉ lệ đơn được trả (`paid` / đơn đã tạo); số lần admin tặng gói. Đơn 0đ của admin không tính vào doanh thu.    | `admin-analytics.test.ts` › revenue        |
| AC7  | WHEN admin mở **Lượng dùng** THE SYSTEM SHALL hiện tổng tháng này của từng hạn mức (giờ dịch, giờ STT cloud, debrief, lượt trợ lý), trung bình mỗi người theo gói, số người đã dùng ≥ 80% và 100% hạn mức (kèm link sang danh sách đã lọc), và chi phí AI ước tính.                     | `admin-analytics.test.ts` › usage          |
| AC8  | WHEN admin mở **Hoạt động app** THE SYSTEM SHALL hiện số cuộc họp và số giờ họp theo ngày (30 ngày); DAU/WAU/MAU tính theo phiên họp; tỉ lệ debrief thành công; độ trễ debrief; giữ chân D1/D7. Nội dung này gồm số liệu đang có ở `/admin/metrics` cộng thêm phần theo ngày.           | `admin-analytics.test.ts` › activity       |
| AC9  | Các trang Tổng quan, Doanh thu, Lượng dùng và Hoạt động chỉ trả **số tổng hợp**, không có email, id người dùng hay nội dung cuộc họp. Chỉ trang Người dùng & gói hiện định danh (như admin-users-plans). Mọi endpoint chỉ đọc.                                                          | `admin-analytics.test.ts` › no identifiers |
| AC10 | IF một chỉ số chưa đủ dữ liệu THEN THE SYSTEM SHALL hiện "Chưa đủ dữ liệu" thay vì 0. Mỗi trang có giờ tính số liệu và nút tải lại.                                                                                                                                                     | `*.test.tsx`                               |
| AC11 | WHEN admin đang ở một trang admin THE SYSTEM SHALL dùng khung app chung (`AppFrame` + thanh bên chính). `AdminFrame` và `AdminNav` bị bỏ.                                                                                                                                               | `AdminPages.test.tsx`                      |

UI tiếng Việt. Biểu đồ, thẻ số liệu và nhóm thu gọn đặt ở `@cuelingo/ui` (luật 11).

## 3. Câu hỏi mở

- [ ] **Q1. Desktop có nhóm Quản trị không?** Đề xuất: **chỉ web.** Desktop vẫn có thanh bên thu gọn được (AC1–AC2), nhưng không có nhóm Quản trị, vì các trang admin chỉ dựng trên web. Phương án khác: desktop có nhóm Quản trị nhưng mỗi mục mở trang web tương ứng.
- [ ] **Q2. Biểu đồ dùng thư viện nào?** Đề xuất: thêm **Recharts** (MIT, dựa trên React và SVG) vào `@cuelingo/ui`, gói trong vài component (`LineChartCard`, `BarChartCard`). Phương án khác: tự vẽ SVG đơn giản, không thêm phụ thuộc, nhưng ít tính năng (tooltip, trục thời gian).
- [ ] **Q3. Cách tính "người hoạt động".** Đề xuất: người có ít nhất một phiên họp hoặc một phiên ôn tập trong khoảng thời gian đó (dữ liệu đã có). Không thêm bảng theo dõi lần mở app.
- [ ] **Q4. Thống kê theo nền tảng và phiên bản app** (Mac/Windows/web, 0.1.4/0.1.5…): hiện chưa ghi. Đề xuất: **để đợt sau**, vì cần một migration và header từ app. Đợt này làm từ dữ liệu sẵn có.
- [ ] **Q5. Thứ tự làm:** trang Người dùng & gói và dashboard đang ở nhánh `feat/w2-03-vietqr-upgrade` chưa merge. Đề xuất: **merge W2-03 và admin trước** (cần chạy thật với PayOS hoặc bạn duyệt riêng phần admin), rồi cắt `feat/admin-console` từ `main`. Phương án khác: cắt nhánh mới từ `feat/w2-03-vietqr-upgrade` và làm luôn.
- [ ] **Q6. Thời gian sống của số liệu:** tính lúc gọi API, có cache 60 giây ở API (đề xuất), hay tính sẵn bằng job ở workers.

## Decision log

| Ngày       | Pha  | Quyết định / lý do bị từ chối                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ---------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-11-16 | Spec | Mở hồ sơ theo yêu cầu "thanh menu chia section thu gọn được, có một section riêng cho admin: danh sách user và tình trạng sub, doanh thu, dashboard metric usage, tình trạng sử dụng app…". Analytics chỉ dùng dữ liệu đã có.                                                                                                                                                                                                                         |
| 2026-11-16 | Spec | **Duyệt spec** theo đề xuất: Q1 nhóm Quản trị chỉ trên web; Q2 Recharts (MIT) trong `@cuelingo/ui`; Q3 hoạt động = phiên họp hoặc ôn tập; Q4 nền tảng/phiên bản để đợt sau; Q5 merge W2-03 + admin trước rồi cắt `feat/admin-console` từ `main`; Q6 tính lúc gọi, cache 60 giây ở API.                                                                                                                                                                |
| 2026-11-16 | Plan | Chủ sản phẩm yêu cầu: (1) giao admin console cho một subagent làm song song; (2) sidebar desktop phải đồng bộ với web; (3) nhóm Học gọn lại. Đổi Q5: không chờ merge W2-03, `feat/admin-console` cắt từ `feat/w2-03-vietqr-upgrade` (xếp chồng, merge sau W2-03). Sidebar: thu gọn nhóm nằm trong `SidebarNav` dùng chung nên desktop tự có, nhóm Quản trị vẫn chỉ web (Q1). Nhóm Học: đề xuất riêng, chờ duyệt, không nằm trong phạm vi nhánh admin. |
| 2026-11-16 | Làm  | Làm xong trên `feat/admin-console` (xếp chồng trên `feat/w2-03-vietqr-upgrade` 303a3ec). Phần nhẹ của thanh bên (nhóm Quản trị, `useIsAdmin`) tách thành feature `admin-nav` riêng: luật `web-features-via-index` cấm `AppShell` import file con của `features/admin`, còn import qua index của nó sẽ kéo Recharts vào chunk của mọi trang đã đăng nhập. Kết quả ở [03-review.md](./03-review.md).                                                    |
