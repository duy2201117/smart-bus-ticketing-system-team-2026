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

function localDate(offsetDays = 0) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(Date.now() + offsetDays * 86400000));
}

test('official Nguyễn Hữu Dương backend scope is implemented end-to-end', async () => {
  const db = await createDatabase(':memory:');
  await seedDatabase(db, { historyDays: 30 });
  const app = await createApp({ db, demoMode: true });
  const { server, baseUrl } = await startServer(app);

  try {
    const passengerCookie = await login(baseUrl, 'passenger@smartbus.demo');
    const adminCookie = await login(baseUrl, 'admin@smartbus.demo');
    const managerCookie = await login(baseUrl, 'manager@smartbus.demo');
    const driverCookie = await login(baseUrl, 'driver@smartbus.demo');

    // Sprint 1 / US01: route + timetable search API with origin/destination/date/time filters.
    const tomorrow = localDate(1);
    const allTrips = await request(baseUrl, `/trips?date=${tomorrow}`);
    assert.equal(allTrips.response.status, 200);
    const trip = allTrips.data.find(item => item.status === 'scheduled' && item.availableSeats > 0);
    assert.ok(trip, 'expected a seeded scheduled trip');
    const localTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(new Date(trip.departureTime));
    const filteredTrips = await request(
      baseUrl,
      `/trips?origin=${encodeURIComponent(trip.origin)}&destination=${encodeURIComponent(trip.destination)}&date=${tomorrow}&time=${encodeURIComponent(localTime)}`,
    );
    assert.equal(filteredTrips.response.status, 200);
    assert.ok(filteredTrips.data.some(item => item.id === trip.id));

    // Create a paid ticket once, then reuse it to verify QR, invoice, notifications and scan flows.
    const detail = await request(baseUrl, `/trips/${trip.id}`);
    assert.equal(detail.response.status, 200);
    const seat = detail.data.seats.find(item => item.status === 'available')?.seat;
    assert.ok(seat);
    const hold = await request(baseUrl, '/holds', {
      method: 'POST', cookie: passengerCookie, body: { tripId: trip.id, seat },
    });
    assert.equal(hold.response.status, 201, hold.data.message);
    const paid = await request(baseUrl, '/payments', {
      method: 'POST',
      cookie: passengerCookie,
      body: { ticketId: hold.data.id, method: 'momo', outcome: 'success', idempotencyKey: `duong-${hold.data.id}` },
    });
    assert.equal(paid.response.status, 200, paid.data.message);
    assert.equal(paid.data.ticket.status, 'paid');

    // Sprint 1: electronic ticket/QR generation API.
    const qr = await request(baseUrl, `/tickets/${hold.data.id}/qr`, { cookie: passengerCookie });
    assert.equal(qr.response.status, 200, qr.data.message);
    assert.equal(qr.data.code, paid.data.ticket.code);
    assert.match(qr.data.dataUrl, /^data:image\/png;base64,/);

    // Sprint 2 / US07: invoice persistence, PDF invoice and simulated email outbox.
    const invoice = await request(baseUrl, `/tickets/${hold.data.id}/invoice`, { cookie: passengerCookie });
    assert.equal(invoice.response.status, 200);
    assert.match(invoice.response.headers.get('content-type') || '', /application\/pdf/);
    assert.ok(invoice.data.startsWith('%PDF-'));
    const email = await request(baseUrl, `/tickets/${hold.data.id}/email`, { method: 'POST', cookie: passengerCookie });
    assert.equal(email.response.status, 200, email.data.message);
    assert.ok((await db.query('SELECT 1 FROM outbox WHERE "ticketId"=$1', [hold.data.id])).rows[0]);

    // Sprint 2 / US10: near-stop notification service triggered by live vehicle location.
    const stop = detail.data.stops.find(item => Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)));
    assert.ok(stop, 'expected route stop coordinates');
    const now = new Date();
    const departureTime = new Date(now.getTime() - 5 * 60000).toISOString();
    const arrivalTime = new Date(now.getTime() + 60 * 60000).toISOString();
    await db.query('UPDATE trips SET status=$1,"driverId"=$2,"departureTime"=$3,"arrivalTime"=$4 WHERE id=$5', ['running', 'user_driver', departureTime, arrivalTime, trip.id]);
    const location = await request(baseUrl, `/driver/trips/${trip.id}/location`, {
      method: 'POST', cookie: driverCookie, body: { lat: Number(stop.lat), lng: Number(stop.lng) },
    });
    assert.equal(location.response.status, 200, location.data.message);
    const notifications = await request(baseUrl, '/notifications', { cookie: passengerCookie });
    assert.equal(notifications.response.status, 200);
    assert.ok(notifications.data.some(item => item.tripId === trip.id && item.title === 'Xe sắp đến trạm'));

    // Sprint 3: QR validation/check-in API; duplicate scan must be rejected.
    const scan = await request(baseUrl, '/driver/scan', {
      method: 'POST', cookie: driverCookie, body: { code: paid.data.ticket.code, tripId: trip.id },
    });
    assert.equal(scan.response.status, 200, scan.data.message);
    assert.equal(scan.data.ticket.status, 'checked_in');
    const duplicateScan = await request(baseUrl, '/driver/scan', {
      method: 'POST', cookie: driverCookie, body: { code: paid.data.ticket.code, tripId: trip.id },
    });
    assert.equal(duplicateScan.response.status, 409);

    // Sprint 3: route/stop/fare CRUD and data constraints.
    const stopCreate = await request(baseUrl, '/admin/stops', {
      method: 'POST', cookie: managerCookie,
      body: { name: `Trạm Dương ${Date.now()}`, address: 'Điểm kiểm thử backend', lat: 21.02, lng: 105.82 },
    });
    assert.equal(stopCreate.response.status, 201, stopCreate.data.message);
    const stopUpdate = await request(baseUrl, `/admin/stops/${stopCreate.data.id}`, {
      method: 'PATCH', cookie: managerCookie,
      body: { name: `${stopCreate.data.name} cập nhật`, address: 'Địa chỉ cập nhật', lat: 21.021, lng: 105.821 },
    });
    assert.equal(stopUpdate.response.status, 200, stopUpdate.data.message);
    const stopDelete = await request(baseUrl, `/admin/stops/${stopCreate.data.id}`, { method: 'DELETE', cookie: managerCookie });
    assert.equal(stopDelete.response.status, 200, stopDelete.data.message);

    const seededStops = await request(baseUrl, '/admin/stops', { cookie: managerCookie });
    assert.equal(seededStops.response.status, 200);
    const routeCode = `DUONG-${Date.now()}`;
    const routeCreate = await request(baseUrl, '/admin/routes', {
      method: 'POST', cookie: managerCookie,
      body: {
        code: routeCode, name: 'Tuyến backend Nguyễn Hữu Dương', origin: 'Điểm A', destination: 'Điểm B',
        distanceKm: 10, price: 25000, durationMinutes: 30,
        stopIds: seededStops.data.slice(0, 2).map(item => item.id),
      },
    });
    assert.equal(routeCreate.response.status, 201, routeCreate.data.message);
    const routeUpdate = await request(baseUrl, `/admin/routes/${routeCreate.data.id}`, {
      method: 'PATCH', cookie: managerCookie,
      body: {
        ...routeCreate.data, price: 27000, durationMinutes: 35,
        stopIds: seededStops.data.slice(0, 2).map(item => item.id),
      },
    });
    assert.equal(routeUpdate.response.status, 200, routeUpdate.data.message);
    assert.equal(Number(routeUpdate.data.price), 27000);
    const routeDelete = await request(baseUrl, `/admin/routes/${routeCreate.data.id}`, { method: 'DELETE', cookie: managerCookie });
    assert.equal(routeDelete.response.status, 200, routeDelete.data.message);

    // Sprint 3: Role/Permission account management, lock/unlock and authorization.
    const userCreate = await request(baseUrl, '/admin/users', {
      method: 'POST', cookie: adminCookie,
      body: { name: 'Tài khoản kiểm thử Dương', email: `duong-scope-${Date.now()}@smartbus.demo`, password: 'SmartBus@123', role: 'passenger' },
    });
    assert.equal(userCreate.response.status, 201, userCreate.data.message);
    const roleChange = await request(baseUrl, `/admin/users/${userCreate.data.id}`, {
      method: 'PATCH', cookie: adminCookie, body: { role: 'manager' },
    });
    assert.equal(roleChange.response.status, 200, roleChange.data.message);
    assert.equal(roleChange.data.role, 'manager');
    const lock = await request(baseUrl, `/admin/users/${userCreate.data.id}`, {
      method: 'PATCH', cookie: adminCookie, body: { active: false },
    });
    assert.equal(lock.response.status, 200, lock.data.message);
    const forbidden = await request(baseUrl, '/admin/users', { cookie: passengerCookie });
    assert.equal(forbidden.response.status, 403);
    const unlock = await request(baseUrl, `/admin/users/${userCreate.data.id}`, {
      method: 'PATCH', cookie: adminCookie, body: { active: true },
    });
    assert.equal(unlock.response.status, 200, unlock.data.message);

    // Sprint 4: Voucher CRUD, validity/usage configuration and soft deactivation.
    const voucherCode = `DUONG${Date.now()}`;
    const voucherCreate = await request(baseUrl, '/admin/vouchers', {
      method: 'POST', cookie: managerCookie,
      body: {
        code: voucherCode, name: 'Voucher Nguyễn Hữu Dương', description: 'Kiểm thử phạm vi Sprint 4',
        type: 'percent', value: 10, percent: 10, maxDiscount: 20000, minAmount: 0,
        startsAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(),
        usageLimit: 5, perUserLimit: 1, active: true,
      },
    });
    assert.equal(voucherCreate.response.status, 201, voucherCreate.data.message);
    const voucherUpdate = await request(baseUrl, `/admin/vouchers/${voucherCreate.data.id}`, {
      method: 'PATCH', cookie: managerCookie,
      body: { ...voucherCreate.data, name: 'Voucher Nguyễn Hữu Dương cập nhật', usageLimit: 6, active: true },
    });
    assert.equal(voucherUpdate.response.status, 200, voucherUpdate.data.message);
    const voucherDelete = await request(baseUrl, `/admin/vouchers/${voucherCreate.data.id}`, { method: 'DELETE', cookie: managerCookie });
    assert.equal(voucherDelete.response.status, 200, voucherDelete.data.message);
    assert.equal((await db.query('SELECT active FROM vouchers WHERE id=$1', [voucherCreate.data.id])).rows[0].active, 0);

    // Sprint 4 / US19: revenue aggregation by period/route.
    const from = localDate(-30);
    const to = localDate(1);
    const report = await request(baseUrl, `/admin/reports?from=${from}&to=${to}`, { cookie: managerCookie });
    assert.equal(report.response.status, 200, report.data.message);
    assert.ok(Number.isFinite(Number(report.data.stats.revenue)));
    assert.ok(Array.isArray(report.data.daily));
    assert.ok(Array.isArray(report.data.byRoute));
    const routeReport = await request(baseUrl, `/admin/reports?from=${from}&to=${to}&routeId=${encodeURIComponent(trip.routeId)}`, { cookie: managerCookie });
    assert.equal(routeReport.response.status, 200, routeReport.data.message);
    assert.ok(routeReport.data.byRoute.every(item => item.routeId === trip.routeId));
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
});
