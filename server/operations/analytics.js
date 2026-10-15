import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { all, one, required, integer, now, fail, log, makeId } from './helpers.js';

function range(query) {
  const to = query.to || new Date().toISOString().slice(0, 10);
  const from = query.from || new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
  for (const value of [from, to]) if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`))) fail(400, 'Khoảng ngày phân tích không hợp lệ.');
  if (from > to) fail(400, 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
  if (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`) > 366 * 86400000) fail(400, 'Mỗi lần phân tích tối đa 366 ngày.');
  return { from, to, routeId: query.routeId ? required(query.routeId, 'Mã tuyến', 120) : '' };
}

function demandLevel(occupancy) {
  if (occupancy >= 85) return 'VERY_HIGH';
  if (occupancy >= 65) return 'HIGH';
  if (occupancy >= 30) return 'MEDIUM';
  return 'LOW';
}

export function weightedAverage(rows) {
  const denominator = rows.reduce((sum, _row, index) => sum + rows.length - index, 0);
  return denominator ? rows.reduce((sum, row, index) => sum + Number(row.passengers) * (rows.length - index), 0) / denominator : 0;
}

export function backtest(rows) {
  if (rows.length < 8) return null;
  const testRows = rows.slice(0, Math.min(4, Math.floor(rows.length / 3))).reverse();
  const errors = [];
  for (let index = 0; index < testRows.length; index++) {
    const training = rows.slice(index + testRows.length);
    if (training.length < 3) continue;
    const actual = Number(testRows[index].passengers);
    const predicted = weightedAverage(training);
    errors.push({ absolute: Math.abs(actual - predicted), percent: actual ? Math.abs(actual - predicted) / actual * 100 : null });
  }
  const percentages = errors.filter(error => error.percent !== null).map(error => error.percent);
  return errors.length ? { mae: errors.reduce((sum, error) => sum + error.absolute, 0) / errors.length, mape: percentages.length ? percentages.reduce((sum, value) => sum + value, 0) / percentages.length : null, samples: errors.length } : null;
}

const hourExpression = `EXTRACT(HOUR FROM t."departureTime"::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::int`;
const dateExpression = `to_char(t."departureTime"::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh','YYYY-MM-DD')`;
const tripFacts = `SELECT t.id,t."routeId",r.name AS "routeName",${dateExpression} AS date,${hourExpression} AS hour,
  EXTRACT(DOW FROM t."departureTime"::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS weekday,
  b."seatCount"::int AS capacity,COUNT(DISTINCT tk.id) FILTER (WHERE tk.status IN ('paid','checked_in'))::int AS passengers,
  COUNT(DISTINCT tk."bookingId") FILTER (WHERE tk.status IN ('paid','checked_in'))::int AS bookings
  FROM trips t JOIN routes r ON r.id=t."routeId" JOIN buses b ON b.id=t."busId"
  LEFT JOIN tickets tk ON tk."tripId"=t.id
  WHERE t.status IN ('completed','running','scheduled')`;

