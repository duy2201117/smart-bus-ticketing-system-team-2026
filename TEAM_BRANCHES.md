# Nhánh nhóm đã tạo trên GitHub

- `main` — release ổn định.
- `develop` — tích hợp.
- `feature/luan-khanh-duy` — backlog frontend của Luân Khánh Duy.
- `feature/luan-khanh-duy-integration` — nhánh đưa source hoàn chỉnh vào `develop`.
- `feature/truong-khanh-duy` — phạm vi công việc Trương Khánh Duy (Luân Khánh Duy trực tiếp triển khai thay).
- `feature/trieu-thanh-duy` — phạm vi công việc Triệu Thanh Duy (Luân Khánh Duy trực tiếp triển khai thay).
- `test/hoang-manh-duy` — phạm vi kiểm thử Hoàng Mạnh Duy (Luân Khánh Duy trực tiếp triển khai thay).
- `test/hoang-trung-hieu` — nhánh theo tên người dùng yêu cầu.

> Lưu ý: tài liệu Sprint 1–4 trong gói đề đang ghi **Phạm Trung Hiếu** cho nhiều task Tester, không phải **Hoàng Trung Hiếu**. Không nên sửa tên trong lịch sử/báo cáo nếu chưa xác nhận với nhóm/giảng viên.

## Git Flow

1. `develop` -> nhánh công việc.
2. Commit nhỏ, rõ ràng.
3. Push nhánh.
4. Pull Request -> `develop`.
5. Review + test + merge.
6. Hoàn tất Sprint: Pull Request `develop` -> `main`, sau đó tag release.
