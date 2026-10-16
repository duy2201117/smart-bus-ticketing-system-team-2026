# Phạm vi nhiệm vụ — Nguyễn Hữu Dương

Vai trò chính thức theo bảng phân công: **Backend Developer**.

> Tài liệu này mô tả **phạm vi được phân công** cho Nguyễn Hữu Dương và cách kiểm chứng trong repository. Nó không thay đổi lịch sử tác giả Git: commit phải giữ đúng tài khoản thực tế thực hiện.

## Sprint 1 — 30 giờ

1. **US01 — Tìm kiếm tuyến/chuyến (16 giờ)**
   - Thiết kế dữ liệu tuyến xe, lịch trình.
   - API tìm kiếm theo điểm đi, điểm đến, ngày và giờ.
   - Kiểm tra điều kiện đầu vào và trả danh sách chuyến phù hợp.
   - Hiện thực: `GET /api/routes`, `GET /api/trips`, `GET /api/trips/:id`.

2. **Vé điện tử/QR (14 giờ)**
   - Sinh mã vé/QR cho vé đã thanh toán.
   - API trả dữ liệu QR để hành khách sử dụng.
   - Hiện thực: `GET /api/tickets/:id/qr`.

## Sprint 2 — 30 giờ

1. **US07 — Hóa đơn điện tử (14 giờ)**
   - Lưu dữ liệu hóa đơn sau thanh toán thành công.
   - Xuất hóa đơn PDF.
   - Đưa yêu cầu gửi hóa đơn vào outbox email mô phỏng của môi trường demo.
   - Hiện thực: `GET /api/tickets/:id/invoice`, `POST /api/tickets/:id/email`.

2. **US10 — Thông báo xe sắp đến trạm (16 giờ)**
   - Xác định xe ở gần trạm từ tọa độ GPS.
   - Phát thông báo cho hành khách có vé trên chuyến.
   - Chống gửi trùng bằng `dedupeKey`.
   - Hiện thực trong luồng `POST /api/driver/trips/:id/location` và `GET /api/notifications`.

## Sprint 3 — 54 giờ

1. **CRUD tuyến/trạm/giá vé (18 giờ)**
   - Quản lý tuyến, trạm, giá vé và ràng buộc dữ liệu.
   - Hiện thực: `/api/admin/routes`, `/api/admin/stops`.

2. **US15 — Xác thực QR/soát vé (18 giờ)**
   - Kiểm tra vé tồn tại, đúng chuyến, trạng thái vé, ngày khởi hành và chống quét lại.
   - Cập nhật vé sang `checked_in` khi hợp lệ.
   - Lưu lịch sử quét.
   - Hiện thực: `POST /api/driver/scan`.

3. **Role/Permission và quản lý tài khoản (18 giờ)**
   - Danh sách tài khoản theo quyền.
   - Tạo tài khoản, gán vai trò, khóa/mở khóa.
   - Chặn người không đủ quyền truy cập API quản trị.
   - Hiện thực: `/api/admin/users` cùng middleware `requireAuth`/`allowRoles`.

## Sprint 4 — 30 giờ

1. **Voucher (14 giờ)**
   - CRUD voucher.
   - Điều kiện hiệu lực theo thời gian, số lượt tổng, số lượt mỗi người, mức giảm và giá trị đơn tối thiểu.
   - Khóa/giảm lượt sử dụng an toàn trong giao dịch thanh toán.
   - Hiện thực: `/api/admin/vouchers`, `/api/vouchers/active` và logic voucher trong `server/core.js`.

2. **US19 — Báo cáo doanh thu (16 giờ)**
   - Truy vấn tổng hợp doanh thu theo khoảng ngày và tuyến.
   - Doanh thu thuần có đối trừ hoàn tiền.
   - Thống kê theo ngày, tuyến, số vé, chuyến và tỷ lệ lấp đầy.
   - Hiện thực: `GET /api/admin/overview`, `GET /api/admin/reports`.

## Kiểm chứng tự động

File `server/nguyenHuuDuong.test.js` kiểm tra end-to-end toàn bộ phạm vi trên:

- tìm kiếm chuyến theo bộ lọc;
- thanh toán và phát hành QR;
- hóa đơn PDF + outbox email;
- thông báo xe gần trạm;
- QR check-in + chống quét lại;
- CRUD tuyến/trạm/giá;
- Role/Permission, khóa/mở khóa;
- CRUD Voucher;
- báo cáo doanh thu tổng hợp và lọc theo tuyến.

CI chạy `npm run test:server` nên file kiểm thử này được chạy cùng bộ backend tests trước khi merge.
