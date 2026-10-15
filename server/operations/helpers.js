import { randomUUID } from 'node:crypto';
export const makeId = (prefix = 'ops') => `${prefix}_${randomUUID().replaceAll('-', '')}`;
export const identifier = (value, label = 'Mã định danh') => required(value, label, 120);
export function fail(status, message) { throw Object.assign(new Error(message), { status }); }
export const now = () => new Date().toISOString();
export const all = async (db, sql, params = []) => (await db.query(sql, params)).rows;
export const one = async (db, sql, params = []) => (await all(db, sql, params))[0];
export const required = (value, label, max = 200) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) fail(400, `${label} không hợp lệ (tối đa ${max} ký tự).`);
  return value.trim();
};
export function integer(value, label, min = 1, max = Number.MAX_SAFE_INTEGER) {
  if (value === '' || value === null || value === undefined || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) fail(400, `${label} không hợp lệ.`);
  return Number(value);
}
export function coordinate(value, label, limit) {
  if (value === '' || value === null || value === undefined || !Number.isFinite(Number(value)) || Math.abs(Number(value)) > limit) fail(400, `${label} không hợp lệ.`);
  return Number(value);
}
export function timestamp(value, label) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) fail(400, `${label} không hợp lệ.`);
  return new Date(value).toISOString();
}
export function booleanInt(value, label = 'Trạng thái') {
  if (![true, false, 0, 1].includes(value)) fail(400, `${label} không hợp lệ.`);
  return value ? 1 : 0;
}
export function choice(value, options, label) {
  if (!options.includes(value)) fail(400, `${label} không hợp lệ.`);
  return value;
}
export async function rowById(db, table, id) {
  const value = await one(db, `SELECT * FROM ${table} WHERE id=$1`, [identifier(id)]);
  if (!value) fail(404, 'Không tìm thấy dữ liệu.');
  return value;
}
export async function insert(db, table, data) {
  if (table !== 'route_stops' && !data.id) data = { id: makeId(table), ...data };
  const keys = Object.keys(data);
  return one(db, `INSERT INTO ${table} (${keys.map(key => `"${key}"`).join(',')}) VALUES (${keys.map((_, index) => `$${index + 1}`).join(',')}) RETURNING *`, Object.values(data));
}
export async function update(db, table, id, data) {
  const keys = Object.keys(data);
  return one(db, `UPDATE ${table} SET ${keys.map((key, index) => `"${key}"=$${index + 1}`).join(',')} WHERE id=$${keys.length + 1} RETURNING *`, [...Object.values(data), id]);
}
export async function log(db, userId, action, entity, entityId, details = '') {
  await insert(db, 'audit_logs', { userId, action, entity, entityId: String(entityId), details: typeof details === 'string' ? details : JSON.stringify(details), createdAt: now() });
}
export async function notify(db, userId, title, message, tripId = null) {
  await insert(db, 'notifications', { userId, tripId, title, message, read: 0, createdAt: now() });
}
export const safeUser = user => {
  const { passwordHash: _passwordHash, ...safe } = user;
  return safe;
};
export const tripSelect = `SELECT t.*, r.name AS "routeName", r.code AS "routeCode", r.origin, r.destination, r.price,
  b.plate, b."seatCount", u.name AS "driverName",
  b."seatCount" - (SELECT COUNT(*)::int FROM tickets k WHERE k."tripId"=t.id AND (k.status IN ('paid','checked_in') OR (k.status='held' AND k."holdExpiresAt">$1))) AS "availableSeats"
  FROM trips t JOIN routes r ON r.id=t."routeId" JOIN buses b ON b.id=t."busId" JOIN users u ON u.id=t."driverId"`;
export async function joinedTrip(db, id) { return one(db, `${tripSelect} WHERE t.id=$2`, [now(), id]); }
export async function checkAssigned(db, user, id) {
  const trip = await rowById(db, 'trips', id);
  if (user.role === 'driver' && trip.driverId !== user.id) fail(403, 'Bạn không được phân công chuyến xe này.');
  return trip;
}