export function registerAnalytics({ db, staff }) {
  staff('get', '/admin/analytics/passenger-density', async (req, res) => {
    const { from, to, routeId } = range(req.query);
    const values = [`${from}T00:00:00Z`, `${new Date(Date.parse(`${to}T00:00:00Z`) + 86400000).toISOString()}`];
    const routeFilter = routeId ? ' AND t."routeId"=$3' : '';
    if (routeId) values.push(routeId);
    const rows = await all(db, `WITH facts AS (${tripFacts} AND t."departureTime">=$1 AND t."departureTime"<$2${routeFilter} GROUP BY t.id,r.name,b."seatCount") SELECT date,hour,SUM(passengers)::int AS passengers,SUM(bookings)::int AS bookings,COUNT(*)::int AS trips FROM facts GROUP BY date,hour ORDER BY date,hour`, values);
    res.json(rows);
  });

  staff('get', '/admin/analytics/peak-hours', async (req, res) => {
    const { from, to, routeId } = range(req.query);
    const values = [`${from}T00:00:00Z`, `${new Date(Date.parse(`${to}T00:00:00Z`) + 86400000).toISOString()}`];
    const routeFilter = routeId ? ' AND t."routeId"=$3' : '';
    if (routeId) values.push(routeId);
    const hours = await all(db, `WITH facts AS (${tripFacts} AND t."departureTime">=$1 AND t."departureTime"<$2${routeFilter} GROUP BY t.id,r.name,b."seatCount") SELECT hour,SUM(passengers)::int AS passengers,SUM(bookings)::int AS bookings,COUNT(*)::int AS trips,SUM(capacity)::int AS capacity FROM facts GROUP BY hour ORDER BY passengers DESC`, values);
    const weekdays = await all(db, `WITH facts AS (${tripFacts} AND t."departureTime">=$1 AND t."departureTime"<$2${routeFilter} GROUP BY t.id,r.name,b."seatCount") SELECT weekday,SUM(passengers)::int AS passengers,SUM(bookings)::int AS bookings,COUNT(*)::int AS trips FROM facts GROUP BY weekday ORDER BY passengers DESC`, values);
    const routes = await all(db, `WITH facts AS (${tripFacts} AND t."departureTime">=$1 AND t."departureTime"<$2${routeFilter} GROUP BY t.id,r.name,b."seatCount") SELECT "routeId","routeName",SUM(passengers)::int AS passengers,COUNT(*)::int AS trips,SUM(capacity)::int AS capacity,CASE WHEN SUM(capacity)>0 THEN SUM(passengers)*100.0/SUM(capacity) ELSE 0 END AS occupancy FROM facts GROUP BY "routeId","routeName" ORDER BY passengers DESC`, values);
    const rankedHours = [...hours].sort((a, b) => Number(b.passengers) - Number(a.passengers));
    res.json({ hours, weekdays, routes, busiestHours: rankedHours.slice(0, 3), lowestHours: [...rankedHours].reverse().slice(0, 3), busiestDays: weekdays.slice(0, 3), highestOccupancyRoutes: [...routes].sort((a, b) => b.occupancy - a.occupancy).slice(0, 3), lowestOccupancyRoutes: [...routes].sort((a, b) => a.occupancy - b.occupancy).slice(0, 3) });
  });

  staff('get', '/admin/analytics/route-demand', async (req, res) => {
    const { from, to, routeId } = range(req.query);
    const values = [`${from}T00:00:00Z`, `${new Date(Date.parse(`${to}T00:00:00Z`) + 86400000).toISOString()}`];
    const routeFilter = routeId ? ' AND t."routeId"=$3' : '';
    if (routeId) values.push(routeId);
    res.json(await all(db, `WITH facts AS (${tripFacts} AND t."departureTime">=$1 AND t."departureTime"<$2${routeFilter} GROUP BY t.id,r.name,b."seatCount") SELECT "routeId","routeName",SUM(passengers)::int AS passengers,SUM(bookings)::int AS bookings,COUNT(*)::int AS trips,SUM(capacity)::int AS capacity,CASE WHEN SUM(capacity)>0 THEN SUM(passengers)*100.0/SUM(capacity) ELSE 0 END AS occupancy FROM facts GROUP BY "routeId","routeName" ORDER BY passengers DESC`, values));
  });

  staff('get', '/admin/analytics/occupancy-trends', async (req, res) => {
    const { from, to, routeId } = range(req.query);
    const values = [`${from}T00:00:00Z`, `${new Date(Date.parse(`${to}T00:00:00Z`) + 86400000).toISOString()}`];
    const routeFilter = routeId ? ' AND t."routeId"=$3' : '';
    if (routeId) values.push(routeId);
    res.json(await all(db, `WITH facts AS (${tripFacts} AND t."departureTime">=$1 AND t."departureTime"<$2${routeFilter} GROUP BY t.id,r.name,b."seatCount") SELECT date,SUM(passengers)::int AS passengers,SUM(capacity)::int AS capacity,CASE WHEN SUM(capacity)>0 THEN SUM(passengers)*100.0/SUM(capacity) ELSE 0 END AS occupancy FROM facts GROUP BY date ORDER BY date`, values));
  });

  staff('post', '/admin/analytics/forecast', async (req, res) => {
    const routeId = required(req.body.routeId, 'Tuyến đường', 120);
    const targetDate = req.body.date;
    const targetHour = integer(req.body.hour, 'Giờ khởi hành', 0, 23);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate || '') || !Number.isFinite(Date.parse(`${targetDate}T00:00:00Z`))) fail(400, 'Ngày dự báo không hợp lệ.');
    if (Date.parse(`${targetDate}T00:00:00Z`) < Date.now() - 86400000 || Date.parse(`${targetDate}T00:00:00Z`) > Date.now() + 366 * 86400000) fail(400, 'Ngày dự báo phải nằm trong 366 ngày tới.');
    const route = await one(db, 'SELECT id,name FROM routes WHERE id=$1 AND active=1', [routeId]);
    if (!route) fail(404, 'Không tìm thấy tuyến xe đang hoạt động.');
    const rows = await all(db, `WITH facts AS (${tripFacts} AND t."routeId"=$1 AND ${hourExpression}=$2 AND ${dateExpression}<$3 GROUP BY t.id,r.name,b."seatCount") SELECT date,SUM(passengers)::int AS passengers,SUM(bookings)::int AS bookings,SUM(capacity)::int AS capacity FROM facts GROUP BY date ORDER BY date DESC LIMIT 12`, [routeId, targetHour, targetDate]);
    const predictedPassengers = weightedAverage(rows);
    const predictedBookings = rows.length ? rows.reduce((sum, row, index) => sum + Number(row.bookings) * (rows.length - index), 0) / rows.reduce((sum, _row, index) => sum + rows.length - index, 0) : 0;
    const targetTrips = Number((await one(db, `SELECT COUNT(*)::int AS trips,COALESCE(SUM(b."seatCount"),0)::int AS capacity FROM trips t JOIN buses b ON b.id=t."busId" WHERE t."routeId"=$1 AND ${dateExpression}=$2 AND ${hourExpression}=$3 AND t.status<>'cancelled'`, [routeId, targetDate, targetHour])).capacity || 0);
    const averageCapacity = rows.length ? rows.reduce((sum, row) => sum + Number(row.capacity), 0) / rows.length : 0;
    const capacity = targetTrips || averageCapacity;
    const predictedOccupancy = capacity ? Math.min(100, predictedPassengers / capacity * 100) : 0;
    const confidence = rows.length >= 8 ? 0.85 : rows.length >= 4 ? 0.65 : rows.length >= 1 ? 0.4 : 0.1;
    const metrics = { samples: rows.length, historicalWindowDays: 84, backtest: backtest(rows), note: rows.length < 4 ? 'Dữ liệu lịch sử còn ít; dự báo có độ tin cậy thấp.' : '' };
    const forecast = await db.transaction(async tx => {
      const saved = (await tx.query('INSERT INTO demand_forecasts(id,"createdBy","routeId","targetDate","targetHour","predictedPassengers","predictedBookings","predictedOccupancy","demandLevel",confidence,algorithm,metrics,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *', [makeId('forecast'), req.user.id, routeId, targetDate, targetHour, predictedPassengers, predictedBookings, predictedOccupancy, demandLevel(predictedOccupancy), confidence, 'weighted_moving_average_v1', JSON.stringify(metrics), now()])).rows[0];
      await log(tx, req.user.id, 'FORECAST', 'demand_forecasts', saved.id, { routeId, targetDate, targetHour, algorithm: saved.algorithm });
      return saved;
    });
    res.status(201).json({ ...forecast, routeName: route.name, metrics: JSON.parse(forecast.metrics) });
  });

  staff('get', '/admin/analytics/forecasts', async (req, res) => {
    const rows = await all(db, `SELECT f.*,r.name AS "routeName" FROM demand_forecasts f JOIN routes r ON r.id=f."routeId" ORDER BY f."createdAt" DESC LIMIT 200`);
    res.json(rows.map(row => ({ ...row, metrics: JSON.parse(row.metrics || '{}') })));
  });

  staff('get', '/admin/analytics/recommendations', async (req, res) => {
    const { from, to } = range(req.query);
    const values = [`${from}T00:00:00Z`, `${new Date(Date.parse(`${to}T00:00:00Z`) + 86400000).toISOString()}`];
    const rows = await all(db, `WITH facts AS (${tripFacts} AND t."departureTime">=$1 AND t."departureTime"<$2 GROUP BY t.id,r.name,b."seatCount") SELECT "routeId","routeName",SUM(passengers)::int AS passengers,COUNT(*)::int AS trips,SUM(capacity)::int AS capacity,CASE WHEN SUM(capacity)>0 THEN SUM(passengers)*100.0/SUM(capacity) ELSE 0 END AS occupancy FROM facts GROUP BY "routeId","routeName" ORDER BY passengers DESC`, values);
    const recommendations = rows.filter(row => Number(row.trips) > 0).map(row => {
      const occupancy = Number(row.occupancy);
      if (occupancy >= 85) return { type: 'increase_frequency', routeId: row.routeId, routeName: row.routeName, occupancy, reason: `Tỷ lệ lấp đầy ${occupancy.toFixed(1)}% trong ${row.trips} chuyến; cân nhắc tăng tần suất giờ cao điểm.` };
      if (occupancy <= 30) return { type: 'optimize_schedule', routeId: row.routeId, routeName: row.routeName, occupancy, reason: `Tỷ lệ lấp đầy ${occupancy.toFixed(1)}% trong ${row.trips} chuyến; cân nhắc tối ưu khung giờ ít khách.` };
      return null;
    }).filter(Boolean);
    res.json({ range: { from, to }, recommendations, notice: 'Đây là khuyến nghị dựa trên dữ liệu; lịch chạy chỉ thay đổi sau khi quản lý xác nhận.' });
  });

  staff('get', '/admin/analytics/export', async (req, res) => {
    const format = req.query.format, type = req.query.type || 'analytics';
    if (!['xlsx', 'pdf'].includes(format) || !['analytics', 'occupancy', 'forecast'].includes(type)) fail(400, 'Loại hoặc định dạng xuất không được hỗ trợ.');
    const { from, to, routeId } = range(req.query);
    const values = [`${from}T00:00:00Z`, `${new Date(Date.parse(`${to}T00:00:00Z`) + 86400000).toISOString()}`];
    const routeFilter = routeId ? ' AND t."routeId"=$3' : '';
    if (routeId) values.push(routeId);
    const facts = `WITH facts AS (${tripFacts} AND t."departureTime">=$1 AND t."departureTime"<$2${routeFilter} GROUP BY t.id,r.name,b."seatCount")`;
    const daily = await all(db, `${facts} SELECT date,SUM(passengers)::int AS passengers,SUM(bookings)::int AS bookings,COUNT(*)::int AS trips,SUM(capacity)::int AS capacity,CASE WHEN SUM(capacity)>0 THEN SUM(passengers)*100.0/SUM(capacity) ELSE 0 END AS occupancy FROM facts GROUP BY date ORDER BY date`, values);
    const routes = await all(db, `${facts} SELECT "routeId","routeName",SUM(passengers)::int AS passengers,SUM(bookings)::int AS bookings,COUNT(*)::int AS trips,SUM(capacity)::int AS capacity,CASE WHEN SUM(capacity)>0 THEN SUM(passengers)*100.0/SUM(capacity) ELSE 0 END AS occupancy FROM facts GROUP BY "routeId","routeName" ORDER BY passengers DESC`, values);
    const hours = await all(db, `${facts} SELECT hour,SUM(passengers)::int AS passengers,SUM(bookings)::int AS bookings,COUNT(*)::int AS trips FROM facts GROUP BY hour ORDER BY hour`, values);
    const forecastValues = [`${from}`, `${to}`, ...(routeId ? [routeId] : [])];
    const forecasts = type === 'forecast' ? await all(db, `SELECT f."targetDate",f."targetHour",r.name AS "routeName",f."predictedPassengers",f."predictedBookings",f."predictedOccupancy",f."demandLevel",f.confidence,f.algorithm FROM demand_forecasts f JOIN routes r ON r.id=f."routeId" WHERE f."targetDate">=$1 AND f."targetDate"<=$2${routeId ? ' AND f."routeId"=$3' : ''} ORDER BY f."targetDate",f."targetHour"`, forecastValues) : [];
    await log(db, req.user.id, 'EXPORT', 'analytics', `${from}:${to}`, { format, type, routeId });
    if (format === 'xlsx') {
      const workbook = new ExcelJS.Workbook(); workbook.creator = 'SmartBus';
      const addSheet = (name, rows, columns) => { const sheet = workbook.addWorksheet(name); sheet.columns = columns; for (const row of rows) sheet.addRow(row); sheet.views = [{ state: 'frozen', ySplit: 1 }]; };
      if (type === 'forecast') addSheet('Dự báo', forecasts, [{ header: 'Ngày', key: 'targetDate', width: 16 }, { header: 'Giờ', key: 'targetHour', width: 12 }, { header: 'Tuyến', key: 'routeName', width: 32 }, { header: 'Khách dự báo', key: 'predictedPassengers', width: 18 }, { header: 'Booking dự báo', key: 'predictedBookings', width: 18 }, { header: 'Lấp đầy (%)', key: 'predictedOccupancy', width: 16 }, { header: 'Mức nhu cầu', key: 'demandLevel', width: 18 }, { header: 'Tin cậy', key: 'confidence', width: 14 }, { header: 'Thuật toán', key: 'algorithm', width: 30 }]);
      else {
        if (type === 'analytics') addSheet('Mật độ hành khách', daily, [{ header: 'Ngày', key: 'date', width: 16 }, { header: 'Hành khách', key: 'passengers', width: 16 }, { header: 'Đơn đặt', key: 'bookings', width: 14 }, { header: 'Chuyến', key: 'trips', width: 14 }]);
        addSheet('Lấp đầy theo ngày', daily, [{ header: 'Ngày', key: 'date', width: 16 }, { header: 'Hành khách', key: 'passengers', width: 16 }, { header: 'Sức chứa', key: 'capacity', width: 16 }, { header: 'Lấp đầy (%)', key: 'occupancy', width: 16 }]);
        addSheet('Theo tuyến', routes, [{ header: 'Tuyến', key: 'routeName', width: 32 }, { header: 'Hành khách', key: 'passengers', width: 16 }, { header: 'Đơn đặt', key: 'bookings', width: 14 }, { header: 'Chuyến', key: 'trips', width: 14 }, { header: 'Lấp đầy (%)', key: 'occupancy', width: 16 }]);
        if (type === 'analytics') addSheet('Theo giờ', hours, [{ header: 'Giờ', key: 'hour', width: 12 }, { header: 'Hành khách', key: 'passengers', width: 16 }, { header: 'Đơn đặt', key: 'bookings', width: 14 }, { header: 'Chuyến', key: 'trips', width: 14 }]);
      }
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="smartbus-${type}-${from}.xlsx"`);
      res.send(Buffer.from(await workbook.xlsx.writeBuffer())); return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="smartbus-${type}-${from}.pdf"`);
    const pdf = new PDFDocument({ margin: 44, size: 'A4' });
    const fontPath = ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/Library/Fonts/Arial.ttf'].find(existsSync);
    if (fontPath) pdf.font(fontPath);
    pdf.pipe(res);
    pdf.fontSize(17).text(type === 'forecast' ? 'DỰ BÁO NHU CẦU SMARTBUS' : type === 'occupancy' ? 'BÁO CÁO LẤP ĐẦY SMARTBUS' : 'PHÂN TÍCH NHU CẦU SMARTBUS');
    pdf.moveDown().fontSize(9).text(`Khoảng dữ liệu: ${from} đến ${to}`);
    const rows = type === 'forecast' ? forecasts.map(row => `${row.targetDate} ${row.targetHour}:00 · ${row.routeName} · ${Number(row.predictedPassengers).toFixed(1)} khách · ${Number(row.predictedOccupancy).toFixed(1)}% · ${row.demandLevel} · tin cậy ${Math.round(Number(row.confidence) * 100)}%`) : [...routes.map(row => `${row.routeName} · ${row.passengers} khách · ${row.trips} chuyến · lấp đầy ${Number(row.occupancy).toFixed(1)}%`), ...daily.map(row => `${row.date} · ${row.passengers} khách · ${row.trips} chuyến · lấp đầy ${Number(row.occupancy).toFixed(1)}%`)];
    pdf.moveDown().fontSize(9);
    if (!rows.length) pdf.text('Không có dữ liệu trong khoảng đã chọn.');
    for (const row of rows) pdf.text(row);
    pdf.end();
  });
}