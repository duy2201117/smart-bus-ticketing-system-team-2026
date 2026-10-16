# Chạy bản FINAL trên Windows

Mở PowerShell tại đúng thư mục có `package.json`.

## 1. Cài dependency

```powershell
npm install
```

## 2. Chạy bộ kiểm tra giống CI

```powershell
npm run lint
npm test
npm run test:server
npm run build
```

Workflow GitHub Actions của bản chốt đã chạy thành công các bước tương ứng: cài dependency, lint, frontend tests, server tests và production build.

## 3. Chạy E2E thủ công

Playwright E2E không nằm trong workflow CI hiện tại. Khi cần demo/kiểm tra toàn luồng trên máy Windows:

```powershell
npx playwright install chromium
npm run test:e2e
```

Suite E2E bao phủ các flow Passenger/Driver/Manager/Admin và các viewport responsive chính.

## 4. Chạy ứng dụng

```powershell
npm run dev:full
```

Hoặc:

```powershell
npm run dev
```

Lệnh trên khởi động backend API và frontend development server. Mở địa chỉ frontend do Vite hiển thị trong terminal (mặc định `http://127.0.0.1:5173`).

## Ghi chú

- Không cần commit hoặc chép `node_modules`; `npm install` sẽ cài dependency theo đúng nền tảng.
- `.env` thật không được commit. Dùng `.env.example` khi cần cấu hình local.
- Development mặc định có thể dùng PGlite/RAM demo; đặt `DATABASE_URL` nếu muốn dùng PostgreSQL.
- Phạm vi phân công chính thức của dự án là **4 Sprint**; AI/Analytics trong source là phần bổ sung ngoài bảng phân công chính thức.
