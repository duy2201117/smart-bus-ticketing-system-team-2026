import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = relativePath => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

const booking = source('./features/passenger/BookingPage.jsx');
const tickets = source('./features/passenger/TicketsPage.jsx');
const driver = source('./features/driver/DriverPage.jsx');
const fleet = source('./features/operations/FleetSections.jsx');
const people = source('./features/operations/PeopleSections.jsx');
const passes = source('./features/passenger/PassesPage.jsx');
const reports = source('./features/operations/ReportsSections.jsx');
const complaints = source('./features/passenger/ComplaintsPage.jsx');

describe('Final takeover frontend coverage', () => {
  it('keeps the transferred Trương frontend areas present', () => {
    expect(booking).toMatch(/seat|ghế/i);
    expect(booking).toMatch(/payment|thanh toán/i);
    expect(tickets).toMatch(/refund|hoàn tiền/i);
    expect(driver).toContain('/driver/incidents');
    expect(fleet).toMatch(/schedule|lịch/i);
    expect(people).toMatch(/audit|nhật ký/i);
    expect(passes).toMatch(/renew|gia hạn/i);
    expect(reports).toMatch(/occupancy|lấp đầy/i);
  });

  it('completes the only missing transferred frontend requirement: trip rating', () => {
    expect(complaints).toContain("api('/complaints')");
    expect(complaints).toContain("api('/feedback')");
    expect(complaints).toMatch(/Gửi phản ánh/);
    expect(complaints).toMatch(/Đánh giá chuyến đi/);
    expect(complaints).toMatch(/1 sao/);
    expect(complaints).toMatch(/5 sao/);
    expect(complaints).toMatch(/Lịch sử đánh giá/);
    expect(complaints).toMatch(/Phản hồi/);
  });
});
