# BÁO CÁO BÀN GIAO FRONTEND SPRINT 1

## SMART BUS TICKETING SYSTEM

**Sinh viên thực hiện:** Luân Khánh Duy  
**Vai trò:** Frontend Developer  
**Sprint:** Sprint 1  

---

# 1. NHIỆM VỤ 1 - ĐỒNG HỒ ĐẾM NGƯỢC GIỮ CHỖ 10 PHÚT

## 1.1. Mục tiêu

Hiển thị thời gian giữ chỗ còn lại cho hành khách trong quá trình thanh toán vé.

## 1.2. Chức năng đã thực hiện

- Hiển thị danh sách ghế.
- Người dùng chọn ghế trước khi thanh toán.
- Tạo phiên giữ chỗ sau khi người dùng xác nhận ghế.
- Countdown bắt đầu từ 10:00.
- Countdown tự động cập nhật từng giây.
- Màu xanh khi thời gian còn trên 5 phút.
- Màu vàng khi thời gian còn từ 5 phút trở xuống.
- Màu đỏ khi thời gian còn từ 1 phút trở xuống.
- Hiển thị trạng thái ghế "Giữ chỗ".
- Khi thanh toán thành công:
  - Dừng countdown.
  - Chuyển trạng thái thành "Đã thanh toán".
  - Hiển thị thông báo thành công.
- Khi hết 10 phút:
  - Thông báo hết hạn giữ chỗ.
  - Hủy phiên giữ chỗ.
  - Trả ghế về trạng thái trống.
  - Quay lại màn hình chọn ghế.

## 1.3. Luồng xử lý

```text
Người dùng chọn ghế
        |
        v
Xác nhận giữ ghế
        |
        v
Tạo phiên giữ chỗ
        |
        v
Countdown 10:00
        |
        +-----------------------------+
        |                             |
        v                             v
Thanh toán thành công          Countdown = 00:00
        |                             |
        v                             v
Dừng countdown                 Thông báo hết hạn
        |                             |
        v                             v
Đã thanh toán                  Hủy giữ chỗ
                                      |
                                      v
                               Trả ghế về trống
                                      |
                                      v
                               Màn hình chọn ghế
```

## 1.4. Wireframe Countdown

```text
+--------------------------------------------+
|                 CHỌN GHẾ                   |
+--------------------------------------------+
| [A01] [A02] [A03] [A04]                   |
| [B01] [B02] [B03] [B04]                   |
|                                            |
| Ghế đã chọn: A01                           |
| [ Giữ ghế và tiếp tục thanh toán ]        |
+--------------------------------------------+

                    |
                    v

+--------------------------------------------+
|            THỜI GIAN GIỮ CHỖ              |
|                                            |
|                  10:00                     |
|                                            |
| Ghế: A01                                  |
| Trạng thái ghế: Giữ chỗ                   |
|                                            |
|       [ Thanh toán thành công ]            |
+--------------------------------------------+
```

### Quy ước màu Countdown

- Trên 5 phút: Xanh.
- Từ 5 phút trở xuống: Vàng.
- Từ 1 phút trở xuống: Đỏ.

---

# 2. NHIỆM VỤ 2 - GIAO DIỆN HỦY/ĐỔI VÉ

## 2.1. Mục tiêu

Cho phép hành khách hủy hoặc đổi vé trước giờ khởi hành.

## 2.2. Chức năng đã thực hiện

- Tra cứu vé theo mã vé.
- Tra cứu bằng mã vé điện tử mới.
- Hiển thị thông tin vé.
- Hiển thị mã vé.
- Hiển thị chuyến.
- Hiển thị ghế.
- Hiển thị giá vé.
- Hiển thị giờ khởi hành.
- Hiển thị trạng thái vé.
- Hiển thị trạng thái hoàn tiền.
- Kiểm tra vé còn trước giờ khởi hành.
- Nút Hủy vé.
- Nút Đổi vé.
- Popup xác nhận hủy vé.
- Popup chọn chuyến mới.
- Không cho hủy lại vé đã hủy.
- Không cho đổi vé đã hủy.
- Không cho hủy/đổi khi đã đến hoặc qua giờ khởi hành.
- Kiểm tra số ghế trống của chuyến mới.
- Không cho đổi sang chuyến hết ghế.
- Cập nhật trạng thái vé sau khi hủy.
- Tạo yêu cầu hoàn tiền theo quy định.
- Cập nhật chuyến mới sau khi đổi.
- Sinh mã vé điện tử mới sau khi đổi chuyến.

