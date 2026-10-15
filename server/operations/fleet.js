import { all, one, insert, update, rowById, required, integer, identifier, makeId, coordinate, timestamp, choice, now, fail, log, notify, joinedTrip, tripSelect } from './helpers.js';

const activeReservations = `status IN ('paid','checked_in') OR (status='held' AND "holdExpiresAt">$2)`;

async function saveStops(tx, routeId, stopIds) {
  if (!Array.isArray(stopIds) || stopIds.length < 2 || stopIds.length > 100) fail(400, 'Tuyến phải có từ 2 đến 100 trạm dừng.');
  const ids = stopIds.map(value => identifier(value, 'Trạm dừng'));
  if (new Set(ids).size !== ids.length) fail(400, 'Trạm dừng không được trùng lặp.');
  const existing = await all(tx, 'SELECT id FROM stops WHERE id=ANY($1::text[])', [ids]);
  if (existing.length !== ids.length) fail(400, 'Có trạm dừng không tồn tại.');
  await tx.query('DELETE FROM route_stops WHERE "routeId"=$1', [routeId]);
  for (let index = 0; index < ids.length; index++) await insert(tx, 'route_stops', { routeId, stopId: ids[index], stopOrder: index });
  return ids;
}

async function validateAssignment(tx, data, exceptId = '') {
  const route = await rowById(tx, 'routes', identifier(data.routeId, 'Tuyến xe'));
  const bus = await rowById(tx, 'buses', identifier(data.busId, 'Xe'));
  const driver = await rowById(tx, 'users', identifier(data.driverId, 'Tài xế'));
  if (!route.active) fail(400, 'Tuyến xe đã ngừng khai thác.');
  if (bus.status !== 'active') fail(400, 'Xe đang bảo dưỡng, không thể phân công.');
  if (driver.role !== 'driver' || !driver.active) fail(400, 'Tài xế không hợp lệ hoặc đã bị khóa.');
  const departureTime = timestamp(data.departureTime, 'Giờ khởi hành');
  if (Date.parse(departureTime) <= Date.now()) fail(400, 'Giờ khởi hành phải ở tương lai.');
  const arrivalTime = new Date(Date.parse(departureTime) + route.durationMinutes * 60000).toISOString();
  const conflict = await one(tx, `SELECT id, "busId", "driverId" FROM trips WHERE id<>$1 AND status IN ('scheduled','running')
    AND ("busId"=$2 OR "driverId"=$3) AND "departureTime"<$5 AND "arrivalTime">$4 LIMIT 1`, [exceptId, bus.id, driver.id, departureTime, arrivalTime]);
  if (conflict) fail(409, `Trùng lịch ${conflict.busId === bus.id ? 'xe' : 'tài xế'} với chuyến #${conflict.id}.`);
  return { routeId: route.id, busId: bus.id, driverId: driver.id, departureTime, arrivalTime };
}

async function assignment(tx, trip) {
  await tx.query(`INSERT INTO assignments (id,"tripId","busId","driverId","createdAt") VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT ("tripId") DO UPDATE SET "busId"=EXCLUDED."busId", "driverId"=EXCLUDED."driverId"`, [makeId('assignment'), trip.id, trip.busId, trip.driverId, now()]);
}

async function cancelTrip(tx, trip) {
  const tickets = await all(tx, `SELECT * FROM tickets WHERE "tripId"=$1 AND status IN ('held','paid','checked_in') FOR UPDATE`, [trip.id]);
  for (const ticket of tickets) {
    const refund = ticket.status !== 'held';
    await update(tx, 'tickets', ticket.id, { status: 'cancelled', refundStatus: refund ? 'refunded' : 'none' });
    await tx.query(`UPDATE seat_holds SET status='released' WHERE "ticketId"=$1 AND status='active'`, [ticket.id]);
    if (ticket.bookingId) await update(tx, 'bookings', ticket.bookingId, { status: 'cancelled' });
    if (refund) {
      await insert(tx, 'refunds', { ticketId: ticket.id, amount: ticket.price, status: 'refunded', createdAt: now() });
      await tx.query(`UPDATE payments SET status='refunded' WHERE "ticketId"=$1 AND status='paid'`, [ticket.id]);
    }
    await notify(tx, ticket.userId, 'Chuyến xe đã hủy', `Chuyến #${trip.id} đã hủy. ${refund ? `Đã hoàn ${Number(ticket.price).toLocaleString('vi-VN')} đ vào giao dịch mô phỏng.` : 'Ghế đang giữ đã được giải phóng.'}`);
  }
}

