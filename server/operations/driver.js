import { all, rowById, required, identifier, coordinate, choice, now, fail, log, notify, makeId } from './helpers.js';

function localDate(value) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export function registerDriver({ db, crew }) {
  crew('get', '/driver/trips', async (req, res) => {
    const filters = req.user.role === 'driver' ? 'WHERE t."driverId"=$2' : '';
    res.json(await all(db, `SELECT t.*,r.name AS "routeName",r.code AS "routeCode",r.origin,r.destination,b.plate,b."seatCount",u.name AS "driverName",b."seatCount"-(SELECT COUNT(*)::int FROM tickets k WHERE k."tripId"=t.id AND (k.status IN ('paid','checked_in') OR (k.status='held' AND k."holdExpiresAt">$1))) AS "availableSeats" FROM trips t JOIN routes r ON r.id=t."routeId" JOIN buses b ON b.id=t."busId" JOIN users u ON u.id=t."driverId" ${filters} ORDER BY t."departureTime" DESC`, req.user.role === 'driver' ? [now(), req.user.id] : [now()]));
  });

  crew('post', '/driver/scan', async (req, res) => {
    const code = required(req.body.code, 'Mã vé', 200);
    const tripId = identifier(req.body.tripId, 'Chuyến xe');
    const result = await db.transaction(async tx => {
      const trip = (await tx.query('SELECT * FROM trips WHERE id=$1 FOR UPDATE', [tripId])).rows[0];
      if (!trip) return { status: 404, message: 'Không tìm thấy chuyến xe.' };
      if (req.user.role === 'driver' && trip.driverId !== req.user.id) return { status: 403, message: 'Bạn không được phân công chuyến xe này.' };
      const ticket = (await tx.query('SELECT * FROM tickets WHERE code=$1 FOR UPDATE', [code])).rows[0];
      let status = 'not_found', message = 'Mã vé không tồn tại.';
      if (ticket) {
        if (ticket.tripId !== tripId) { status = 'wrong_trip'; message = 'Vé không thuộc chuyến xe đang soát.'; }
        else if (ticket.status === 'checked_in') { status = 'already_used'; message = 'Vé này đã được sử dụng trước đó.'; }
        else if (ticket.status !== 'paid') { status = ticket.status; message = ticket.status === 'cancelled' ? 'Vé đã bị hủy.' : ticket.status === 'expired' ? 'Vé đã hết hạn.' : 'Vé chưa được thanh toán.'; }
        else if (trip.status === 'cancelled' || trip.status === 'completed') { status = 'trip_closed'; message = 'Chuyến xe đã kết thúc hoặc bị hủy.'; }
        else if (localDate(now()) !== localDate(trip.departureTime)) { status = 'wrong_date'; message = 'Chỉ có thể soát vé đúng ngày khởi hành.'; }
        else {
          await tx.query("UPDATE tickets SET status='checked_in' WHERE id=$1 AND status='paid'", [ticket.id]);
          status = 'success'; message = `Vé hợp lệ. Ghế ${ticket.seat} · ${ticket.code}.`;
        }
      }
      await tx.query('INSERT INTO ticket_scans(id,"ticketId","tripId","driverId","scannedCode",result,"scannedAt") VALUES($1,$2,$3,$4,$5,$6,$7)', [makeId('scan'), ticket?.id || null, tripId, req.user.id, code, status, now()]);
      await log(tx, req.user.id, 'TICKET_SCAN', 'tickets', ticket?.id || code, { tripId, result: status });
      return { status: status === 'success' ? 200 : status === 'not_found' ? 404 : 409, message, ticket: status === 'success' ? { id: ticket.id, code: ticket.code, seat: ticket.seat, status: 'checked_in' } : undefined };
    });
    if (result.status !== 200) return res.status(result.status).json({ message: result.message });
    res.json({ ticket: result.ticket, message: result.message });
  });

  crew('post', '/driver/trips/:id/location', async (req, res) => {
    const lat = coordinate(req.body.lat, 'Vĩ độ', 90), lng = coordinate(req.body.lng, 'Kinh độ', 180);
    await db.transaction(async tx => {
      const trip = (await tx.query('SELECT * FROM trips WHERE id=$1 FOR UPDATE', [identifier(req.params.id, 'Chuyến xe')])).rows[0];
      if (!trip) fail(404, 'Không tìm thấy chuyến xe.');
      if (req.user.role === 'driver' && trip.driverId !== req.user.id) fail(403, 'Bạn không được phân công chuyến xe này.');
      if (trip.status !== 'running') fail(409, 'Chỉ cập nhật GPS khi chuyến xe đang di chuyển.');
      const recordedAt = now();
      await tx.query('UPDATE trips SET lat=$1,lng=$2,"locationUpdatedAt"=$3,"locationSource"=$4 WHERE id=$5', [lat, lng, recordedAt, 'gps', trip.id]);
      await tx.query('INSERT INTO vehicle_locations(id,"tripId",lat,lng,source,"recordedAt") VALUES($1,$2,$3,$4,$5,$6)', [makeId('loc'), trip.id, lat, lng, 'gps', recordedAt]);
      const stops = await all(tx, 'SELECT s.id,s.name,s.lat,s.lng FROM route_stops rs JOIN stops s ON s.id=rs."stopId" WHERE rs."routeId"=$1 ORDER BY rs."stopOrder"', [trip.routeId]);
      const nearby = stops.filter(stop => {
        const dy = (Number(stop.lat) - lat) * 111;
        const dx = (Number(stop.lng) - lng) * 111 * Math.cos(lat * Math.PI / 180);
        return Math.hypot(dx, dy) <= 1.2;
      });
      for (const stop of nearby) {
        const passengers = await all(tx, "SELECT DISTINCT \"userId\" FROM tickets WHERE \"tripId\"=$1 AND status IN ('paid','checked_in')", [trip.id]);
        for (const passenger of passengers) {
          const key = `stop:${trip.id}:${stop.id}:${passenger.userId}`;
          await tx.query('INSERT INTO notifications(id,"userId","tripId",title,message,read,"createdAt","dedupeKey") VALUES($1,$2,$3,$4,$5,0,$6,$7) ON CONFLICT DO NOTHING', [makeId('notice'), passenger.userId, trip.id, 'Xe sắp đến trạm', `Xe buýt đang ở gần trạm ${stop.name}.`, recordedAt, key]);
        }
      }
    });
    res.json({ ok: true, locationUpdatedAt: now() });
  });

  crew('post', '/driver/trips/:id/status', async (req, res) => {
    const status = choice(req.body.status, ['running', 'completed'], 'Trạng thái chuyến');
    const trip = await db.transaction(async tx => {
      const current = await rowById(tx, 'trips', identifier(req.params.id, 'Chuyến xe'));
      if (req.user.role === 'driver' && current.driverId !== req.user.id) fail(403, 'Bạn không được phân công chuyến xe này.');
      if ((status === 'running' && current.status !== 'scheduled') || (status === 'completed' && current.status !== 'running')) fail(409, 'Trạng thái chuyến không thể chuyển theo yêu cầu.');
      if (status === 'running' && localDate(now()) !== localDate(current.departureTime)) fail(409, 'Chỉ bắt đầu chuyến đúng ngày khởi hành.');
      const saved = (await tx.query('UPDATE trips SET status=$1 WHERE id=$2 RETURNING *', [status, current.id])).rows[0];
      await log(tx, req.user.id, 'trip.status', 'trips', saved.id, { status });
      return saved;
    });
    res.json(trip);
  });

  crew('post', '/driver/incidents', async (req, res) => {
    const tripId = identifier(req.body.tripId, 'Chuyến xe');
    const type = choice(req.body.type, ['traffic', 'breakdown', 'delay', 'incident', 'other'], 'Loại sự cố');
    const description = required(req.body.description, 'Nội dung sự cố', 1000);
    const incident = await db.transaction(async tx => {
      const trip = await rowById(tx, 'trips', tripId);
      if (req.user.role === 'driver' && trip.driverId !== req.user.id) fail(403, 'Bạn không được phân công chuyến xe này.');
      const createdAt = now();
      const saved = (await tx.query('INSERT INTO incidents(id,"tripId","driverId",type,description,"createdAt") VALUES($1,$2,$3,$4,$5,$6) RETURNING *', [makeId('incident'), tripId, req.user.id, type, description, createdAt])).rows[0];
      const passengers = await all(tx, "SELECT DISTINCT \"userId\" FROM tickets WHERE \"tripId\"=$1 AND status IN ('paid','checked_in')", [tripId]);
      for (const passenger of passengers) await notify(tx, passenger.userId, 'Cập nhật tình hình chuyến xe', description, tripId);
      await log(tx, req.user.id, 'incident.create', 'incidents', saved.id, { type, tripId });
      return saved;
    });
    res.status(201).json(incident);
  });
}