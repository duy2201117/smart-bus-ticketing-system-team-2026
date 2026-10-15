# Chạy bản FINAL trên Windows

Mở PowerShell tại đúng thư mục có `package.json`, sau đó chạy:

```powershell
npm install
npm run test:server
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm run dev:full
```

Nếu project được giải nén lồng `SmartBusFrontend\SmartBusFrontend`, hãy mở terminal tại thư mục con có `package.json`.

## Kết quả audit đã xác nhận

- Backend/unit suite trong môi trường audit: **9/9 PASS**.
- Các test bao phủ API/RBAC, seat hold/race, sandbox payment signed callback, refund, QR replay, private discount evidence, voucher race, GPS/ETA, analytics/backtest và seed 60 ngày.
- Playwright E2E + responsive suite đã được đưa vào source. Do native Vite/Rolldown dependency của `node_modules` Windows không tương thích container Linux và registry install không hoàn tất trong phiên audit, frontend build/E2E cuối cần chạy lại bằng các lệnh trên máy Windows đích.

Không cần `node_modules` trong ZIP; `npm install` sẽ tạo lại dependency đúng nền tảng.
