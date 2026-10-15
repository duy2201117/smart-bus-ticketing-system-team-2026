import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { all, one, required, fail, log } from './helpers.js';

function filtersFrom(query) {
  const from = query.from || new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const to = query.to || new Date().toISOString().slice(0, 10);
  for (const value of [from, to]) if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) fail(400, 'Khoảng ngày báo cáo không hợp lệ.');
  if (from > to) fail(400, 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 366 * 86400000) fail(400, 'Mỗi báo cáo tối đa 366 ngày.');
  return { from, to, routeId: query.routeId || '' };
}

async function reportData(db, query) {
  const { from, to, routeId } = filtersFrom(query);
  const values = [`${from}T00:00:00.000Z`, `${new Date(Date.parse(`${to}T00:00:00Z`) + 86400000).toISOString()}`];
  const routeClause = routeId ? ` AND t."routeId"=$3` : '';
  if (routeId) values.push(required(routeId, 'Mã tuyến', 120));
  const stats = await one(db, `SELECT COALESCE((SELECT SUM(p.amount) FROM payments p JOIN tickets tk ON tk.id=p."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE p.status IN ('paid','refunded') AND COALESCE(tk."paidAt",p."createdAt")>=$1 AND COALESCE(tk."paidAt",p."createdAt")<$2${routeClause}),0)::int - COALESCE((SELECT SUM(rf.amount) FROM refunds rf JOIN tickets tk ON tk.id=rf."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE rf.status IN ('completed','refunded') AND rf."createdAt">=$1 AND rf."createdAt"<$2${routeClause}),0)::int AS revenue,
      (SELECT COUNT(*)::int FROM tickets tk JOIN trips t ON t.id=tk."tripId" WHERE tk.status IN ('paid','checked_in','cancelled') AND COALESCE(tk."paidAt",tk."createdAt")>=$1 AND COALESCE(tk."paidAt",tk."createdAt")<$2${routeClause}) AS tickets,
      (SELECT COUNT(DISTINCT p."bookingId")::int FROM payments p JOIN tickets tk ON tk.id=p."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE p.status IN ('paid','refunded') AND COALESCE(tk."paidAt",p."createdAt")>=$1 AND COALESCE(tk."paidAt",p."createdAt")<$2${routeClause}) AS bookings,
      (SELECT COUNT(*)::int FROM refunds rf JOIN tickets tk ON tk.id=rf."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE rf."createdAt">=$1 AND rf."createdAt"<$2${routeClause}) AS refunds,
      (SELECT COUNT(*)::int FROM trips t WHERE t."departureTime">=$1 AND t."departureTime"<$2${routeClause}) AS trips,
      (SELECT COALESCE(SUM(b."seatCount"),0)::int FROM trips t JOIN buses b ON b.id=t."busId" WHERE t."departureTime">=$1 AND t."departureTime"<$2${routeClause}) AS capacity,
      (SELECT COUNT(*)::int FROM tickets tk JOIN trips t ON t.id=tk."tripId" WHERE tk.status IN ('paid','checked_in') AND t."departureTime">=$1 AND t."departureTime"<$2${routeClause}) AS occupied`, values);
  const localToday = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const monthStartDate = `${localToday.slice(0, 7)}-01`;
  const nextMonth = new Date(`${monthStartDate}T00:00:00+07:00`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const nextMonthDate = nextMonth.toISOString().slice(0, 10);
  const periodValues = (start, end) => [new Date(`${start}T00:00:00+07:00`).toISOString(), new Date(`${end}T00:00:00+07:00`).toISOString(), ...(routeId ? [routeId] : [])];
  const todayRange = periodValues(localToday, new Date(Date.parse(`${localToday}T00:00:00+07:00`) + 86400000).toISOString().slice(0, 10));
  const monthRange = periodValues(monthStartDate, nextMonthDate);
  const periodMetrics = async params => one(db, `SELECT
      COALESCE((SELECT SUM(p.amount) FROM payments p JOIN tickets tk ON tk.id=p."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE p.status IN ('paid','refunded') AND p."createdAt">=$1 AND p."createdAt"<$2${routeClause}),0)::int -
      COALESCE((SELECT SUM(rf.amount) FROM refunds rf JOIN tickets tk ON tk.id=rf."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE rf.status IN ('completed','refunded') AND rf."createdAt">=$1 AND rf."createdAt"<$2${routeClause}),0)::int AS revenue,
      (SELECT COUNT(DISTINCT tk.id)::int FROM payments p JOIN tickets tk ON tk.id=p."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE p.status IN ('paid','refunded') AND p."createdAt">=$1 AND p."createdAt"<$2${routeClause}) AS tickets,
      (SELECT COUNT(DISTINCT p."bookingId")::int FROM payments p JOIN tickets tk ON tk.id=p."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE p.status IN ('paid','refunded') AND p."createdAt">=$1 AND p."createdAt"<$2${routeClause}) AS bookings`, params);
  const todayMetrics = await periodMetrics(todayRange);
  const monthMetrics = await periodMetrics(monthRange);
  const daily = await all(db, `WITH payment_days AS (
      SELECT to_char(COALESCE(tk."paidAt",p."createdAt")::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') AS date,COUNT(DISTINCT tk.id)::int AS tickets,SUM(p.amount)::int AS gross FROM payments p JOIN tickets tk ON tk.id=p."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE p.status IN ('paid','refunded') AND COALESCE(tk."paidAt",p."createdAt")>=$1 AND COALESCE(tk."paidAt",p."createdAt")<$2${routeClause} GROUP BY date
    ), refund_days AS (
      SELECT to_char(rf."createdAt"::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD') AS date,SUM(rf.amount)::int AS refunds FROM refunds rf JOIN tickets tk ON tk.id=rf."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE rf.status IN ('completed','refunded') AND rf."createdAt">=$1 AND rf."createdAt"<$2${routeClause} GROUP BY date
    ) SELECT COALESCE(p.date,r.date) AS date,COALESCE(p.tickets,0)::int AS tickets,COALESCE(p.gross,0)::int-COALESCE(r.refunds,0)::int AS revenue FROM payment_days p FULL OUTER JOIN refund_days r ON p.date=r.date ORDER BY date`, values);
  const routeFilter = routeId ? ' AND t."routeId"=$3' : '';
  const byRoute = await all(db, `WITH capacity AS (
      SELECT t."routeId",COUNT(DISTINCT t.id)::int AS trips,SUM(b."seatCount")::int AS capacity FROM trips t JOIN buses b ON b.id=t."busId" WHERE t."departureTime">=$1 AND t."departureTime"<$2${routeFilter} GROUP BY t."routeId"
    ), occupied AS (
      SELECT t."routeId",COUNT(DISTINCT tk.id)::int AS occupied FROM trips t JOIN tickets tk ON tk."tripId"=t.id WHERE t."departureTime">=$1 AND t."departureTime"<$2${routeFilter} AND tk.status IN ('paid','checked_in') GROUP BY t."routeId"
    ), payments_by_route AS (
      SELECT t."routeId",COUNT(DISTINCT tk.id)::int AS tickets,COALESCE(SUM(p.amount) FILTER (WHERE p.status IN ('paid','refunded')),0)::int AS gross FROM payments p JOIN tickets tk ON tk.id=p."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE COALESCE(tk."paidAt",p."createdAt")>=$1 AND COALESCE(tk."paidAt",p."createdAt")<$2${routeFilter} GROUP BY t."routeId"
    ), refunds_by_route AS (
      SELECT t."routeId",SUM(rf.amount)::int AS refunds FROM refunds rf JOIN tickets tk ON tk.id=rf."ticketId" JOIN trips t ON t.id=tk."tripId" WHERE rf.status IN ('completed','refunded') AND rf."createdAt">=$1 AND rf."createdAt"<$2${routeFilter} GROUP BY t."routeId"
    ) SELECT r.id AS "routeId",r.name AS "routeName",COALESCE(p.tickets,0)::int AS tickets,(COALESCE(p.gross,0)-COALESCE(f.refunds,0))::int AS revenue,COALESCE(c.trips,0)::int AS trips,COALESCE(c.capacity,0)::int AS capacity,COALESCE(o.occupied,0)::int AS occupied
      FROM routes r LEFT JOIN capacity c ON c."routeId"=r.id LEFT JOIN occupied o ON o."routeId"=r.id LEFT JOIN payments_by_route p ON p."routeId"=r.id LEFT JOIN refunds_by_route f ON f."routeId"=r.id WHERE ($3::text IS NULL OR r.id=$3) ORDER BY revenue DESC`, [values[0], values[1], routeId || null]);
  const capacities = await all(db, `SELECT t."routeId",SUM(b."seatCount")::int AS capacity FROM trips t JOIN buses b ON b.id=t."busId" WHERE t."departureTime">=$1 AND t."departureTime"<$2${routeClause} GROUP BY t."routeId"`, values);
  const capacityByRoute = new Map(capacities.map(row => [row.routeId, Number(row.capacity)]));
  const adjustedRoutes = byRoute.map(row => { const capacity = capacityByRoute.get(row.routeId) || 0; return { ...row, capacity, occupancy: capacity ? Number(row.occupied) * 100 / capacity : 0 }; });
  const recentTickets = await all(db, `SELECT tk.id,tk.code,tk.price,tk.status,tk."createdAt",r.name AS "routeName" FROM tickets tk JOIN trips t ON t.id=tk."tripId" JOIN routes r ON r.id=t."routeId" WHERE COALESCE(tk."paidAt",tk."createdAt")>=$1 AND COALESCE(tk."paidAt",tk."createdAt")<$2${routeClause} ORDER BY tk."createdAt" DESC LIMIT 12`, values);
  const incidents = await all(db, `SELECT i.*,r.name AS "routeName" FROM incidents i JOIN trips t ON t.id=i."tripId" JOIN routes r ON r.id=t."routeId" WHERE i."createdAt">=$1 AND i."createdAt"<$2${routeClause} ORDER BY i."createdAt" DESC LIMIT 20`, values);
  return { filters: { from, to, routeId }, stats: { revenue: Number(stats.revenue), tickets: Number(stats.tickets), bookings: Number(stats.bookings), refunds: Number(stats.refunds), todayRevenue: Number(todayMetrics.revenue), todayTickets: Number(todayMetrics.tickets), todayBookings: Number(todayMetrics.bookings), monthRevenue: Number(monthMetrics.revenue), monthTickets: Number(monthMetrics.tickets), monthBookings: Number(monthMetrics.bookings), trips: Number(stats.trips), occupancy: Number(stats.capacity) ? Number(stats.occupied) * 100 / Number(stats.capacity) : 0 }, daily, byRoute: adjustedRoutes, recentTickets, incidents };
}

export function registerReports({ db, staff }) {
  staff('get', '/admin/overview', async (_req, res) => res.json(await reportData(db, {})));
  staff('get', '/admin/reports', async (req, res) => res.json(await reportData(db, req.query)));
  staff('get', '/admin/reports/export', async (req, res) => {
    const format = req.query.format;
    if (!['xlsx', 'pdf'].includes(format)) fail(400, 'Định dạng xuất chỉ hỗ trợ xlsx hoặc pdf.');
    const data = await reportData(db, req.query);
    await log(db, req.user.id, 'EXPORT', 'reports', `${data.filters.from}:${data.filters.to}`, { format, routeId: data.filters.routeId });
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook(); workbook.creator = 'SmartBus';
      const sheet = workbook.addWorksheet('Báo cáo doanh thu');
      sheet.columns = [{ header: 'Ngày', key: 'date', width: 16 }, { header: 'Số vé', key: 'tickets', width: 16 }, { header: 'Doanh thu (VNĐ)', key: 'revenue', width: 24 }];
      for (const row of data.daily) sheet.addRow(row);
      sheet.addRow({ date: 'Tổng cộng', tickets: data.stats.tickets, revenue: data.stats.revenue });
      const routes = workbook.addWorksheet('Theo tuyến');
      routes.columns = [{ header: 'Tuyến đường', key: 'routeName', width: 32 }, { header: 'Số vé', key: 'tickets', width: 16 }, { header: 'Doanh thu (VNĐ)', key: 'revenue', width: 24 }, { header: 'Lấp đầy (%)', key: 'occupancy', width: 16 }];
      for (const row of data.byRoute) routes.addRow(row);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="smartbus-bao-cao-${data.filters.from}.xlsx"`);
      res.send(Buffer.from(await workbook.xlsx.writeBuffer())); return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="smartbus-bao-cao-${data.filters.from}.pdf"`);
    const pdf = new PDFDocument({ margin: 48, size: 'A4' });
    const fontPath = ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/Library/Fonts/Arial.ttf'].find(existsSync);
    if (fontPath) pdf.font(fontPath);
    pdf.pipe(res);
    pdf.fontSize(18).text('BÁO CÁO DOANH THU SMARTBUS'); pdf.moveDown().fontSize(10).text(`Thời gian: ${data.filters.from} đến ${data.filters.to}`);
    pdf.moveDown().fontSize(12).text(`Doanh thu thuần: ${Number(data.stats.revenue).toLocaleString('vi-VN')} VNĐ`);
    pdf.text(`Vé đã bán: ${data.stats.tickets} · Chuyến: ${data.stats.trips} · Lấp đầy: ${data.stats.occupancy.toFixed(1)}%`);
    pdf.moveDown().fontSize(13).text('Chi tiết doanh thu theo ngày'); pdf.moveDown(0.5).fontSize(9);
    for (const row of data.daily) pdf.text(`${row.date}     ${row.tickets} vé     ${Number(row.revenue).toLocaleString('vi-VN')} VNĐ`);
    pdf.moveDown().fontSize(13).text('Hiệu quả theo tuyến'); pdf.moveDown(0.5).fontSize(9);
    for (const row of data.byRoute) pdf.text(`${row.routeName}     ${row.tickets} vé     ${Number(row.revenue).toLocaleString('vi-VN')} VNĐ     ${Number(row.occupancy).toFixed(1)}%`);
    pdf.end();
  });
}