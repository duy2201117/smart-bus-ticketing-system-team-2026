# TEAM FINAL SCOPE — SmartBus Ticketing System

Tài liệu này là bản tổng hợp cuối để giảng viên/mentor đối chiếu nhanh giữa **phân công chính thức 4 Sprint** và trạng thái implementation trong repository.

## Nguyên tắc ghi nhận

- Phân công chính thức không bị viết lại theo lịch sử commit.
- Task được người khác tiếp quản được ghi là **takeover**, không đổi chủ sở hữu ban đầu trong bảng phân công.
- Commit/PR giữ nguyên identity GitHub thực tế của người thao tác.
- Product Owner không nằm trong 8 bộ code kỹ thuật cá nhân.

## Thành viên và vai trò chính thức

| Thành viên | Vai trò chính thức | Phạm vi chính |
|---|---|---|
| Nguyễn Khánh Tùng | Product Owner | Product Backlog, ưu tiên User Story, Acceptance Criteria, Sprint Review/nghiệm thu |
| Trương Khánh Duy | Scrum Master/Leader + Frontend Developer | Seat map, payment result UI, refund/incident UI, scheduling, audit UI, monthly pass, complaint/rating, occupancy |
| Nguyễn Hữu Dương | Backend Developer | Search/QR/invoice/notification, route/stop/fare, QR validation, RBAC, voucher, revenue |
| Đỗ Mạnh Duy | Backend Developer | Seat availability/payment, refund/incident, schedule/audit, monthly pass, complaint/review, occupancy |
| Triệu Thanh Duy | Backend Developer | Hold 10 phút, cancel/change, GPS, assignment, discount profile, Excel/PDF export |
| Luân Khánh Duy | Frontend Developer | Countdown, cancel/change UI, GPS map, assignment UI, discount profile UI, Excel/PDF controls |
| Đinh Minh Dũng | Frontend Developer | Search UI, QR ticket, invoice/notification UI, route/stop management, QR scanner, account/RBAC UI, voucher, revenue dashboard |
| Hoàng Mạnh Duy | Tester | Test plan/case, payment/search/hold, invoice/GPS/incident, schedule/QR/audit, discount/review/revenue/export regression |
| Phạm Trung Hiếu | Tester | Seat/QR/payment/cancel-change, refund/notification, CRUD/assignment/RBAC, monthly pass/voucher/occupancy regression |

## Trạng thái cuối theo repository

| Phạm vi | Trạng thái chốt | Bằng chứng chính |
|---|---|---|
| Luân Khánh Duy — scope chính thức | COMPLETE | `docs/contributions/LUAN_KHANH_DUY.md`, frontend tests, source hiện tại |
| Luân Khánh Duy — takeover thực tế | COMPLETE | `docs/contributions/LUAN_KHANH_DUY.md`, regression tests, PR/commit history |
| Nguyễn Hữu Dương | COMPLETE | `docs/assignments/NGUYEN_HUU_DUONG_SCOPE.md`, backend/source verification |
| Đỗ Mạnh Duy | COMPLETE | `docs/assignments/DO_MANH_DUY_SCOPE.md`, backend/source verification |
| Đinh Minh Dũng | COMPLETE | `docs/assignments/DINH_MINH_DUNG_SCOPE.md`, frontend/source verification |
| Trương Khánh Duy scope còn thiếu trước chốt | COMPLETE qua takeover | Phần complaint/rating đã hoàn thiện trong `src/features/passenger/ComplaintsPage.jsx`; các phần takeover được ghi dưới identity người thực hiện |
| Triệu Thanh Duy scope còn thiếu trước chốt | COMPLETE qua source/takeover verification | Hold/cancel-change/GPS/assignment/discount/export có implementation và regression phù hợp |
| Hoàng Mạnh Duy / Phạm Trung Hiếu testing scope | COMPLETE qua regression/test suite cuối | Frontend/server regression, payment/hold/rating/RBAC/occupancy và các luồng liên quan |

## Phạm vi 4 Sprint chính thức

- **Sprint 1:** tìm chuyến, ghế, giữ chỗ 10 phút, thanh toán, QR, hủy/đổi.
- **Sprint 2:** invoice, refund, GPS realtime, stop notification, driver incident.
- **Sprint 3:** route/stop/fare, schedule/frequency, assignment, QR scanner, User/RBAC, Audit Log.
- **Sprint 4:** monthly pass, discount profile, voucher, complaint/review, revenue, occupancy, Excel/PDF.

AI/Analytics (density, peak/low, forecast, backtest, recommendation) là **phần bổ sung ngoài bảng phân công chính thức 4 Sprint**. Các module này được giữ vì source đã có và có kiểm thử, nhưng không dùng để thay đổi assignment gốc.

## Git Flow chốt

Luồng chốt dự án:

`feature/test branch → develop → CI → release PR develop → main → CI → sync develop = main`

Bản release cuối chỉ được coi là hoàn tất khi:

- CI trên `main` xanh.
- CI trên `develop` xanh sau đồng bộ.
- Không còn Pull Request công việc đang mở.
- Không còn Issue công việc chưa xử lý.
- Production source không bị thay đổi ngoài các bổ sung chức năng thực sự cần thiết theo requirement.

## Tài liệu liên quan

- `README.md`
- `docs/FINAL_AUDIT.md`
- `docs/REQUIREMENTS_MATRIX.md`
- `docs/contributions/LUAN_KHANH_DUY.md`
- `docs/assignments/NGUYEN_HUU_DUONG_SCOPE.md`
- `docs/assignments/DO_MANH_DUY_SCOPE.md`
- `docs/assignments/DINH_MINH_DUNG_SCOPE.md`
- `TEAM_BRANCHES.md`
- `FINAL_RUN_WINDOWS.md`
