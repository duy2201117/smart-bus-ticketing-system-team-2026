import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = relativePath => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const searchPage = source('./features/passenger/SearchPage.jsx');
const ticketsPage = source('./features/passenger/TicketsPage.jsx');
const supportPage = source('./features/passenger/SupportPage.jsx');
const fleetSections = source('./features/operations/FleetSections.jsx');
const driverPage = source('./features/driver/DriverPage.jsx');
const peopleSections = source('./features/operations/PeopleSections.jsx');
const reportsSections = source('./features/operations/ReportsSections.jsx');
const bookingPage = source('./features/passenger/BookingPage.jsx');

describe('Đinh Minh Dũng - official frontend scope across 4 sprints', () => {
  it('Sprint 1 / US01: search form integrates route and trip APIs and renders query results', () => {
    expect(searchPage).toContain("api('/routes')");
    expect(searchPage).toContain('api(`/trips?${query}`)');
    expect(searchPage).toContain('Điểm đi');
    expect(searchPage).toContain('Điểm đến');
    expect(searchPage).toContain('Tìm chuyến xe');
    expect(searchPage).toContain('sortedTrips.map');
  });

  it('Sprint 1 / US04: electronic ticket displays QR information and allows QR image download', () => {
    expect(ticketsPage).toContain('`/tickets/${ticket.id}/qr`');
    expect(ticketsPage).toContain('Vé điện tử của bạn');
    expect(ticketsPage).toContain('Lưu ảnh mã QR');
    expect(ticketsPage).toContain('download={`SmartBus-ve-${ticket.id}.png`}');
  });

  it('Sprint 2 / US07: invoice UI supports PDF download and resend-by-email', () => {
    expect(ticketsPage).toContain('`/tickets/${ticket.id}/invoice`');
    expect(ticketsPage).toContain('Tải hóa đơn PDF');
    expect(ticketsPage).toContain('`/tickets/${ticket.id}/email`');
    expect(ticketsPage).toContain('Gửi hóa đơn qua email');
  });

  it('Sprint 2 / US10: passenger notifications can be displayed and marked as read', () => {
    expect(supportPage).toContain("api('/notifications')");
    expect(supportPage).toContain('`/notifications/${id}/read`');
    expect(supportPage).toContain('Thông báo của bạn');
    expect(supportPage).toContain('Đánh dấu đã đọc');
    expect(supportPage).toContain("notifications.filter(item => !item.read).length");
  });

  it('Sprint 3 / US12: route and stop management UI covers list/create/update/deactivate and fare editing', () => {
    expect(fleetSections).toContain("useResource('/admin/routes')");
    expect(fleetSections).toContain("useResource('/admin/stops')");
    expect(fleetSections).toContain("'/admin/routes'");
    expect(fleetSections).toContain("'/admin/stops'");
    expect(fleetSections).toContain('+ Thêm tuyến');
    expect(fleetSections).toContain('+ Thêm trạm');
    expect(fleetSections).toContain("label: 'Giá vé'");
    expect(fleetSections).toContain('Sửa');
  });

  it('Sprint 3 / US15: QR scanning UI uses camera decoding and submits verification to backend', () => {
    expect(driverPage).toContain("import('@zxing/browser')");
    expect(driverPage).toContain('BrowserMultiFormatReader');
    expect(driverPage).toContain('decodeFromVideoDevice');
    expect(driverPage).toContain("api('/driver/scan'");
    expect(driverPage).toContain('Quét mã bằng camera');
    expect(driverPage).toContain('Khung camera quét mã QR');
  });

  it('Sprint 3 / US22: account management UI supports roles and account activation state', () => {
    expect(peopleSections).toContain("useResource('/admin/users')");
    expect(peopleSections).toContain("'/admin/users'");
    expect(peopleSections).toContain('Quản lý tài khoản');
    expect(peopleSections).toContain('Phân quyền truy cập');
    expect(peopleSections).toContain('role: form.role');
    expect(peopleSections).toContain('active: form.active');
  });

  it('Sprint 4 / US18: voucher management and booking voucher input are both present', () => {
    expect(peopleSections).toContain("useResource('/admin/vouchers')");
    expect(peopleSections).toContain("'/admin/vouchers'");
    expect(peopleSections).toContain('Mã giảm giá');
    expect(peopleSections).toContain('+ Tạo mã');
    expect(bookingPage).toContain("api('/vouchers/active')");
    expect(bookingPage).toContain('Mã ưu đãi (nếu có)');
    expect(bookingPage).toContain('voucherCode: voucher.trim()');
  });

  it('Sprint 4 / US19: revenue dashboard has date/route filters and revenue visualization', () => {
    expect(reportsSections).toContain('Báo cáo & thống kê');
    expect(reportsSections).toContain('Doanh thu hôm nay');
    expect(reportsSections).toContain('Doanh thu tháng này');
    expect(reportsSections).toContain('Doanh thu theo ngày');
    expect(reportsSections).toContain("useResource('/admin/routes')");
    expect(reportsSections).toContain('Từ ngày');
    expect(reportsSections).toContain('Đến ngày');
    expect(reportsSections).toContain('Tuyến đường');
    expect(reportsSections).toContain('ops-chart-bar');
  });
});
