# Luân Khánh Duy — 4-Sprint Contribution

Người thực hiện: **Luân Khánh Duy (`duy2201117`)**.

Tài liệu này tách rõ **nhiệm vụ chính thức theo bảng PHAN_CONG_FINAL_4_SPRINT_DUNG_VAI_TRO** và **các hạng mục Luân thực tế thực hiện thêm/take over trong repository**. Việc ghi nhận phần làm thêm không thay đổi phân công gốc của nhóm.

## Nhiệm vụ chính thức — Frontend Developer (6 task / 80 giờ)

### Sprint 1 — 24 giờ
- Countdown giữ ghế 10 phút trên UI và xử lý giao diện khi hết thời gian giữ chỗ. [10h]
- Giao diện hủy/đổi vé, hộp thoại xác nhận và tích hợp API xử lý. [14h]

### Sprint 2 — 18 giờ
- Tích hợp bản đồ và giao diện hiển thị vị trí xe, tuyến đường, trạm dừng. [18h]

### Sprint 3 — 14 giờ
- Giao diện phân công chuyến, xe và tài xế/phụ xe. [14h]

### Sprint 4 — 24 giờ
- Giao diện nộp hồ sơ ưu đãi và màn hình quản lý duyệt hồ sơ. [14h]
- Nút xuất báo cáo Excel/PDF, trạng thái tải và tên file theo kỳ báo cáo. [10h]

## Hạng mục Luân thực tế thực hiện thêm / tiếp quản

Ngoài 6 task Frontend chính thức, Luân đã thực hiện thêm phần tích hợp/kiểm thử và hoàn thiện các hạng mục được chuyển giao còn thiếu trong repository. Các hạng mục này được ghi là **takeover**, không ghi ngược thành phân công chính thức ban đầu.

### Frontend tiếp quản
- Sơ đồ ghế/chọn ghế và trạng thái thanh toán.
- Hoàn tiền, sự cố/thông báo hành khách.
- Lập lịch chuyến, vé tháng, audit log, occupancy.
- Hoàn thiện UI khiếu nại/đánh giá: giữ nguyên luồng phản ánh cũ và bổ sung phần chấm điểm chuyến đi 1–5 sao, nhận xét, lịch sử đánh giá và trạng thái/phản hồi theo API `/feedback` có sẵn.

### Backend/tích hợp tiếp quản
- Giữ ghế 10 phút và tự nhả ghế.
- Hủy/đổi vé và các trường hợp từ chối không hợp lệ.
- GPS realtime, phân công xe/tài xế, hồ sơ ưu đãi, export báo cáo và các luồng liên quan đã có trong source chuẩn.

### Regression/test bổ sung
- Search không có chuyến.
- Hết hạn giữ ghế và trả ghế.
- Payment failed/cancelled giải phóng hold.
- Từ chối hủy vé đã sử dụng.
- Rating ngoài 1–5 và chặn đánh giá trùng chuyến.
- Quyền Audit Log và công thức occupancy.
- Kiểm chứng UI rating 1–5 và bảo toàn luồng khiếu nại cũ.

## Nguyên tắc bảo toàn source

- Source production ban đầu được giữ nguyên ở mọi phần đã có và đang hoạt động.
- Thay đổi production cuối chỉ giới hạn ở **`src/features/passenger/ComplaintsPage.jsx`** để bổ sung UI chấm điểm chuyến 1–5 sao theo requirement còn thiếu; backend `/api/feedback` vốn đã có nên không thay đổi backend production.
- Các thay đổi còn lại chỉ là test/tài liệu/Git Flow.

## Quy tắc ghi nhận Git

- Commit do Luân thực hiện giữ đúng tài khoản GitHub `duy2201117`.
- Không sửa author/committer lịch sử để giả thành thành viên khác.
- Các task tiếp quản được ghi là Luân thực hiện thêm, trong khi bảng phân công gốc vẫn được giữ nguyên để bảo toàn audit history.