---

# 3. LUỒNG HỦY VÉ

```text
Nhập mã vé
     |
     v
Tra cứu vé
     |
     v
Hiển thị thông tin vé
     |
     v
Kiểm tra giờ khởi hành
     |
     +---- Đã đến/qua giờ ----> Không cho hủy
     |
     v
Bấm "Hủy vé"
     |
     v
Kiểm tra điều kiện hủy
     |
     v
Hiển thị popup xác nhận
     |
     v
Người dùng xác nhận
     |
     v
Cập nhật trạng thái "Đã hủy"
     |
     v
Tạo yêu cầu hoàn tiền
     |
     v
Chờ xử lý hoàn tiền theo quy định
```

**Lưu ý:** Tài liệu Sprint không cung cấp tỷ lệ hoặc công thức hoàn tiền cụ thể. Vì vậy Frontend không tự đặt phần trăm hoàn tiền mà thể hiện trạng thái:

```text
Chờ xử lý theo quy định
```

---

# 4. LUỒNG ĐỔI VÉ

```text
Tra cứu vé
     |
     v
Kiểm tra giờ khởi hành
     |
     +---- Đã đến/qua giờ ----> Không cho đổi
     |
     v
Bấm "Đổi vé"
     |
     v
Hiển thị danh sách chuyến mới
     |
     v
Chọn chuyến
     |
     v
Kiểm tra ghế trống
     |
     +---- Hết ghế ----> Không cho xác nhận
     |
     v
Xác nhận đổi
     |
     v
Cập nhật dữ liệu vé
     |
     v
Sinh mã vé điện tử mới
     |
     v
Hiển thị chuyến và mã vé điện tử mới
```

---

# 5. WIREFRAME HỦY/ĐỔI VÉ

```text
+------------------------------------------------+
|                  VÉ CỦA TÔI                   |
+------------------------------------------------+
| Tra cứu vé                                    |
| [ Nhập VE001 hoặc mã DT...                 ]  |
+------------------------------------------------+

+------------------------------------------------+
| Mã vé: VE001                                  |
| Chuyến: Hà Nội → Thái Nguyên                  |
| Ghế: A01                                      |
| Giờ khởi hành: ...                            |
| Giá vé: 120.000 VNĐ                           |
| Trạng thái: Đã thanh toán                     |
| Hoàn tiền: Chưa yêu cầu                       |
|                                                |
| ✓ Vé còn trong thời gian cho phép hủy/đổi     |
|                                                |
| [ Hủy vé ]              [ Đổi vé ]            |
+------------------------------------------------+
```

### Popup hủy vé

```text
+--------------------------------+
|       XÁC NHẬN HỦY VÉ?         |
|                                |
|    [ Đồng ý ]     [ Đóng ]     |
+--------------------------------+
```

### Popup đổi vé

```text
+-------------------------------------------+
|              ĐỔI CHUYẾN XE               |
|                                           |
| Chọn chuyến mới:                          |
| [ Hà Nội → Bắc Ninh - Còn 5 ghế       v] |
|                                           |
| Còn 5 ghế trống                           |
|                                           |
|       [ Xác nhận ]    [ Đóng ]            |
+-------------------------------------------+
```

Sau khi đổi thành công:

```text
+-------------------------------------------+
| Mã vé điện tử mới: DT...                  |
| Chuyến mới: Hà Nội → Bắc Ninh             |
+-------------------------------------------+
```

---

# 6. TIÊU CHÍ KIỂM THỬ NGHIỆM THU

## 6.1. Chọn ghế và giữ chỗ

- Hiển thị màn hình chọn ghế.
- Chưa chọn ghế thì không thể bắt đầu giữ chỗ.
- Người dùng có thể chọn ghế.
- Sau khi chọn ghế có thể bắt đầu phiên giữ chỗ.
- Countdown xuất hiện sau khi tạo phiên giữ chỗ.

## 6.2. Countdown

