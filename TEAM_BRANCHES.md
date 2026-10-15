# Nhánh làm việc trên GitHub

- `main` — release ổn định.
- `develop` — nhánh tích hợp chung của nhóm.
- `feature/luan-khanh-duy` — nhánh công việc của Luân Khánh Duy.
- `feature/luan-khanh-duy-integration` — nhánh tích hợp source do Luân Khánh Duy thực hiện.
- `feature/luan-feedback-rating` — bổ sung phần đánh giá chuyến thuộc nhiệm vụ Frontend Sprint 4 của Luân.

## Phạm vi hiện tại

Luân Khánh Duy (`duy2201117`) chịu trách nhiệm cho các task Frontend được phân công chính thức và các hạng mục Luân thực tế đã trực tiếp triển khai thêm trong source hiện tại. Chi tiết được ghi tại `docs/contributions/LUAN_KHANH_DUY.md`.

Các thành viên khác vẫn tiếp tục làm phần của họ bằng tài khoản GitHub và branch riêng, tạo từ `develop`. Không dùng tài khoản hoặc commit identity của Luân để ghi nhận công việc của người khác.

## Git Flow

1. Cập nhật `develop`.
2. Tạo branch riêng từ `develop`, ví dụ `feature/<ten-thanh-vien>-<noi-dung>` hoặc `test/<ten-thanh-vien>-<noi-dung>`.
3. Commit nhỏ, rõ ràng bằng đúng tài khoản người thực hiện.
4. Push branch.
5. Pull Request vào `develop`.
6. Review + CI/test + merge.
7. Khi bản tích hợp ổn định: Pull Request `develop` -> `main`.
8. Tag release sau khi CI trên bản release đã xanh.

> Các nhánh/PR cũ có thể vẫn xuất hiện trong lịch sử GitHub để bảo toàn audit history, nhưng không mặc nhiên được xem là nhánh làm việc hiện tại.
