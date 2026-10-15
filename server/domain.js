import { randomUUID } from 'node:crypto';
export const id = (prefix = 'id') => `${prefix}_${randomUUID().replaceAll('-', '')}`;
export const nowISO = () => new Date().toISOString();
export function fail(status, message) { const error = new Error(message); error.status = status; throw error; }
export const safeUser = ({ passwordHash: _passwordHash, ...user }) => user;
export async function audit(db, userId, action, entity, entityId, details = '') {
  await db.query('INSERT INTO audit_logs(id,"userId",action,entity,"entityId",details,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7)', [id('audit'),userId,action,entity,entityId,typeof details === 'string' ? details : JSON.stringify(details),nowISO()]);
}
export async function notify(db, userId, title, message, tripId = null) {
  await db.query('INSERT INTO notifications(id,"userId",title,message,"tripId","createdAt") VALUES($1,$2,$3,$4,$5,$6)',[id('notice'),userId,title,message,tripId,nowISO()]);
}
export async function expireHolds(db) {
  const time = nowISO();
  await db.query(`UPDATE tickets SET status='expired' WHERE status='held' AND "holdExpiresAt" <= $1`,[time]);
  await db.query(`UPDATE seat_holds SET status='expired' WHERE status='active' AND "expiresAt" <= $1`,[time]);
  await db.query(`UPDATE bookings SET status='expired' WHERE status='held' AND id IN (SELECT "bookingId" FROM tickets WHERE status='expired')`);
}
export const tripSelect = `SELECT t.*,r.name AS "routeName",r.code AS "routeCode",r.origin,r.destination,r.price,r."durationMinutes",b.plate,b.name AS "busName",b."seatCount",u.name AS "driverName",(b."seatCount"-(SELECT COUNT(*)::int FROM tickets tk WHERE tk."tripId"=t.id AND (tk.status IN ('paid','checked_in') OR (tk.status='held' AND tk."holdExpiresAt">to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')))))::int AS "availableSeats" FROM trips t JOIN routes r ON r.id=t."routeId" JOIN buses b ON b.id=t."busId" JOIN users u ON u.id=t."driverId"`;
export async function listTrips(db, filters = {}) {
  const conditions = [], values = [];
  for (const [key, col] of [['routeId','t."routeId"'],['driverId','t."driverId"'],['origin','r.origin'],['destination','r.destination']]) {
    if (filters[key]) { values.push(filters[key]); conditions.push(`${col}=$${values.length}`); }
  }
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00+07:00`);
    if (Number.isNaN(start.getTime())) fail(400,'Ngày đi không hợp lệ.');
    values.push(start.toISOString(),new Date(start.getTime()+86400000).toISOString());
    conditions.push(`t."departureTime">=$${values.length-1} AND t."departureTime"<$${values.length}`);
  }
  if (filters.time) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(filters.time)) fail(400,'Giờ khởi hành không hợp lệ.');
    values.push(filters.time);
    conditions.push(`to_char(t."departureTime"::timestamptz AT TIME ZONE 'Asia/Ho_Chi_Minh','HH24:MI')=$${values.length}`);
  }
  return (await db.query(`${tripSelect}${conditions.length?' WHERE '+conditions.join(' AND '):''} ORDER BY t."departureTime"`,values)).rows;
}
export async function getTrip(db, tripId) { return (await db.query(`${tripSelect} WHERE t.id=$1`,[tripId])).rows[0]; }
export const ticketSelect = `SELECT tk.*,t."departureTime",t."arrivalTime",t.status AS "tripStatus",t."routeId",r.name AS "routeName",r.origin,r.destination,b.plate,u.name AS "passengerName",u.email AS "passengerEmail" FROM tickets tk JOIN trips t ON t.id=tk."tripId" JOIN routes r ON r.id=t."routeId" JOIN buses b ON b.id=t."busId" JOIN users u ON u.id=tk."userId"`;
export async function getTicket(db, ticketId) { return (await db.query(`${ticketSelect} WHERE tk.id=$1`,[ticketId])).rows[0]; }
export function textField(value, label, min = 1, max = 200) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) fail(400,`${label} phải có từ ${min} đến ${max} ký tự.`);
  return value.trim();
}
export function integer(value, label, min, max) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < min || number > max) fail(400,`${label} không hợp lệ.`);
  return number;
}
