# Luân Khánh Duy — 4-Sprint Contribution

Người thực hiện: **Luân Khánh Duy (`duy2201117`)**.

Tài liệu này tách rõ **nhiệm vụ chính thức theo bảng phân công** và **các hạng mục Luân thực tế thực hiện thêm trong repository**. Việc ghi nhận phần làm thêm không thay đổi bảng phân vai ban đầu của nhóm.

## Nhiệm vụ chính thức — Frontend Developer

### Sprint 1
- Countdown giữ ghế 10 phút trên UI và xử lý giao diện khi hết thời gian giữ chỗ.
- Giao diện hủy/đổi vé, hộp thoại xác nhận và tích hợp API xử lý.

### Sprint 2
- Tích hợp bản đồ và giao diện hiển thị vị trí xe, tuyến đường, trạm dừng.
- Giao diện quản lý tuyến/trạm/giá vé: danh sách, thêm, sửa, xóa/cập nhật theo API.

### Sprint 3
- Giao diện phân công chuyến, xe và tài xế/phụ xe.
- Giao diện nộp hồ sơ ưu đãi và màn hình quản lý duyệt/từ chối hồ sơ.

### Sprint 4
- Nút xuất báo cáo Excel/PDF, trạng thái tải và tên file theo kỳ báo cáo.
- Giao diện phản ánh/đánh giá: gửi phản ánh, chấm điểm chuyến 1–5 sao, gửi nhận xét và theo dõi trạng thái/phản hồi.

## Hạng mục Luân thực tế thực hiện thêm

Ngoài 8 task Frontend chính thức ở trên, Luân đã trực tiếp triển khai/tích hợp thêm nhiều phần được chuyển giao hoặc còn thiếu trong source hiện tại, gồm:

### Sprint 1
- Frontend seat map/chọn ghế và trạng thái thanh toán.
- Backend giữ ghế 10 phút, tự động giải phóng ghế và xử lý hủy/đổi vé.
- Tích hợp luồng đặt vé, ghế, thanh toán, vé điện tử.
- Kiểm thử giữ ghế/countdown, vé điện tử, hủy/đổi và thanh toán.

### Sprint 2
- Backend GPS realtime và dữ liệu vị trí xe.
- Frontend hoàn tiền, sự cố/thông báo hành khách.
- Backend CRUD tuyến, trạm, giá vé và tích hợp các module vận hành.
- Kiểm thử hóa đơn, hoàn tiền, GPS, sự cố/thông báo và CRUD tuyến/trạm/giá.

### Sprint 3
- Giao diện lập lịch chuyến, vé tháng.
- Backend phân công tài xế/xe, hồ sơ ưu đãi và kiểm tra xung đột.
- Tích hợp QR/check-in, lịch chạy, vé tháng và phân quyền.
- Kiểm thử lịch chạy, phân công xe/tài xế, QR/check-in, vé tháng, ưu đãi và RBAC.

### Sprint 4
- Dashboard doanh thu, occupancy và audit log.
- Backend xuất Excel/PDF, khiếu nại/đánh giá và trạng thái xử lý.
- Tích hợp dashboard, occupancy, RBAC và audit log.
- Kiểm thử occupancy, export, audit log, RBAC và khiếu nại/đánh giá.

## Quy tắc ghi nhận

- Commit do Luân thực hiện giữ đúng tài khoản GitHub `duy2201117`.
- Không gán commit của Luân cho thành viên khác.
- Lịch sử phân công/PR cũ được giữ nguyên để bảo toàn audit history.
- Thành viên khác tiếp tục làm phần của họ bằng tài khoản và branch riêng từ `develop`.
