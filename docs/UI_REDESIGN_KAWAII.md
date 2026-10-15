# UI Redesign — BubuBus Kawaii 3D Cartoon

Bản này chỉ thay đổi lớp trình bày. API, schema database, routing, logic booking/payment/QR/GPS/RBAC vẫn giữ nguyên.

## Design system

- Mascot chính: `public/bubu-bus.png` và `src/assets/bubu-bus.png`.
- Palette: Cyan `#65D5E5`, Baby Blue `#DDF8FC`, Pink `#FFB6D9`, Lavender `#D8C7FF`, Cream `#FFF8E8`, Yellow `#FFE38A`, Mint `#BDEFD9`.
- Font: Fredoka cho heading, Baloo 2 cho button/menu/label, Nunito cho nội dung.
- Card bo 24–30px, shadow mềm, pill controls, pastel focus ring, animation nhẹ và hỗ trợ `prefers-reduced-motion`.

## Phạm vi đã áp dụng

- App shell, sidebar, topbar, footer và logo mascot.
- Trang tìm chuyến + hero thành phố cartoon + search floating card.
- Trip cards, route cards, CTA.
- Chọn ghế dạng bus cartoon và trạng thái ghế.
- Checkout/payment cards và countdown.
- Vé điện tử, QR panel, vé của tôi, success/empty/loading/error states.
- Leaflet tracking: marker xe dùng mascot, route/stops đổi sang palette pastel.
- Vé tháng, support, feedback, complaint, profile.
- Login/register/forgot/reset password.
- Driver workspace và camera panel.
- Admin/Manager operations dashboard, table, tabs, charts, form, analytics/heatmap.
- Legacy Sprint-1 pages/components/modal vẫn được đồng bộ giao diện dù không nằm trong router production hiện tại.
- Favicon/trình duyệt dùng mascot Bubu.

## Responsive

Desktop, tablet và mobile vẫn dùng layout hiện tại; lớp redesign có breakpoint riêng cho 1200/900/800/600/520px, không thay đổi data flow.
