# Đỗ Mạnh Duy — Backend scope 4 Sprint

Tài liệu này đối chiếu phạm vi Backend chính thức của **Đỗ Mạnh Duy** với source Smart Bus Ticketing System hiện có. Production source được giữ nguyên theo baseline ban đầu; phần bổ sung của workstream này chỉ là kiểm thử và tài liệu xác minh.

## Vai trò

- Backend Developer
- Phụ trách API, business logic phía server, database, bảo mật/hiệu năng, backend unit test và code review.

## Sprint 1 — 38 giờ

### US02 — Trạng thái ghế / ghế còn trống (14h)
- API chi tiết chuyến trả về seat map và trạng thái từng ghế.
- Kiểm thử xác nhận có danh sách ghế và trạng thái `available`.

### US06 — Thanh toán MoMo/VNPay + Webhook (24h)
- Tạo giao dịch sandbox.
- Xác minh callback/webhook có chữ ký.
- Kiểm thử callback thành công và tính idempotent khi webhook được gửi lặp.

## Sprint 2 — 32 giờ

### US08 — Hoàn tiền (18h)
- Kiểm tra luồng vé đã thanh toán → hủy hợp lệ → hoàn tiền.
- Xác minh trạng thái refund/payment/ticket được cập nhật đồng bộ.

### US11 — Sự cố/trễ chuyến (14h)
- Tài xế gửi báo cáo sự cố/trễ chuyến.
- Hệ thống lưu sự cố và phát thông báo cập nhật đến hành khách.

## Sprint 3 — 34 giờ

### US13 — Lịch trình/tần suất + xung đột (18h)
- Tạo dữ liệu lịch chạy/tần suất.
- Sinh chuyến theo lịch.
- Kiểm thử ngăn chuyến chồng lấn cùng xe/tài xế.

### US23 — Audit Log (16h)
- API tra cứu nhật ký có bộ lọc.
- Xác minh quyền chỉ Admin được truy cập.

## Sprint 4 — 42 giờ

### US16 — Vé tháng (16h)
- Đăng ký vé tháng.
- Hỗ trợ idempotency.
- Gia hạn và xác minh thời hạn mới dài hơn thời hạn cũ.

### US24 — Phản ánh/đánh giá (12h)
- Tiếp nhận đánh giá gắn với chuyến.
- Tiếp nhận phản ánh gắn với chuyến.
- Quản lý cập nhật trạng thái xử lý/phản hồi.

### US20 — Tỷ lệ lấp đầy (14h)
- API thống kê số khách/khả năng chứa theo chuyến.
- Kiểm thử tỷ lệ lấp đầy luôn trong 0–100% và số khách không vượt sức chứa.

## Kiểm thử tự động

File kiểm thử chuyên biệt:

`server/doManhDuy.test.js`

Bộ test kiểm chứng xuyên suốt 9 đầu việc Backend chính thức, tổng estimate **146 giờ**.

## Nguyên tắc bảo toàn source gốc

Workstream Đỗ Mạnh Duy **không thay đổi production UI/API/backend logic** để làm đẹp CI. Chỉ bổ sung test và tài liệu xác minh. Production source phải tiếp tục khớp baseline ban đầu của dự án.
