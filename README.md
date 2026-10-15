# SmartBus Ticketing System

> **Giao diện BubuBus Kawaii 3D Cartoon**: toàn bộ UI/UX đã được đồng bộ theo mascot xe bus xanh pastel, Fredoka/Baloo 2/Nunito, card bo tròn, animation nhẹ và responsive. Chi tiết: [docs/UI_REDESIGN_KAWAII.md](docs/UI_REDESIGN_KAWAII.md). Logic nghiệp vụ, API, database và routing không đổi.

Ứng dụng bán vé xe buýt theo tuyến Hà Nội – Thái Nguyên. Workspace gồm React/Vite, REST API Express, PostgreSQL-compatible schema chạy được trên PGlite hoặc PostgreSQL, xác thực cookie session, điều hành tuyến/chuyến, vé QR, GPS simulator và phân tích nhu cầu.

## Trạng thái

Các luồng có integration/unit/E2E coverage trong repo: đăng nhập, tìm tuyến/chuyến, trạng thái seat map, giữ ghế đồng thời + expiry 10 phút, sandbox payment/idempotency + callback ký HMAC, QR/PDF invoice, hoàn tiền tự động sandbox, vé tháng, upload minh chứng ưu đãi riêng tư, complaint/review, audit/RBAC, analytics/forecast/backtest/export, route/bus/schedule/assignment, driver scan/replay/camera path, GPS simulator + ETA + notification, seed 60 ngày và responsive viewport suite. Ma trận chi tiết nằm ở [docs/REQUIREMENTS_MATRIX.md](docs/REQUIREMENTS_MATRIX.md).

Đề cho phép dùng Sandbox/Development mode khi thiếu API key bên thứ ba. Project vì vậy triển khai đầy đủ luồng MoMo/VNPay/ZaloPay/Bank Card bằng sandbox có trạng thái, idempotency, signed webhook callback và automatic refund; sandbox không thu tiền thật. Khi triển khai production chỉ cần thay adapter bằng merchant credential/provider endpoint thật, không phải thay đổi booking core.

## Sprint 1–5

Workspace chỉ có tài liệu nghiệm thu chính thức `SPRINT1_LUAN_KHANH_DUY.md`; phần chia Sprint 2–5 dưới đây là nhóm chức năng theo source hiện có, không thay thế backlog/acceptance criteria chính thức.

- Sprint 1: countdown giữ chỗ, hủy/đổi vé và test cũ. Các trang `src/pages/*`/`src/services/ticketService.js` là mock legacy, không nằm trong router chạy hiện tại; flow thật dùng `features/passenger` và API DB.
- Sprint 2: auth/RBAC, search route/date/time, seat map, 10-minute hold, booking/payment sandbox, ticket/QR/PDF invoice.
- Sprint 3: cancellation/refund, trip change, GPS/Leaflet simulator, notifications, driver scan/incident.
- Sprint 4: operations CRUD, schedule/assignment, pass/discount/voucher, user/role/audit, complaints.
- Sprint 5: dashboard/occupancy, Excel/PDF export, peak analytics, WMA forecast/backtest và recommendations.

## Kiến trúc

- Frontend: React 19, Vite 8, React Router, Tailwind CSS 4, Recharts, Leaflet/OSM, ZXing camera QR.
- API: Node.js 22+, Express 5, JSON REST `/api`, cookie session HttpOnly/SameSite, password hash scrypt.
- Database mặc định: PGlite persistent tại `data/pg`; production có thể đặt `DATABASE_URL` để dùng PostgreSQL. `server/schema.sql` chạy idempotent qua `CREATE TABLE IF NOT EXISTS` và `ALTER ... IF NOT EXISTS`.
- Giao dịch giữ ghế, thanh toán, refund, assignment, vé tháng và scan được thực hiện trong DB transaction; partial unique index khóa ghế đang held/paid/checked-in.
- Leaflet hiển thị OSM. GPS simulator nội suy vị trí theo tọa độ trạm ở backend; frontend chỉ poll vị trí đã lưu.
- Backend SQLite/Java trong `backend/` là skeleton cũ, không được dùng bởi scripts/API hiện tại; runtime đang theo Node + PGlite/PostgreSQL.

## Cài đặt và chạy

Yêu cầu Node.js 22+ và npm.

```powershell
npm install
npm run dev:full
```

Chạy một lệnh duy nhất:

```powershell
npm run dev
```

Lệnh này khởi động **cả backend API (port 3001) và frontend Vite (port 5173)**. Mở `http://127.0.0.1:5173`.

