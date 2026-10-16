# SmartBus Ticketing System

Ứng dụng bán vé xe buýt tuyến Hà Nội – Thái Nguyên, gồm frontend React/Vite, REST API Express và schema PostgreSQL-compatible chạy được bằng PGlite hoặc PostgreSQL. Hệ thống hỗ trợ booking, seat hold 10 phút, payment sandbox, vé QR, invoice PDF, refund, GPS/ETA, điều hành tuyến/chuyến, RBAC, voucher/ưu đãi, phản ánh/đánh giá và báo cáo.

## Trạng thái FINAL

- Phạm vi phân công chính thức của nhóm được chốt theo **4 Sprint**.
- Git Flow: feature/test branch → `develop` → CI → release PR → `main` → CI → sync `develop`.
- Ma trận audit kỹ thuật toàn repo: xem `docs/REQUIREMENTS_MATRIX.md`.
- Tổng hợp vai trò/phân công cuối: xem `docs/TEAM_FINAL_SCOPE.md`.
- Kết quả audit cuối: xem `docs/FINAL_AUDIT.md`.

## Phạm vi chính thức — 4 Sprint

- **Sprint 1:** tìm chuyến, chọn ghế, giữ chỗ 10 phút, thanh toán sandbox, vé QR, hủy/đổi vé.
- **Sprint 2:** hóa đơn, hoàn tiền, GPS realtime, thông báo trạm và báo cáo sự cố.
- **Sprint 3:** CRUD tuyến/trạm/giá, lịch trình/tần suất, phân công xe-tài xế, QR scanner, User/RBAC và Audit Log.
- **Sprint 4:** vé tháng, hồ sơ ưu đãi, voucher, phản ánh/đánh giá, doanh thu, occupancy và xuất Excel/PDF.

Các module **AI/Analytics** như density, peak/low, forecast, backtest và recommendation là **chức năng bổ sung ngoài bảng phân công chính thức 4 Sprint**. Chúng được giữ vì đã có implementation và test, nhưng không dùng để thay đổi assignment gốc của nhóm.

## Kiến trúc

- Frontend: React 19, Vite 8, React Router, Tailwind CSS, Recharts, Leaflet/OSM, ZXing camera QR.
- Backend: Node.js + Express 5, REST `/api`, cookie session HttpOnly/SameSite, password hash scrypt.
- Database: PGlite cho demo/local; có thể dùng PostgreSQL qua `DATABASE_URL`.
- Payment: sandbox cho MoMo/VNPay/ZaloPay/Bank Card, hỗ trợ success/pending/failed/cancelled, signed webhook và refund sandbox.
- GPS: browser geolocation khi tài xế cấp quyền + backend simulator/ETA cho demo.

## Cài đặt và chạy

Yêu cầu Node.js 22+ và npm.

```powershell
npm install
npm run dev
```

`npm run dev` khởi động backend API và frontend development server. Frontend mặc định chạy tại:

```text
http://127.0.0.1:5173
```

Có thể chạy riêng:

```powershell
npm run server
npm run dev:web
```

## Cấu hình

Dùng `.env.example` làm mẫu; không commit `.env` thật.

Các biến chính:

| Biến | Mô tả |
|---|---|
| `PORT` | Cổng REST API, mặc định 3001 |
| `DEMO_MODE` | Bật dữ liệu demo và payment sandbox |
| `DATA_DIR` | Thư mục PGlite persistent nếu cần |
| `DATABASE_URL` | PostgreSQL connection string |
| `SMARTBUS_ORIGIN` | Origin production được phép |
| `TRUST_PROXY` | Bật khi API sau trusted reverse proxy |
| `NODE_ENV` | development/production |

## Demo accounts

Seed demo tạo các vai trò:

| Email | Vai trò |
|---|---|
| `admin@smartbus.demo` | ADMIN |
| `manager@smartbus.demo` | MANAGER |
| `driver@smartbus.demo` | DRIVER |
| `passenger@smartbus.demo` | PASSENGER |

Thông tin xác thực demo được định nghĩa trong dữ liệu seed của source. Không sử dụng credential demo cho môi trường production.

## Demo flow gợi ý

1. Passenger đăng nhập, tìm chuyến, chọn ghế, giữ chỗ 10 phút, nhập voucher, thanh toán sandbox và mở vé QR/PDF invoice.
2. Driver chọn chuyến được giao, bắt đầu chuyến, quét QR bằng camera hoặc nhập mã; scan lặp bị từ chối.
3. Manager quản lý route/stop/bus/trip/schedule/assignment, refund, voucher, discount, complaint/review và báo cáo.
4. Passenger theo dõi xe ở màn hình tracking; demo dùng browser GPS/simulator.
5. Admin quản lý user/role/lock và audit log.

## API chính

Tất cả route có prefix `/api`.

- Auth/Profile: `/auth/*`, `/profile`, `/profile/password`, `/profile/discount`, `/profile/discount-evidence`.
- Booking: `/routes`, `/stops`, `/trips`, `/holds`, `/payments`.
- Tickets: `/tickets`, `/tickets/:id/qr`, `/tickets/:id/invoice`, cancel/change/email.
- Passenger: `/passes`, `/notifications`, `/feedback`, `/complaints`.
- Driver: `/driver/trips`, `/driver/scan`, `/driver/incidents`, trip status/location.
- Operations: `/admin/routes`, `/admin/stops`, `/admin/buses`, `/admin/trips`, `/admin/schedules`, `/admin/users`, `/admin/discounts`, `/admin/vouchers`, `/admin/refunds`, `/admin/complaints`, `/admin/feedback`, `/admin/audit`, `/admin/reports`.
- Analytics bổ sung: `/admin/analytics/*`.

## Kiểm thử và CI

Chạy local:

```powershell
npm run lint
npm test
npm run test:server
npm run build
```

GitHub Actions chạy tự động các bước tương ứng trên Pull Request/push vào `develop` và `main`.

Playwright E2E chạy thủ công:

```powershell
npx playwright install chromium
npm run test:e2e
```

Chi tiết Windows/demo: `FINAL_RUN_WINDOWS.md`.

## Ghi nhận đóng góp

- Bảng phân công gốc 4 Sprint được giữ nguyên.
- Phần Luân Khánh Duy thực tế tiếp quản được ghi rõ là **takeover**, không viết ngược thành nhiệm vụ chính thức ban đầu.
- Không sửa author/committer lịch sử để giả đóng góp.
- Xem `docs/TEAM_FINAL_SCOPE.md`, `docs/contributions/` và `docs/assignments/` để đối chiếu.

## Giới hạn triển khai

- Merchant credential, email provider và GPS hardware production không được đóng gói trong đồ án.
- Sandbox/simulator dùng cho demo/local khi thiếu credential/hardware ngoài hệ thống.
- ETA demo dựa trên vị trí, route stops và tốc độ trung bình; không tuyên bố là commercial road-routing.
- AI/Analytics là phần bổ sung ngoài assignment chính thức 4 Sprint.
