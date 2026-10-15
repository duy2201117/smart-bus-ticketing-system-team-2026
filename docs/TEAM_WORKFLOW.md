# Quy trình Git của nhóm

## Nhánh chính

- `main`: bản ổn định/release.
- `develop`: nhánh tích hợp.
- `feature/*`: phát triển chức năng.
- `test/*`: kiểm thử.

## Quy trình bắt buộc

```bash
git checkout develop
git pull origin develop
git checkout -b feature/ten-chuc-nang
# code + test
git add .
git commit -m "feat: mô tả thay đổi"
git pull origin develop
git push -u origin feature/ten-chuc-nang
```

Sau đó tạo Pull Request từ nhánh công việc vào `develop`, review/CI, merge; khi hoàn tất Sprint tạo Pull Request `develop -> main` và tag release.

## Phạm vi thực hiện đợt này

Luân Khánh Duy là người trực tiếp triển khai và commit phần việc của Luân Khánh Duy cùng các phần việc được làm thay cho Trương Khánh Duy, Triệu Thanh Duy, Hoàng Mạnh Duy và Hoàng Trung Hiếu. Tên nhánh/worklog biểu diễn phạm vi backlog; lịch sử commit vẫn giữ đúng tài khoản thực tế thao tác, không giả mạo tác giả của thành viên khác.

## Quy tắc commit

- `feat:` chức năng mới.
- `fix:` sửa lỗi.
- `test:` bổ sung/sửa kiểm thử.
- `docs:` tài liệu.
- `chore:` cấu hình, công việc kỹ thuật.

Commit nhỏ, rõ ràng; không commit `.env`, `node_modules`, dữ liệu runtime hay secrets.