Trong development/demo, database mặc định chạy trong RAM để tránh lỗi PGlite `RuntimeError: Aborted()` trên một số máy Windows/Node 22. Mỗi lần khởi động hệ thống sẽ tự seed lại account mẫu và dữ liệu lịch sử. Nếu muốn lưu PGlite persistent, đặt `DATA_DIR=data/pg` trong `.env`; nếu persistent DB lỗi ở development, server tự fallback sang RAM thay vì làm API chết/502.

Muốn chạy riêng từng phần:

```powershell
npm run server
npm run dev:web
```

## Cấu hình

Sao chép `.env.example` thành `.env` khi cần cấu hình local. Không commit secrets.

| Biến | Mặc định | Mô tả |
|---|---|---|
| `PORT` | `3001` | Cổng REST API |
| `DEMO_MODE` | `true` | Seed demo và sandbox payments |
| `DATA_DIR` | trống (RAM ở development) | Đặt `data/pg` nếu muốn PGlite persistent; demo tự fallback RAM khi mở persistent thất bại |
| `DATABASE_URL` | trống | PostgreSQL connection string; ưu tiên hơn PGlite |
| `SMARTBUS_ORIGIN` | trống | Danh sách origin production được phép, phân tách dấu phẩy |
| `TRUST_PROXY` | `false` | Bật khi API thực sự sau trusted reverse proxy |
| `NODE_ENV` | development | Production bật Secure cookie và giới hạn CORS/Origin |

`DEMO_MODE=true` bật sandbox có signed callback/refund để demo an toàn. `DEMO_MODE=false` cố ý không giả lập thanh toán: API từ chối nếu chưa gắn merchant adapter thật, tránh hệ thống production báo thanh toán giả thành công.

## Vai trò và demo accounts

Mật khẩu chung: `SmartBus@123`.

| Email | Vai trò |
|---|---|
| `admin@smartbus.demo` | ADMIN |
| `manager@smartbus.demo` | MANAGER |
| `driver@smartbus.demo` | DRIVER |
| `passenger@smartbus.demo` | PASSENGER |

Admin quản lý user/role/lock/audit. Manager quản lý route, stop, bus, trip/schedule, refund, voucher, discount review, complaint và analytics. Driver chỉ tác nghiệp chuyến được phân công. Passenger chỉ đọc/chỉnh sửa dữ liệu cá nhân và booking của mình.

## Demo flow

1. Passenger đăng nhập, tìm ngày/giờ, chọn ghế, giữ chỗ 10 phút, nhập voucher, sandbox pay và mở QR/PDF invoice tại Vé của tôi.
2. Driver chọn chuyến được giao, bắt đầu chuyến, quét QR bằng camera hoặc nhập mã; scan lại bị từ chối.
3. Manager tạo route, bus, trip hoặc schedule; lịch xe/tài xế trùng sẽ bị từ chối.
4. Passenger theo dõi xe ở `/tracking`; demo location do backend simulator cập nhật, vị trí tài xế thật chỉ có khi bật chia sẻ GPS.
5. Manager xem dashboard, refund, analytics, occupancy và xuất XLSX/PDF.
6. Admin quản lý role/khóa user và tìm audit logs.

## API chính

Tất cả route dưới đây có prefix `/api`; session dùng cookie và frontend gửi `credentials: include`.

