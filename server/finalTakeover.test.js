import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './db.js';
import { seedDatabase } from './seed.js';
import { createApp } from './app.js';

async function startServer(app) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
  return { server, baseUrl: `http://127.0.0.1:${server.address().port}` };
}

async function request(baseUrl, path, { cookie, method = 'GET', body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}/api${path}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();
  return { response, data };
}

async function login(baseUrl, email) {
  const result = await request(baseUrl, '/auth/login', { method: 'POST', body: { email, password: 'SmartBus@123' } });
  assert.equal(result.response.status, 200, result.data.message);
  return result.response.headers.get('set-cookie').split(';', 1)[0];
}

test('final takeover regression covers transferred backend and tester edge cases', async () => {
  const db = await createDatabase(':memory:');
  await seedDatabase(db, { historyDays: 7 });
  const app = await createApp({ db, demoMode: true });
  const { server, baseUrl } = await startServer(app);

  try {
    const passengerCookie = await login(baseUrl, 'passenger@smartbus.demo');
    const adminCookie = await login(baseUrl, 'admin@smartbus.demo');
    const managerCookie = await login(baseUrl, 'manager@smartbus.demo');

    const noTrips = await request(baseUrl, '/trips?origin=KHONG-TON-TAI&destination=KHONG-TON-TAI');
    assert.equal(noTrips.response.status, 200);
    assert.deepEqual(noTrips.data, []);

    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date(Date.now() + 86400000));
    const trips = await request(baseUrl, `/trips?date=${date}`);
    const trip = trips.data.find(item => item.status === 'scheduled' && item.availableSeats >= 3);
    assert.ok(trip, 'Cần chuyến tương lai còn ít nhất 3 ghế để chạy regression test.');

    const detail = await request(baseUrl, `/trips/${trip.id}`);
    const seats = detail.data.seats.filter(item => item.status === 'available').slice(0, 3).map(item => item.seat);
    assert.equal(seats.length, 3);

    const expiring = await request(baseUrl, '/holds', { method: 'POST', cookie: passengerCookie, body: { tripId: trip.id, seat: seats[0] } });
    assert.equal(expiring.response.status, 201, expiring.data.message);
    assert.ok(Math.abs(Date.parse(expiring.data.holdExpiresAt) - Date.now() - 600000) < 5000);
    const past = new Date(Date.now() - 1000).toISOString();
    await db.query('UPDATE tickets SET "holdExpiresAt"=$1 WHERE id=$2', [past, expiring.data.id]);
    await db.query('UPDATE seat_holds SET "expiresAt"=$1 WHERE "ticketId"=$2', [past, expiring.data.id]);
    const released = await request(baseUrl, `/trips/${trip.id}`);
    assert.equal(released.data.seats.find(item => item.seat === seats[0])?.status, 'available');

    const failedHold = await request(baseUrl, '/holds', { method: 'POST', cookie: passengerCookie, body: { tripId: trip.id, seat: seats[1] } });
    const failedPayment = await request(baseUrl, '/payments', {
      method: 'POST', cookie: passengerCookie,
      body: { ticketId: failedHold.data.id, method: 'momo', outcome: 'failed', idempotencyKey: `final-failed-${failedHold.data.id}` },
    });
    assert.equal(failedPayment.response.status, 200, failedPayment.data.message);
    assert.equal(failedPayment.data.payment.status, 'failed');
    assert.equal(failedPayment.data.ticket.status, 'expired');

    const cancelledHold = await request(baseUrl, '/holds', { method: 'POST', cookie: passengerCookie, body: { tripId: trip.id, seat: seats[2] } });
    const cancelledPayment = await request(baseUrl, '/payments', {
      method: 'POST', cookie: passengerCookie,
      body: { ticketId: cancelledHold.data.id, method: 'vnpay', outcome: 'cancelled', idempotencyKey: `final-cancel-${cancelledHold.data.id}` },
    });
    assert.equal(cancelledPayment.response.status, 200, cancelledPayment.data.message);
    assert.equal(cancelledPayment.data.payment.status, 'cancelled');
    assert.equal(cancelledPayment.data.ticket.status, 'expired');

    const historical = (await db.query("SELECT id FROM tickets WHERE \"userId\"=$1 AND status='checked_in' LIMIT 1", ['user_passenger'])).rows[0];
    assert.ok(historical);
    const invalidCancel = await request(baseUrl, `/tickets/${historical.id}/cancel`, {
      method: 'POST', cookie: passengerCookie, body: { reason: 'Kiểm thử vé đã sử dụng' },
    });
    assert.equal(invalidCancel.response.status, 409);

    const reviewTicket = (await db.query("SELECT * FROM tickets WHERE \"userId\"=$1 AND status='checked_in' LIMIT 1", ['user_passenger'])).rows[0];
    const invalidRating = await request(baseUrl, '/feedback', {
      method: 'POST', cookie: passengerCookie,
      body: { tripId: reviewTicket.tripId, rating: 6, message: 'Sai thang điểm' },
    });
    assert.equal(invalidRating.response.status, 400);
    const review = await request(baseUrl, '/feedback', {
      method: 'POST', cookie: passengerCookie,
      body: { tripId: reviewTicket.tripId, rating: 5, message: 'Final regression.' },
    });
    assert.equal(review.response.status, 201, review.data.message);
    const duplicate = await request(baseUrl, '/feedback', {
      method: 'POST', cookie: passengerCookie,
      body: { tripId: reviewTicket.tripId, rating: 4, message: 'Duplicate' },
    });
    assert.equal(duplicate.response.status, 409);

    const deniedAudit = await request(baseUrl, '/admin/audit', { cookie: passengerCookie });
    assert.equal(deniedAudit.response.status, 403);
    const audit = await request(baseUrl, '/admin/audit', { cookie: adminCookie });
    assert.equal(audit.response.status, 200);
    const occupancy = await request(baseUrl, `/admin/analytics/occupancy-trends?from=${date}&to=${date}`, { cookie: managerCookie });
    assert.equal(occupancy.response.status, 200);
    assert.ok(occupancy.data.every(row => Number(row.occupancy) >= 0 && Number(row.occupancy) <= 100));
  } finally {
    await new Promise(resolve => server.close(resolve));
    await db.close();
  }
});
