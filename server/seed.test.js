import test from 'node:test';
import assert from 'node:assert/strict';
import { createDatabase } from './db.js';
import { seedDatabase } from './seed.js';

test('default demo seed provides 60-day diverse history, 4+ buses/drivers and Hanoi/Thai Nguyen routes', async () => {
  const db = await createDatabase(':memory:');
  try {
    await seedDatabase(db);
    const marker = (await db.query("SELECT value FROM schema_meta WHERE key='demo_history_v2'")).rows[0];
    assert.equal(Number(marker.value), 60);
    assert.ok(Number((await db.query('SELECT COUNT(*)::int AS n FROM buses')).rows[0].n) >= 4);
    assert.ok(Number((await db.query("SELECT COUNT(*)::int AS n FROM users WHERE role='driver'")).rows[0].n) >= 4);
    const directions = (await db.query("SELECT origin,destination FROM routes WHERE active=1")).rows;
    assert.ok(directions.some(r => r.origin === 'Hà Nội' && r.destination === 'Thái Nguyên'));
    assert.ok(directions.some(r => r.origin === 'Thái Nguyên' && r.destination === 'Hà Nội'));
    const span = (await db.query(`SELECT MIN("departureTime") AS min,MAX("departureTime") AS max,COUNT(*)::int AS trips FROM trips WHERE id LIKE 'trip_history_%'`)).rows[0];
    assert.ok(Number(span.trips) > 500);
    assert.ok((Date.parse(span.max) - Date.parse(span.min)) / 86400000 >= 55);
    const loads = (await db.query(`SELECT EXTRACT(HOUR FROM t."departureTime"::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS hour,COUNT(tk.id)::int AS passengers
      FROM trips t LEFT JOIN tickets tk ON tk."tripId"=t.id AND tk.status IN ('paid','checked_in') WHERE t.id LIKE 'trip_history_%' GROUP BY hour`)).rows;
    const byHour = Object.fromEntries(loads.map(r => [Number(r.hour), Number(r.passengers)]));
    assert.ok(byHour[8] > byHour[12]);
    assert.ok(byHour[18] > byHour[12]);
  } finally { await db.close(); }
});
