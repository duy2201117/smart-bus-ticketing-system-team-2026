# Trạng thái nhánh và Git Flow — FINAL

## Nhánh chính

- `main` — bản release ổn định dùng để nộp/demo.
- `develop` — nhánh tích hợp chung của nhóm.

Tại thời điểm chốt, `main` và `develop` đã được đồng bộ cùng bản release cuối. Không xóa `develop` sau khi release.

## Trạng thái dự án

Dự án đã hoàn tất vòng tích hợp cuối. Các branch feature/test cũ có thể vẫn xuất hiện trong lịch sử GitHub để bảo toàn audit history; chúng không còn được xem là nhánh làm việc hiện tại sau khi phần việc tương ứng đã merge.

Luân Khánh Duy (`duy2201117`) có các task Frontend chính thức theo bảng phân công FINAL và một số hạng mục thực tế tiếp quản thêm. Phần chính thức và phần takeover được tách rõ tại `docs/contributions/LUAN_KHANH_DUY.md` và `docs/TEAM_FINAL_SCOPE.md`.

## Git Flow đã áp dụng

1. Tạo branch công việc từ `develop`.
2. Commit nhỏ, rõ ràng bằng đúng tài khoản người thực hiện.
3. Push branch và mở Pull Request vào `develop`.
4. Chạy CI/test và review trước khi merge.
5. Khi bản tích hợp ổn định, mở Pull Request `develop` → `main`.
6. Chỉ merge release khi CI xanh.
7. Sau release, đồng bộ `develop` về cùng commit của `main`.
8. Có thể tạo tag release sau khi CI trên bản release cuối đã xanh.

## Quy tắc ghi nhận

- Không sửa author/committer lịch sử để giả thành thành viên khác.
- Phần ai thực tế thực hiện thì giữ đúng identity GitHub của người đó.
- Nếu một thành viên tiếp quản task của người khác, tài liệu phải ghi rõ là **takeover**, không thay đổi bảng phân công gốc.
- Không xóa lịch sử PR/commit cũ chỉ để làm repo trông sạch hơn.

## Tài liệu chốt

- `README.md` — hướng dẫn chạy và phạm vi dự án.
- `docs/TEAM_FINAL_SCOPE.md` — bảng tổng hợp vai trò/phạm vi cuối.
- `docs/FINAL_AUDIT.md` — kết quả audit kỹ thuật.
- `FINAL_RUN_WINDOWS.md` — runbook Windows/demo.
- `docs/REQUIREMENTS_MATRIX.md` — ma trận kiểm chứng kỹ thuật toàn repo.