- Auth: `POST /auth/register`, `/auth/login`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`; `GET /auth/me`; `PATCH /profile`; `POST /profile/password`, `/profile/discount`, `/profile/discount-evidence`; `GET /private-files/:id`.
- Tìm/đặt vé: `GET /routes`, `/stops`, `/trips?origin=&destination=&date=&time=&routeId=`; `GET /trips/:id`; `POST /holds`, `/holds/:id/release`, `/payments`, `/payments/webhook/:provider`.
- Vé: `GET /tickets`, `GET /tickets/:id/qr`, `/tickets/:id/invoice`; `POST /tickets/:id/cancel`, `/tickets/:id/change`, `/tickets/:id/email`.
- Passenger services: `/passes`, `/passes/:id/renew`, `/notifications`, `/notifications/:id/read`, `/feedback`, `/complaints`.
- Driver: `GET /driver/trips`; `POST /driver/scan`, `/driver/incidents`, `/driver/trips/:id/status`, `/driver/trips/:id/location`.
- Operations: `/admin/routes`, `/admin/stops`, `/admin/buses`, `/admin/trips`, `/admin/schedules`, `/admin/users`, `/admin/discounts`, `/admin/vouchers`, `/admin/refunds`, `/admin/complaints`, `/admin/feedback`, `/admin/audit`, `/admin/reports`, `/admin/reports/export`.
- Analytics: `/admin/analytics/passenger-density`, `/peak-hours`, `/route-demand`, `/occupancy-trends`, `/forecast`, `/forecasts`, `/recommendations`, `/export`.

JSON dùng camelCase, tiền là số nguyên VND, thời gian ISO 8601 UTC. Lỗi trả `{ "message": "..." }`.

## AI / Analytics

Tính toán chạy ở backend từ tickets, payments, trips, routes và seat capacity. Peak hours/days/routes được xếp hạng từ kết quả query trong khoảng lọc. Forecast dùng weighted moving average cho tối đa 12 ngày cùng tuyến và giờ, trọng số gần hơn lớn hơn. Dưới 4 mẫu confidence thấp; từ 8 mẫu mới backtest rolling holdout, trả MAE và MAPE nếu có actual khác 0. Thiếu dữ liệu không sinh accuracy giả. Recommendation chỉ tạo đề xuất theo occupancy `>=85%` hoặc `<=30%`, không tự sửa giá/lịch/assignment.

## Database và seed

Bảng chính gồm users/roles/sessions, routes/stops/route_stops, buses/seats, schedules/trips/assignments, bookings/tickets/seat_holds, payments/refunds/invoices/voucher_usages, monthly_passes/discount_profiles/vouchers, ticket_scans/vehicle_locations/notifications/incidents, feedback/complaints/audit_logs/demand_forecasts/outbox.

Schema khai báo PK/FK/unique/check/index. Seed tạo Hà Nội–Thái Nguyên, nhiều trạm, 4 xe, 4 tài xế, chuyến và mẫu bookings/tickets/payments/refund/invoice/pass/discount/review/complaint/GPS/notification. Lịch sử gồm weekday/weekend và các slot 08:00/12:00/18:00 với tải khác nhau để demo analytics; lịch seed chỉ là dữ liệu demo.

## Sandbox và vận hành

- Payment sandbox nhận MoMo, VNPay, ZaloPay, bank/card; `outcome=success|pending|failed|cancelled`. PENDING được xác nhận qua webhook HMAC `/api/payments/webhook/:provider`; callback replay idempotent, callback sai chữ ký bị 401, callback trễ sau hold expiry bị từ chối. Refund sandbox tự động trả trạng thái completed/failed và chặn double-refund.
- Hold expires sau 10 phút theo `holdExpiresAt`; truy vấn availability lọc hold hết hạn và request path giải phóng trạng thái cũ.
- GPS simulator chạy mỗi 15 giây cho trip đang chạy, nội suy dọc route stops, lưu vehicle_locations, dedupe notification gần trạm và trả ETA/distance/next-stop dựa trên GPS/simulator + mô hình tốc độ trung bình minh bạch. Driver vẫn có thể gửi geolocation thật từ browser.
- Hóa đơn PDF, analytics/occupancy/forecast PDF và XLSX được sinh ở backend.

## Kiểm thử

```powershell
npm test
node --test server/app.test.js
npm run lint
npm run build
```

Test repo gồm Vitest UI hiện có; Node integration/unit cho API/RBAC/concurrency/payment signed-callback/refund/private upload/export/forecast/backtest/scan/GPS/ETA; seed diversity test xác nhận 60 ngày + peak pattern; Playwright `e2e/smartbus.spec.js` bao phủ Passenger/Driver/Manager/Admin và viewport 1920/1366/1024/768/390. Chạy `npm run test:server`, `npm test`, `npm run test:e2e`, `npm run build` sau `npm install` trên máy đích.

## Giới hạn đã biết

- Merchant credentials, email provider và thiết bị GPS vật lý không được đóng gói trong đồ án. Đây là dependency triển khai ngoài; repo đã có sandbox signed-callback/refund, outbox email abstraction, browser GPS + backend simulator/ETA.
- Minh chứng ưu đãi hỗ trợ private local storage JPG/PNG/WEBP/PDF (2 MB) và RBAC owner/Manager/Admin. Khi deploy nhiều máy có thể thay adapter bằng object storage riêng tư.
- ETA demo là ước tính theo vị trí + route stops + tốc độ trung bình, không tuyên bố là road-routing production.
- Tỷ lệ ưu đãi/refund policy là policy demo và nên được chủ hệ thống phê duyệt trước vận hành thật.
- Ma trận requirement audit 41/41 theo phạm vi đề và quy tắc sandbox fallback đã nêu trong yêu cầu.
