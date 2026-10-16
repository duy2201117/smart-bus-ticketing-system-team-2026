# FINAL AUDIT — SmartBus Ticketing System

## Phạm vi chốt

- Phạm vi phân công chính thức của nhóm: **4 Sprint** theo bảng `PHAN_CONG_FINAL_4_SPRINT_DUNG_VAI_TRO`.
- Các module AI/Analytics hiện có trong repository là **chức năng bổ sung ngoài bảng phân công chính thức 4 Sprint**; chúng được giữ lại vì đã triển khai và có kiểm thử, nhưng không dùng để thay đổi phân công gốc.
- Ma trận audit kỹ thuật toàn repository: **41/41 COMPLETE**, **0 PARTIAL**, **0 MISSING** trong phạm vi đồ án/local-demo.
- Payment bên thứ ba được triển khai bằng **sandbox** khi không có merchant credential: MoMo/VNPay/ZaloPay/Bank Card, success/pending/failed/cancelled, idempotency, signed HMAC webhook, replay-safe callback và automatic refund sandbox.
- GPS không có thiết bị thật được đáp ứng bằng browser geolocation khi tài xế cấp quyền + backend GPS simulator, route/stops/location history/notification và ETA minh bạch.
- Email không có provider key dùng outbox development abstraction; invoice PDF vẫn sinh thật.
- Minh chứng ưu đãi có private storage, giới hạn định dạng/kích thước và RBAC.

## Trạng thái CI cuối

GitHub Actions trên bản chốt chạy và đã PASS các bước:

- `npm ci`
- `npm run lint`
- `npm test`
- `npm run test:server`
- `npm run build`

Hai nhánh `main` và `develop` được đồng bộ cùng bản release cuối trước khi chốt.

## Kiểm thử

Backend/unit/integration coverage trong repository bao gồm:

- `server/app.test.js`
- `server/paymentGateway.test.js`
- `server/analytics.test.js`
- `server/eta.test.js`
- `server/seed.test.js`
- các regression test bổ sung theo phạm vi phân công/takeover.

Các assertion gồm seat HELD/SOLD/expiry, tranh ghế, payment callback signature/replay, invoice/outbox, auto-refund/double-refund, voucher race, private discount evidence permissions, CRUD/assignment conflict, QR scan/replay, incident/notifications, GPS simulator/ETA, analytics/forecast/backtest/export và RBAC/audit.

Playwright `e2e/smartbus.spec.js` bao phủ Passenger/Driver/Manager/Admin và responsive 1920/1366/1024/768/390. E2E được chạy thủ công trên máy demo bằng `npm run test:e2e` sau khi cài Chromium; workflow CI hiện tập trung vào lint, frontend tests, server tests và production build.

## Ghi nhận phân công

- Bảng phân công gốc 4 Sprint được giữ nguyên.
- Những hạng mục thành viên khác được Luân Khánh Duy thực tế tiếp quản được ghi rõ là **takeover**, không ghi ngược thành nhiệm vụ chính thức ban đầu của Luân.
- Lịch sử commit/PR cũ được giữ để bảo toàn audit history; không sửa author/committer nhằm giả lập đóng góp.
- Tổng hợp vai trò và trạng thái chốt nằm tại `docs/TEAM_FINAL_SCOPE.md`.

## Diễn giải "COMPLETE"

`COMPLETE` nghĩa là feature của đồ án tồn tại end-to-end theo phạm vi đã quy định, bao gồm sandbox/simulator khi external credential/hardware không sẵn có. Nó không có nghĩa merchant production, mail provider production, GPS hardware hay road-routing thương mại đã được cấp credential và triển khai ngoài môi trường đồ án.
