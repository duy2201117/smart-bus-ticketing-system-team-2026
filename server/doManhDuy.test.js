import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './db.js';
import { seedDatabase } from './seed.js';
import { createApp } from './app.js';

async function startServer(app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function request(baseUrl, path, { cookie, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, data };
}

async function login(baseUrl, email) {
  const { response, data } = await request(baseUrl, '/auth/login', {
    method: 'POST',
    body: { email, password: 'SmartBus@123' },
  });
  assert.equal(response.status, 200, data.message);
  return response.headers.get('set-cookie').split(';', 1)[0];
}

test('Đỗ Mạnh Duy backend scope is covered across the official 4-Sprint assignment', async () => {
  const db = await createDatabase(':memory:');
  await seedDatabase(db, { historyDays: 7 });
  const app = await createApp({ db, demoMode: true });
  const { server, baseUrl } = await startServer(app);

  try {
    const passengerCookie = await login(baseUrl, 'passenger@smartbus.demo');
    const adminCookie = await login(baseUrl, 'admin@smartbus.demo');
    const managerCookie = await login(baseUrl, 'manager@smartbus.demo');
    const driverCookie = await login(baseUrl, 'driver@smartbus.demo');

    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(Date.now() + 86400000));

    // Sprint 1 / US02: API trạng thái ghế và danh sách ghế còn trống.
    const trips = await request(baseUrl, `/trips?date=${date}`);
    assert.equal(trips.response.status, 200);
    const trip = trips.data.find(item => item.status === 'scheduled' && item.availableSeats > 2);
    assert.ok(trip, 'Cần một chuyến tương lai còn ghế để kiểm thử scope Đỗ Mạnh Duy.');
    const seatMap = await request(baseUrl, `/trips/${trip.id}`);
    assert.equal(seatMap.response.status, 200);
    assert.ok(Array.isArray(seatMap.data.seats));
    assert.ok(seatMap.data.seats.some(item => item.status === 'available'));

    // Sprint 1 / US06: thanh toán sandbox + Webhook ký số, idempotent callback.
    const paymentSeat = seatMap.data.seats.find(item => item.status === 'available').seat;
    const paymentHold = await request(baseUrl, '/holds', {
      method: 'POST', cookie: passengerCookie, body: { tripId: trip.id, seat: paymentSeat },
    });
    assert.equal(paymentHold.response.status, 201, paymentHold.data.message);
    const pending = await request(baseUrl, '/payments', {
      method: 'POST', cookie: passengerCookie,
      body: { ticketId: paymentHold.data.id, method: 'momo', outcome: 'pending', idempotencyKey: `dmd-pay-${paymentHold.data.id}` },
    });
    assert.equal(pending.response.status, 200, pending.data.message);
    assert.ok(pending.data.sandboxCallback?.successSignature);
    const callbackBody = { reference: pending.data.payment.reference, status: 'paid' };
    const callback = await request(baseUrl, '/payments/webhook/momo', {
      method: 'POST',
      headers: { 'x-smartbus-signature': pending.data.sandboxCallback.successSignature },
      body: callbackBody,
    });
    assert.equal(callback.response.status, 200, callback.data.message);
    assert.equal(callback.data.ticket.status, 'paid');
    const callbackReplay = await request(baseUrl, '/payments/webhook/momo', {
      method: 'POST',
      headers: { 'x-smartbus-signature': pending.data.sandboxCallback.successSignature },
      body: callbackBody,
    });
    assert.equal(callbackReplay.response.status, 200);
    assert.equal(callbackReplay.data.idempotent, true);

    // Sprint 2 / US08: hoàn tiền hợp lệ cập nhật cả refund, payment và ticket.
    const afterPayment = await request(baseUrl, `/trips/${trip.id}`);
    const refundSeat = afterPayment.data.seats.find(item => item.status === 'available')?.seat;
    assert.ok(refundSeat);
    const refundHold = await request(baseUrl, '/holds', {
      method: 'POST', cookie: passengerCookie, body: { tripId: trip.id, seat: refundSeat },
    });
    const refundPayment = await request(baseUrl, '/payments', {
      method: 'POST', cookie: passengerCookie,
      body: { ticketId: refundHold.data.id, method: 'vnpay', outcome: 'success', idempotencyKey: `dmd-refund-${refundHold.data.id}` },
    });
    assert.equal(refundPayment.data.ticket.status, 'paid');
    const cancelled = await request(baseUrl, `/tickets/${refundHold.data.id}/cancel`, {
      method: 'POST', cookie: passengerCookie, body: { reason: 'Kiểm thử scope Đỗ Mạnh Duy' },
    });
    assert.equal(cancelled.response.status, 200, cancelled.data.message);
    assert.equal(cancelled.data.refund.status, 'completed');
    assert.equal((await db.query('SELECT status FROM payments WHERE "ticketId"=$1 ORDER BY "createdAt" DESC LIMIT 1', [refundHold.data.id])).rows[0].status, 'refunded');

    // Sprint 2 / US11: tài xế báo sự cố/trễ chuyến và hành khách nhận thông báo.
    const simulationStart = new Date(Date.now() - 10000).toISOString();
    const simulationEnd = new Date(Date.now() + 2 * 3600000).toISOString();
    await db.query('UPDATE trips SET status=$1,"driverId"=$2,"departureTime"=$3,"arrivalTime"=$4 WHERE id=$5', ['scheduled', 'user_driver', simulationStart, simulationEnd, trip.id]);
    await db.query('UPDATE assignments SET "driverId"=$1 WHERE "tripId"=$2', ['user_driver', trip.id]);
    const incident = await request(baseUrl, '/driver/incidents', {
      method: 'POST', cookie: driverCookie,
      body: { tripId: trip.id, type: 'delay', description: 'Chuyến xe chậm do ùn tắc kiểm thử.' },
    });
    assert.equal(incident.response.status, 201, incident.data.message);
    const incidentNotice = (await db.query('SELECT * FROM notifications WHERE "tripId"=$1 AND title=$2 ORDER BY "createdAt" DESC LIMIT 1', [trip.id, 'Cập nhật tình hình chuyến xe'])).rows[0];
    assert.ok(incidentNotice);

    // Sprint 3 / US13: lịch trình/tần suất và kiểm tra xung đột.
    const stopList = await request(baseUrl, '/admin/stops', { cookie: managerCookie });
    const routeCode = `DMD-${Date.now()}`;
    const createdRoute = await request(baseUrl, '/admin/routes', {
      method: 'POST', cookie: managerCookie,
      body: {
        code: routeCode, name: 'Tuyến scope Đỗ Mạnh Duy', origin: 'Điểm A', destination: 'Điểm B',
        distanceKm: 8, price: 25000, durationMinutes: 20,
        stopIds: stopList.data.slice(0, 2).map(stop => stop.id),
      },
    });
    assert.equal(createdRoute.response.status, 201, createdRoute.data.message);
    const bus = await request(baseUrl, '/admin/buses', {
      method: 'POST', cookie: managerCookie,
      body: { code: `DMD-BUS-${Date.now()}`, type: 'minibus', plate: `DMD-${Date.now()}`, name: 'Xe scope DMD', seatCount: 8, status: 'active' },
    });
    assert.equal(bus.response.status, 201, bus.data.message);
    const scheduleDriver = await request(baseUrl, '/admin/users', {
      method: 'POST', cookie: adminCookie,
      body: { name: 'Tài xế scope DMD', email: `dmd-driver-${Date.now()}@smartbus.demo`, password: 'SmartBus@123', role: 'driver' },
    });
    assert.equal(scheduleDriver.response.status, 201, scheduleDriver.data.message);
    const schedule = await request(baseUrl, '/admin/schedules', {
      method: 'POST', cookie: managerCookie,
      body: {
        routeId: createdRoute.data.id, busId: bus.data.id, driverId: scheduleDriver.data.id,
        startDate: date, endDate: date, firstDeparture: '11:15', lastDeparture: '11:15', frequencyMinutes: 120,
      },
    });
    assert.equal(schedule.response.status, 201, schedule.data.message);
    assert.equal(schedule.data.created, 1);
    const overlappingTrip = await request(baseUrl, '/admin/trips', {
      method: 'POST', cookie: managerCookie,
      body: {
        routeId: createdRoute.data.id, busId: bus.data.id, driverId: scheduleDriver.data.id,
        departureTime: new Date(`${date}T11:20:00+07:00`).toISOString(),
      },
    });
    assert.equal(overlappingTrip.response.status, 409);

    // Sprint 3 / US23: Audit Log + bộ lọc + quyền Admin.
    const auditDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    const auditList = await request(baseUrl, `/admin/audit?from=${auditDate}&to=${auditDate}&search=user_admin`, { cookie: adminCookie });
    assert.equal(auditList.response.status, 200, auditList.data.message);
    assert.ok(Array.isArray(auditList.data));
    const deniedAudit = await request(baseUrl, '/admin/audit', { cookie: passengerCookie });
    assert.equal(deniedAudit.response.status, 403);

    // Sprint 4 / US16: vé tháng - đăng ký, idempotency và gia hạn.
    const routeList = await request(baseUrl, '/routes');
    const passKey = `dmd-pass-${Date.now()}`;
    const pass = await request(baseUrl, '/passes', {
      method: 'POST', cookie: passengerCookie,
      body: { routeId: routeList.data[0].id, idempotencyKey: passKey },
    });
    assert.equal(pass.response.status, 201, pass.data.message);
    const passReplay = await request(baseUrl, '/passes', {
      method: 'POST', cookie: passengerCookie,
      body: { routeId: routeList.data[0].id, idempotencyKey: passKey },
    });
    assert.equal(passReplay.data.id, pass.data.id);
    const renewed = await request(baseUrl, `/passes/${pass.data.id}/renew`, {
      method: 'POST', cookie: passengerCookie, body: { idempotencyKey: `dmd-renew-${Date.now()}` },
    });
    assert.equal(renewed.response.status, 200, renewed.data.message);
    assert.ok(Date.parse(renewed.data.endDate) > Date.parse(pass.data.endDate));

    // Sprint 4 / US24: phản ánh/đánh giá gắn chuyến và cập nhật trạng thái xử lý.
    const reviewTicket = (await db.query('SELECT * FROM tickets WHERE "userId"=$1 AND status=$2 LIMIT 1', ['user_passenger', 'checked_in'])).rows[0];
    assert.ok(reviewTicket);
    const feedback = await request(baseUrl, '/feedback', {
      method: 'POST', cookie: passengerCookie,
      body: { tripId: reviewTicket.tripId, rating: 5, message: 'Đánh giá scope Đỗ Mạnh Duy.' },
    });
    assert.equal(feedback.response.status, 201, feedback.data.message);
    const feedbackResolved = await request(baseUrl, `/admin/feedback/${feedback.data.id}`, {
      method: 'PATCH', cookie: managerCookie,
      body: { status: 'resolved', response: 'Đã xử lý đánh giá.' },
    });
    assert.equal(feedbackResolved.response.status, 200, feedbackResolved.data.message);
    assert.equal(feedbackResolved.data.status, 'resolved');

    const complaint = await request(baseUrl, '/complaints', {
      method: 'POST', cookie: passengerCookie,
      body: { category: 'Kiểm thử', tripId: reviewTicket.tripId, content: 'Phản ánh scope Đỗ Mạnh Duy.' },
    });
    assert.equal(complaint.response.status, 201, complaint.data.message);
    const complaintResolved = await request(baseUrl, `/admin/complaints/${complaint.data.id}`, {
      method: 'PATCH', cookie: managerCookie,
      body: { status: 'resolved', response: 'Đã xử lý phản ánh.' },
    });
    assert.equal(complaintResolved.response.status, 200, complaintResolved.data.message);
    assert.equal(complaintResolved.data.status, 'resolved');

    // Sprint 4 / US20: API tỷ lệ lấp đầy = ghế đã bán / tổng ghế, luôn trong 0..100%.
    const occupancy = await request(baseUrl, `/admin/analytics/occupancy-trends?from=${date}&to=${date}`, { cookie: managerCookie });
    assert.equal(occupancy.response.status, 200, occupancy.data.message);
    assert.ok(Array.isArray(occupancy.data));
    assert.ok(occupancy.data.every(row => Number(row.capacity) >= Number(row.passengers)));
    assert.ok(occupancy.data.every(row => Number(row.occupancy) >= 0 && Number(row.occupancy) <= 100));
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
});
