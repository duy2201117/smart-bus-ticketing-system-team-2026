# Kế hoạch thực hiện đồ án nhóm

## Người thực hiện thực tế

- **Luân Khánh Duy** — GitHub: `duy2201117`
- Luân Khánh Duy thực hiện cả phần việc ban đầu được phân cho các workstream của Trương Khánh Duy, Triệu Thanh Duy, Hoàng Mạnh Duy và Hoàng Trung Hiếu theo yêu cầu hiện tại của nhóm.

> Git history luôn giữ đúng người thao tác thực tế là `duy2201117`. Tên thành viên trong branch/issue dùng để theo dõi phạm vi công việc ban đầu, không dùng để giả mạo tác giả commit.

## Luồng Git

- `main`: bản ổn định để nộp/chạy demo.
- `develop`: nhánh tích hợp trước khi đưa lên `main`.
- `feature/luan-khanh-duy-integration`: tích hợp UI và các phần Luân Khánh Duy phụ trách.
- `feature/truong-khanh-duy`: workstream các chức năng frontend ban đầu của Trương Khánh Duy.
- `feature/trieu-thanh-duy`: workstream các chức năng backend ban đầu của Triệu Thanh Duy.
- `test/hoang-manh-duy`: workstream kiểm thử ban đầu của Hoàng Mạnh Duy.
- `test/hoang-trung-hieu`: workstream kiểm thử theo tên thành viên mà nhóm hiện tại yêu cầu theo dõi.

## Phạm vi 4 Sprint

### Sprint 1 — Đặt vé và thanh toán
- Tìm chuyến, chọn ghế, giữ ghế và countdown.
- Vé điện tử, QR/PDF.
- Hủy/đổi vé.
- Thanh toán sandbox và xử lý kết quả thanh toán.

### Sprint 2 — Hoàn tiền, GPS và vận hành
- Hoàn tiền.
- GPS thời gian thực và bản đồ theo dõi xe.
- Quản lý đội xe.
- Sự cố và thông báo hành khách.
- CRUD tuyến/trạm/giá vé.

### Sprint 3 — Lịch chạy, phân công và ưu đãi
- Lập lịch chuyến.
- Phân công tài xế/xe và kiểm tra xung đột.
- Quét QR/check-in.
- Vé tháng.
- Hồ sơ ưu đãi và duyệt đối tượng ưu tiên.
- Phân quyền nhân sự.

### Sprint 4 — Báo cáo, an toàn và phản hồi
- Dashboard doanh thu.
- Theo dõi mật độ hành khách.
- Xuất Excel/PDF.
- RBAC.
- Audit log.
- Khiếu nại, đánh giá và theo dõi trạng thái xử lý.

## Tiêu chí hoàn thành

1. Chức năng đúng backlog 4 Sprint.
2. Không commit `node_modules`, `dist`, dữ liệu runtime hoặc Java bytecode build tạm.
3. Lint, unit/integration test, server test và production build phải chạy được trước khi chốt `main`.
4. Mọi thay đổi được đưa qua nhánh công việc và Pull Request khi phù hợp.
5. README có hướng dẫn cài đặt, chạy, tài khoản demo và kiểm thử.
