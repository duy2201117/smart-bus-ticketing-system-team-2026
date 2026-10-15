# Chạy SmartBus trên Windows

Sau khi giải nén, mở PowerShell ngay tại thư mục có `package.json`:

```powershell
npm install
npm run dev
```

`npm run dev` chạy đồng thời:

- API: `http://127.0.0.1:3001/api/health`
- Web: `http://127.0.0.1:5173`

Development mặc định dùng PGlite in-memory để tránh lỗi `RuntimeError: Aborted()`/`ECONNREFUSED 127.0.0.1:3001` từng xảy ra trên Windows. Dữ liệu demo được seed lại tự động sau mỗi lần khởi động.

Nếu muốn lưu database qua lần restart, tạo `.env` với:

```env
DEMO_MODE=true
DATA_DIR=data/pg
```

Nếu PGlite persistent bị hỏng/không tương thích trong development, backend tự chuyển sang RAM và vẫn tiếp tục chạy; frontend vì thế không còn báo 502 do API chết.
