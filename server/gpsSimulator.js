import { randomUUID } from 'node:crypto';

const makeId = prefix => `${prefix}_${randomUUID().replaceAll('-', '')}`;
const metersBetween = (first, second) => {
  const radians = degrees => degrees * Math.PI / 180;
  const dLat = radians(Number(second.lat) - Number(first.lat));
  const dLng = radians(Number(second.lng) - Number(first.lng));
  const lat1 = radians(Number(first.lat)), lat2 = radians(Number(second.lat));
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

function positionOnRoute(stops, progress) {
  const segments = stops.slice(0, -1).map((stop, index) => ({ start: stop, end: stops[index + 1], length: metersBetween(stop, stops[index + 1]) }));
  const total = segments.reduce((sum, segment) => sum + segment.length, 0);
  if (!total) return stops[0];
  let remaining = total * progress;
  for (const segment of segments) {
    if (remaining <= segment.length || segment === segments.at(-1)) {
      const ratio = segment.length ? Math.min(1, remaining / segment.length) : 0;
      return { lat: Number(segment.start.lat) + (Number(segment.end.lat) - Number(segment.start.lat)) * ratio, lng: Number(segment.start.lng) + (Number(segment.end.lng) - Number(segment.start.lng)) * ratio };
    }
    remaining -= segment.length;
  }
  return stops.at(-1);
}

export async function updateSimulatedLocations(db) {
  const timestamp = new Date().toISOString();
  const trips = (await db.query(`SELECT * FROM trips WHERE status IN ('scheduled','running') AND "departureTime"<=$1 ORDER BY "departureTime" LIMIT 50`, [timestamp])).rows;
  for (const trip of trips) {
    await db.transaction(async tx => {
      const current = (await tx.query('SELECT * FROM trips WHERE id=$1 FOR UPDATE', [trip.id])).rows[0];
      if (!current || !['scheduled', 'running'].includes(current.status)) return;
      if (Date.parse(current.arrivalTime) <= Date.now()) {
        await tx.query("UPDATE trips SET status='completed' WHERE id=$1", [current.id]);
        return;
      }
      const stops = (await tx.query('SELECT s.id,s.name,s.lat,s.lng FROM route_stops rs JOIN stops s ON s.id=rs."stopId" WHERE rs."routeId"=$1 ORDER BY rs."stopOrder"', [current.routeId])).rows;
      if (stops.length < 2) return;
      if (current.status === 'scheduled') await tx.query("UPDATE trips SET status='running' WHERE id=$1", [current.id]);
      const elapsed = Date.now() - Date.parse(current.departureTime);
      const duration = Date.parse(current.arrivalTime) - Date.parse(current.departureTime);
      const location = positionOnRoute(stops, Math.max(0, Math.min(1, elapsed / duration)));
      await tx.query('UPDATE trips SET lat=$1,lng=$2,"locationUpdatedAt"=$3,"locationSource"=$4 WHERE id=$5', [location.lat, location.lng, timestamp, 'simulation', current.id]);
      await tx.query('INSERT INTO vehicle_locations(id,"tripId",lat,lng,source,"recordedAt") VALUES($1,$2,$3,$4,$5,$6)', [makeId('gps-sim'), current.id, location.lat, location.lng, 'simulation', timestamp]);
      for (const stop of stops) {
        if (metersBetween(location, stop) > 900) continue;
        const passengers = (await tx.query("SELECT DISTINCT \"userId\" FROM tickets WHERE \"tripId\"=$1 AND status IN ('paid','checked_in')", [current.id])).rows;
        for (const passenger of passengers) {
          await tx.query('INSERT INTO notifications(id,"userId","tripId",title,message,read,"createdAt","dedupeKey") VALUES($1,$2,$3,$4,$5,0,$6,$7) ON CONFLICT DO NOTHING', [makeId('notice'), passenger.userId, current.id, 'Xe sắp đến trạm', `Xe buýt đang ở gần trạm ${stop.name}.`, timestamp, `stop:${current.id}:${stop.id}:${passenger.userId}`]);
        }
      }
    });
  }
  await db.query('DELETE FROM vehicle_locations WHERE "recordedAt"<$1', [new Date(Date.now() - 7 * 86400000).toISOString()]);
}

export function startGpsSimulator(db, intervalMs = 15000) {
  let active = false;
  const tick = async () => {
    if (active) return;
    active = true;
    try { await updateSimulatedLocations(db); }
    catch (error) { console.error('SmartBus GPS simulator error:', error.message); }
    finally { active = false; }
  };
  void tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}