export function registerFleet({ db, staff }) {
  staff('get', '/admin/routes', async (_req, res) => {
    const routes = await all(db, `SELECT r.*, COALESCE((SELECT json_agg(rs."stopId" ORDER BY rs."stopOrder") FROM route_stops rs WHERE rs."routeId"=r.id),'[]'::json) AS stops FROM routes r ORDER BY r.id`);
    res.json(routes);
  });
  for (const method of ['post', 'patch']) staff(method, `/admin/routes${method === 'patch' ? '/:id' : ''}`, async (req, res) => {
    const body = req.body;
    const distanceKm = Number(body.distanceKm);
    if (!Number.isFinite(distanceKm) || distanceKm < 0 || distanceKm > 2000) fail(400, 'Quãng đường không hợp lệ.');
    const data = { code: required(body.code, 'Mã tuyến', 30).toUpperCase(), name: required(body.name, 'Tên tuyến'), origin: required(body.origin, 'Điểm đi'), destination: required(body.destination, 'Điểm đến'), distanceKm, price: integer(body.price, 'Giá vé', 0, 10000000), durationMinutes: integer(body.durationMinutes, 'Thời gian di chuyển', 1, 1440) };
    if (data.origin === data.destination) fail(400, 'Điểm đi và điểm đến phải khác nhau.');
    const route = await db.transaction(async tx => {
      const existing = method === 'patch' ? await rowById(tx, 'routes', req.params.id) : null;
      const saved = existing ? await update(tx, 'routes', existing.id, data) : await insert(tx, 'routes', { ...data, active: 1 });
      saved.stops = await saveStops(tx, saved.id, body.stopIds);
      await log(tx, req.user.id, existing ? 'route.update' : 'route.create', 'routes', saved.id, data);
      return saved;
    });
    res.status(method === 'post' ? 201 : 200).json(route);
  });
  staff('delete', '/admin/routes/:id', async (req, res) => {
    await db.transaction(async tx => {
      const route = await rowById(tx, 'routes', req.params.id);
      await update(tx, 'routes', route.id, { active: 0 });
      await log(tx, req.user.id, 'route.deactivate', 'routes', route.id);
    });
    res.json({ ok: true });
  });
  staff('get', '/admin/stops', async (_req, res) => res.json(await all(db, 'SELECT * FROM stops ORDER BY id')));
  for (const method of ['post', 'patch']) staff(method, `/admin/stops${method === 'patch' ? '/:id' : ''}`, async (req, res) => {
    const data = { name: required(req.body.name, 'Tên trạm'), address: required(req.body.address, 'Địa chỉ', 500), lat: coordinate(req.body.lat, 'Vĩ độ', 90), lng: coordinate(req.body.lng, 'Kinh độ', 180) };
    const stop = await db.transaction(async tx => {
      const existing = method === 'patch' ? await rowById(tx, 'stops', req.params.id) : null;
      const saved = existing ? await update(tx, 'stops', existing.id, data) : await insert(tx, 'stops', data);
      await log(tx, req.user.id, `stop.${existing ? 'update' : 'create'}`, 'stops', saved.id, data);
      return saved;
    });
    res.status(method === 'post' ? 201 : 200).json(stop);
  });
  staff('delete', '/admin/stops/:id', async (req, res) => {
    await db.transaction(async tx => {
      const stop = await rowById(tx, 'stops', req.params.id);
      if (await one(tx, 'SELECT 1 FROM route_stops WHERE "stopId"=$1 LIMIT 1', [stop.id])) fail(409, 'Không thể xóa trạm đang thuộc tuyến xe.');
      await tx.query('DELETE FROM stops WHERE id=$1', [stop.id]);
      await log(tx, req.user.id, 'stop.delete', 'stops', stop.id);
    });
    res.json({ ok: true });
  });
  staff('get', '/admin/buses', async (_req, res) => res.json(await all(db, 'SELECT * FROM buses ORDER BY id')));
  for (const method of ['post', 'patch']) staff(method, `/admin/buses${method === 'patch' ? '/:id' : ''}`, async (req, res) => {
    const data = { code: required(req.body.code, 'Mã xe', 40).toUpperCase(), type: required(req.body.type, 'Loại xe', 80), plate: required(req.body.plate, 'Biển số', 30).toUpperCase(), name: required(req.body.name, 'Tên xe'), seatCount: integer(req.body.seatCount, 'Số ghế', 1, 100), status: choice(req.body.status, ['active', 'maintenance', 'inactive'], 'Trạng thái xe') };
    const bus = await db.transaction(async tx => {
      await tx.query('LOCK TABLE trips IN SHARE ROW EXCLUSIVE MODE');
      const existing = method === 'patch' ? await rowById(tx, 'buses', req.params.id) : null;
      if (existing && existing.seatCount !== data.seatCount && await one(tx, `SELECT 1 FROM tickets WHERE "tripId" IN (SELECT id FROM trips WHERE "busId"=$1) AND (${activeReservations}) LIMIT 1`, [existing.id, now()])) fail(409, 'Không thể đổi sức chứa xe đã có hành khách đặt chỗ.');
      if (existing && data.status !== 'active' && await one(tx, `SELECT 1 FROM trips WHERE "busId"=$1 AND status IN ('scheduled','running') AND "arrivalTime">$2 LIMIT 1`, [existing.id, now()])) fail(409, 'Cần phân công xe khác cho các chuyến sắp chạy trước khi ngừng hoạt động.');
      const saved = existing ? await update(tx, 'buses', existing.id, data) : await insert(tx, 'buses', data);
      await tx.query('DELETE FROM seats WHERE "busId"=$1 AND number>$2', [saved.id, data.seatCount]);
      for (let number = 1; number <= data.seatCount; number++) await tx.query('INSERT INTO seats (id,"busId",number) VALUES ($1,$2,$3) ON CONFLICT ("busId",number) DO NOTHING', [makeId('seat'), saved.id, number]);
      await log(tx, req.user.id, `bus.${existing ? 'update' : 'create'}`, 'buses', saved.id, data);
      return saved;
    });
    res.status(method === 'post' ? 201 : 200).json(bus);
  });
  staff('get', '/admin/trips', async (_req, res) => res.json(await all(db, `${tripSelect} ORDER BY t."departureTime" DESC`, [now()])));
  staff('post', '/admin/trips', async (req, res) => {
    const trip = await db.transaction(async tx => {
      await tx.query('LOCK TABLE trips IN SHARE ROW EXCLUSIVE MODE');
      const data = await validateAssignment(tx, req.body);
      const saved = await insert(tx, 'trips', { ...data, status: 'scheduled' });
      await assignment(tx, saved);
      await log(tx, req.user.id, 'trip.create', 'trips', saved.id, data);
      return joinedTrip(tx, saved.id);
    });
    res.status(201).json(trip);
  });
  staff('patch', '/admin/trips/:id', async (req, res) => {
    const trip = await db.transaction(async tx => {
      await tx.query('LOCK TABLE trips IN SHARE ROW EXCLUSIVE MODE');
      const existing = await rowById(tx, 'trips', req.params.id);
      if (['completed', 'cancelled'].includes(existing.status)) fail(409, 'Không thể sửa chuyến đã kết thúc hoặc đã hủy.');
      const hasAssignment = ['busId', 'driverId', 'departureTime'].some(key => Object.hasOwn(req.body, key));
      const changes = {};
      if (hasAssignment) {
        if (existing.status !== 'scheduled') fail(409, 'Chỉ được đổi phân công trước khi chuyến khởi hành.');
        Object.assign(changes, await validateAssignment(tx, { ...existing, ...req.body, routeId: existing.routeId }, existing.id));
        if (existing.busId !== changes.busId && await one(tx, `SELECT 1 FROM tickets WHERE "tripId"=$1 AND (${activeReservations}) LIMIT 1`, [existing.id, now()])) fail(409, 'Không thể đổi xe cho chuyến đã có hành khách đặt chỗ.');
      }
      if (req.body.status !== undefined) {
        changes.status = choice(req.body.status, ['scheduled', 'running', 'completed', 'cancelled'], 'Trạng thái chuyến');
        const allowed = { scheduled: ['scheduled', 'running', 'cancelled'], running: ['running', 'completed', 'cancelled'] };
        if (!allowed[existing.status]?.includes(changes.status)) fail(409, 'Không thể chuyển sang trạng thái này.');
        if (changes.status === 'cancelled') await cancelTrip(tx, existing);
      }
      if (!Object.keys(changes).length) fail(400, 'Chưa có thông tin cần cập nhật.');
      const saved = await update(tx, 'trips', existing.id, changes);
      await assignment(tx, saved);
      if (changes.departureTime && changes.departureTime !== existing.departureTime) {
        const users = await all(tx, `SELECT DISTINCT "userId" FROM tickets WHERE "tripId"=$1 AND status IN ('paid','checked_in','held')`, [saved.id]);
        for (const user of users) await notify(tx, user.userId, 'Thay đổi giờ khởi hành', `Chuyến #${saved.id} có giờ khởi hành mới: ${new Date(saved.departureTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}.`);
      }
      await log(tx, req.user.id, 'trip.update', 'trips', saved.id, changes);
      return joinedTrip(tx, saved.id);
    });
    res.json(trip);
  });
  staff('get', '/admin/schedules', async (_req, res) => res.json(await all(db, 'SELECT * FROM schedules ORDER BY id DESC')));
  staff('post', '/admin/schedules', async (req, res) => {
    const b = req.body;
    for (const field of ['startDate', 'endDate']) if (!/^\d{4}-\d{2}-\d{2}$/.test(b[field] || '') || !Number.isFinite(Date.parse(`${b[field]}T00:00:00+07:00`))) fail(400, 'Ngày lập lịch không hợp lệ.');
    for (const field of ['firstDeparture', 'lastDeparture']) if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(b[field] || '')) fail(400, 'Giờ lập lịch không hợp lệ.');
    const start = Date.parse(`${b.startDate}T00:00:00+07:00`), end = Date.parse(`${b.endDate}T00:00:00+07:00`);
    const first = Number(b.firstDeparture.slice(0, 2)) * 60 + Number(b.firstDeparture.slice(3)), last = Number(b.lastDeparture.slice(0, 2)) * 60 + Number(b.lastDeparture.slice(3));
    const frequencyMinutes = integer(b.frequencyMinutes, 'Tần suất', 1, 1440);
    if (end < start || end - start > 31 * 86400000 || last < first) fail(400, 'Lịch tối đa 32 ngày, ngày và giờ kết thúc phải sau thời điểm bắt đầu.');
    const count = (Math.floor((end - start) / 86400000) + 1) * (Math.floor((last - first) / frequencyMinutes) + 1);
    if (count > 500) fail(400, 'Mỗi lần tạo tối đa 500 chuyến.');
    const result = await db.transaction(async tx => {
      await tx.query('LOCK TABLE trips IN SHARE ROW EXCLUSIVE MODE');
      let created = 0;
      for (let day = start; day <= end; day += 86400000) for (let minute = first; minute <= last; minute += frequencyMinutes) {
        const data = await validateAssignment(tx, { ...b, departureTime: new Date(day + minute * 60000).toISOString() });
        const trip = await insert(tx, 'trips', { ...data, status: 'scheduled' });
        await assignment(tx, trip);
        created++;
      }
      const schedule = await insert(tx, 'schedules', { routeId: b.routeId, busId: b.busId, driverId: b.driverId, startDate: b.startDate, endDate: b.endDate, firstDeparture: b.firstDeparture, lastDeparture: b.lastDeparture, frequencyMinutes, createdAt: now() });
      await log(tx, req.user.id, 'schedule.create', 'schedules', schedule.id, { created });
      return { created, scheduleId: schedule.id };
    });
    res.status(201).json(result);
  });
}