- Countdown khởi tạo ở 10:00.
- Countdown tự giảm từng giây.
- Trên 5 phút hiển thị màu xanh.
- Từ 5 phút trở xuống hiển thị màu vàng.
- Từ 1 phút trở xuống hiển thị màu đỏ.
- Thanh toán thành công làm countdown dừng.
- Thanh toán thành công chuyển trạng thái sang "Đã thanh toán".
- Hết 10 phút hiển thị thông báo.
- Hết 10 phút hủy phiên giữ chỗ.
- Hết 10 phút trả ghế.
- Sau khi hết hạn người dùng quay lại màn hình chọn ghế.

## 6.3. Hủy vé

- Tra cứu được vé theo mã.
- Hiển thị đúng thông tin vé.
- Hiển thị giờ khởi hành.
- Kiểm tra điều kiện trước giờ khởi hành.
- Bấm Hủy vé hiển thị popup xác nhận.
- Xác nhận hủy cập nhật trạng thái thành "Đã hủy".
- Vé đã hủy không thể hủy lại.
- Vé đã hủy không thể đổi.
- Vé đã đến hoặc qua giờ khởi hành không được hủy.
- Sau khi hủy tạo trạng thái hoàn tiền theo quy định.

## 6.4. Đổi vé

- Kiểm tra vé còn trước giờ khởi hành.
- Hiển thị danh sách chuyến mới.
- Hiển thị số ghế trống.
- Chuyến còn ghế có thể được chọn.
- Chuyến hết ghế không thể xác nhận.
- Vé đã đến hoặc qua giờ khởi hành không được đổi.
- Đổi thành công cập nhật chuyến mới.
- Đổi thành công sinh mã vé điện tử mới.
- Mã vé điện tử mới được hiển thị.
- Có thể tra cứu bằng mã vé điện tử mới.

---

# 7. KIỂM THỬ TỰ ĐỘNG

Công nghệ:

- Vitest.
- React Testing Library.
- jest-dom.
- jsdom.

Các nhóm kiểm thử:

- CancelModal.
- ChangeTripModal.
- SelectSeat.
- CountdownTimer.
- ticketService.

Kết quả kiểm thử cuối:

```text
Test Files: 5 passed
Tests: 31 passed
```

---

# 8. BUILD VÀ LINT

Các lệnh kiểm tra:

```bash
npm test
npm run build
npm run lint
```

Kết quả kiểm tra cuối:

```text
npm test       -> PASS (31/31)
npm run build  -> PASS
npm run lint   -> PASS
```

---

# 9. PHẠM VI TRIỂN KHAI

Sprint 1 hiện triển khai Frontend bằng React + Vite.

Dữ liệu vé, chuyến và số ghế trống hiện sử dụng Mock Data trong:

```text
src/services/ticketService.js
```

Service được tách riêng để có thể thay thế bằng Backend API khi API chính thức được cung cấp.

Dữ liệu giờ khởi hành trong bản demo cũng là dữ liệu mô phỏng.

Không tự đặt tỷ lệ hoàn tiền vì tài liệu nhiệm vụ không cung cấp tỷ lệ hoặc công thức hoàn tiền cụ thể.

---

# 10. KẾT QUẢ BÀN GIAO

Đã chuẩn bị:

- Wireframe giao diện Countdown.
- Wireframe giao diện Hủy/Đổi vé.
- Mô tả nghiệp vụ.
- Luồng xử lý chức năng.
- Tiêu chí kiểm thử nghiệm thu.

---

# 11. KẾT LUẬN

Frontend Sprint 1 thuộc nhiệm vụ của Luân Khánh Duy đã triển khai:

- Chọn ghế.
- Tạo phiên giữ chỗ ở mức Frontend.
- Countdown giữ chỗ 10 phút.
- Countdown cập nhật từng giây.
- Màu cảnh báo theo thời gian.
- Hủy giữ chỗ khi hết hạn.
- Trả ghế khi hết hạn ở trạng thái Frontend.
- Dừng countdown khi thanh toán thành công.
- Tra cứu vé.
- Hiển thị thông tin vé.
- Kiểm tra giờ khởi hành.
- Hủy vé.
- Xử lý trạng thái hoàn tiền.
- Đổi chuyến.
- Kiểm tra ghế trống.
- Sinh mã vé điện tử mới.
- Unit Test.
- Build.
- Lint.