# Nhánh làm việc trên GitHub

- `main` — release ổn định.
- `develop` — nhánh tích hợp.
- `feature/luan-khanh-duy` — nhánh công việc chính của Luân Khánh Duy.
- `feature/luan-khanh-duy-integration` — nhánh tích hợp source hoàn chỉnh do Luân Khánh Duy thực hiện.

## Phạm vi hiện tại

Luân Khánh Duy (`duy2201117`) là người trực tiếp triển khai, tích hợp và kiểm thử toàn bộ phạm vi 4 Sprint đang có trong repository.

## Git Flow

1. `develop` -> nhánh công việc.
2. Commit nhỏ, rõ ràng.
3. Push nhánh.
4. Pull Request -> `develop`.
5. Review + test + merge.
6. Hoàn tất Sprint: Pull Request `develop` -> `main`, sau đó tag release.

> Các nhánh/PR cũ có thể vẫn xuất hiện trong lịch sử GitHub để bảo toàn lịch sử repository, nhưng không còn được xem là nhánh làm việc hiện tại.
