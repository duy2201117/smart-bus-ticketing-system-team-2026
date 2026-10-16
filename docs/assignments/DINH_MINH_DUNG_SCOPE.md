# Đinh Minh Dũng — Frontend Developer

Tài liệu này ánh xạ phạm vi Frontend chính thức của **Đinh Minh Dũng** theo bảng phân công 4 Sprint với các màn hình/chức năng đã có trong production source gốc. Mục tiêu là kiểm chứng nhiệm vụ mà **không sửa hành vi production**.

## Vai trò chính thức
- Frontend Developer
- UI/UX, tích hợp API Backend, responsive, frontend component/unit test và code review.

## Sprint 1 — 26 giờ
### US01 — Tìm kiếm tuyến/chuyến (14 giờ)
- Source: `src/features/passenger/SearchPage.jsx`
- Có form điểm đi, điểm đến, ngày, giờ.
- Tích hợp `/routes` và `/trips?...`.
- Hiển thị danh sách chuyến và trạng thái còn chỗ/đóng đặt vé.

### US04 — Vé điện tử QR (12 giờ)
- Source: `src/features/passenger/TicketsPage.jsx`
- Hiển thị thông tin vé/chuyến/ghế/mã vé.
- Lấy QR từ `/tickets/:id/qr`.
- Cho phép lưu ảnh QR.

## Sprint 2 — 24 giờ
### US07 — Hóa đơn điện tử (12 giờ)
- Source: `src/features/passenger/TicketsPage.jsx`
- Xem thông tin vé đã thanh toán.
- Tải PDF hóa đơn qua `/tickets/:id/invoice`.
- Gửi lại hóa đơn qua email bằng `/tickets/:id/email`.

### US10 — Thông báo xe sắp đến trạm (12 giờ)
- Source: `src/features/passenger/SupportPage.jsx`
- Hiển thị danh sách thông báo của hành khách.
- Hiển thị số lượng chưa đọc.
- Đánh dấu đã đọc qua `/notifications/:id/read`.

## Sprint 3 — 48 giờ
### US12 — Quản lý tuyến/trạm/giá vé (16 giờ)
- Source: `src/features/operations/FleetSections.jsx`
- Danh sách tuyến và trạm.
- Thêm/sửa tuyến, cập nhật giá, thứ tự trạm.
- Thêm/sửa trạm và quản lý trạng thái khai thác tuyến.

### US15 — Quét QR bằng camera (18 giờ)
- Source: `src/features/driver/DriverPage.jsx`
- Dùng `@zxing/browser` và `BrowserMultiFormatReader`.
- Mở camera, đọc QR, gửi mã tới `/driver/scan`.
- Hiển thị kết quả soát vé hợp lệ/không hợp lệ từ backend.

### US22 — Quản lý tài khoản/phân quyền (14 giờ)
- Source: `src/features/operations/PeopleSections.jsx`
- Danh sách/tìm kiếm tài khoản.
- Tạo tài khoản.
- Gán vai trò và cập nhật trạng thái hoạt động.
- Chỉ hiển thị tab quản lý tài khoản cho Admin tại `OperationsPage.jsx`.

## Sprint 4 — 28 giờ
### US18 — Quản lý Voucher + nhập mã trong đặt vé (14 giờ)
- Source quản trị: `src/features/operations/PeopleSections.jsx`
- CRUD phần giao diện voucher, thời gian, giá trị, hạn mức sử dụng, trạng thái.
- Source hành khách: `src/features/passenger/BookingPage.jsx`
- Nhập/chọn voucher đang hiệu lực và gửi `voucherCode` khi giữ ghế.

### US19 — Dashboard doanh thu (14 giờ)
- Source: `src/features/operations/ReportsSections.jsx`
- Dashboard doanh thu hôm nay/tháng/khoảng lọc.
- Bộ lọc từ ngày, đến ngày, tuyến.
- Biểu đồ doanh thu theo ngày và bảng hiệu quả từng tuyến.

## Tổng estimate
**126 giờ** theo backlog chính thức.

## Kiểm chứng tự động
- `src/dinhMinhDung.test.js`
- Test này chỉ kiểm tra các dấu hiệu chức năng/tích hợp trong source production gốc.
- Không thay đổi production source để ép test pass.
