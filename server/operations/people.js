import { hashPassword, validatePassword } from '../security.js';
import { all, one, insert, update, rowById, required, integer, identifier, makeId, timestamp, booleanInt, choice, now, fail, log, notify, safeUser } from './helpers.js';

export function registerPeople({ db, staff, admin }) {
  staff('get', '/admin/users', async (_req, res) => res.json((await all(db, 'SELECT * FROM users ORDER BY id')).map(safeUser)));
  admin('post', '/admin/users', async (req, res) => {
    const b = req.body;
    const email = required(b.email, 'Email', 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Email không hợp lệ.');
    validatePassword(b.password);
    const data = { name: required(b.name, 'Họ tên', 120), email, passwordHash: await hashPassword(b.password), role: choice(b.role, ['admin', 'manager', 'driver', 'passenger'], 'Vai trò'), phone: b.phone ? required(b.phone, 'Số điện thoại', 30) : '', active: 1, createdAt: now() };
    const user = await db.transaction(async tx => {
      if (await one(tx, 'SELECT 1 FROM users WHERE lower(email)=$1', [email])) fail(409, 'Email đã được sử dụng.');
      const saved = await insert(tx, 'users', data);
      if (saved.role === 'driver') await tx.query('INSERT INTO drivers (id,"userId","createdAt") VALUES ($1,$2,$3) ON CONFLICT ("userId") DO NOTHING', [makeId('driver'), saved.id, now()]);
      await log(tx, req.user.id, 'user.create', 'users', saved.id, { email, role: saved.role });
      return safeUser(saved);
    });
    res.status(201).json(user);
  });
  admin('patch', '/admin/users/:id', async (req, res) => {
    const user = await db.transaction(async tx => {
      await tx.query('LOCK TABLE users IN SHARE ROW EXCLUSIVE MODE');
      const existing = await rowById(tx, 'users', req.params.id);
      const role = req.body.role === undefined ? existing.role : choice(req.body.role, ['admin', 'manager', 'driver', 'passenger'], 'Vai trò');
      const active = req.body.active === undefined ? existing.active : booleanInt(req.body.active);
      if (existing.id === req.user.id && (role !== 'admin' || !active)) fail(409, 'Không thể tự khóa hoặc hạ quyền tài khoản đang đăng nhập.');
      if (existing.role === 'admin' && existing.active && (role !== 'admin' || !active)) {
        const count = await one(tx, `SELECT COUNT(*)::int AS total FROM users WHERE role='admin' AND active=1`);
        if (count.total <= 1) fail(409, 'Phải giữ lại ít nhất một quản trị viên đang hoạt động.');
      }
      if (existing.role === 'driver' && (role !== 'driver' || !active) && await one(tx, `SELECT 1 FROM trips WHERE "driverId"=$1 AND status IN ('scheduled','running') AND "arrivalTime">$2 LIMIT 1`, [existing.id, now()])) fail(409, 'Cần đổi tài xế cho các chuyến được phân công trước khi thay đổi tài khoản.');
      const saved = await update(tx, 'users', existing.id, { role, active });
      if (role === 'driver') await tx.query('INSERT INTO drivers (id,"userId","createdAt") VALUES ($1,$2,$3) ON CONFLICT ("userId") DO NOTHING', [makeId('driver'), saved.id, now()]);
      if (role !== existing.role || !active) await tx.query('DELETE FROM sessions WHERE "userId"=$1', [existing.id]);
      if (role !== existing.role) await log(tx, req.user.id, 'ROLE_CHANGE', 'users', saved.id, { from: existing.role, to: role });
      if (active !== existing.active) await log(tx, req.user.id, active ? 'UNLOCK' : 'LOCK', 'users', saved.id, { active });
      if (role === existing.role && active === existing.active) await log(tx, req.user.id, 'USER_UPDATE', 'users', saved.id, { role, active });
      return safeUser(saved);
    });
    res.json(user);
  });
  staff('get', '/admin/discounts', async (_req, res) => res.json((await all(db, `SELECT u.*,dp.id AS "discountProfileId",dp."evidenceFileId",pf."originalName" AS "evidenceFileName",pf."mimeType" AS "evidenceMimeType",dp."reviewReason" FROM users u LEFT JOIN LATERAL (SELECT * FROM discount_profiles d WHERE d."userId"=u.id ORDER BY d."createdAt" DESC LIMIT 1) dp ON TRUE LEFT JOIN private_files pf ON pf.id=dp."evidenceFileId" WHERE u."discountStatus"<>'none' ORDER BY CASE WHEN u."discountStatus"='pending' THEN 0 ELSE 1 END,u.id DESC`)).map(safeUser)));
  staff('patch', '/admin/discounts/:id', async (req, res) => {
    const status = choice(req.body.discountStatus, ['approved', 'rejected'], 'Trạng thái hồ sơ');
    const reason = status === 'rejected' ? required(req.body.reason, 'Lý do từ chối', 1000) : String(req.body.reason || '').trim().slice(0, 1000);
    const user = await db.transaction(async tx => {
      const existing = await one(tx, 'SELECT * FROM users WHERE id=$1 FOR UPDATE', [identifier(req.params.id, 'Tài khoản')]);
      if (!existing) fail(404, 'Không tìm thấy hồ sơ.');
      if (existing.discountStatus !== 'pending') fail(409, 'Hồ sơ không còn ở trạng thái chờ duyệt.');
      const saved = await update(tx, 'users', existing.id, { discountStatus: status });
      await tx.query(`UPDATE discount_profiles SET status=$1,"reviewedBy"=$2,"reviewedAt"=$3,"reviewReason"=$4 WHERE "userId"=$5 AND status='pending'`, [status, req.user.id, now(), reason, existing.id]);
      await notify(tx, existing.id, 'Kết quả hồ sơ ưu đãi', status === 'approved' ? 'Hồ sơ đã được duyệt. Ưu đãi sẽ áp dụng khi mua vé.' : `Hồ sơ chưa được duyệt. ${reason}`);
      await log(tx, req.user.id, 'discount.review', 'users', saved.id, { discountStatus: status, reason });
      return safeUser(saved);
    });
    res.json(user);
  });
  staff('get', '/admin/vouchers', async (_req, res) => res.json(await all(db, 'SELECT * FROM vouchers ORDER BY id DESC')));
  for (const method of ['post', 'patch']) staff(method, `/admin/vouchers${method === 'patch' ? '/:id' : ''}`, async (req, res) => {
    const voucher = await db.transaction(async tx => {
      const existing = method === 'patch' ? await rowById(tx, 'vouchers', req.params.id) : null;
      const b = { ...existing, ...req.body };
      const type = choice(b.type || 'percent', ['percent', 'fixed'], 'Loại giảm giá');
      const value = integer(req.body.value ?? req.body.percent ?? b.value ?? b.percent, 'Giá trị giảm', 1, type === 'percent' ? 100 : 10000000);
      const data = { code: required(b.code, 'Mã giảm giá', 40).toUpperCase(), name: required(b.name || b.code, 'Tên mã giảm giá', 120), description: String(b.description || '').trim().slice(0, 1000), type, value, percent: type === 'percent' ? value : 0, maxDiscount: integer(b.maxDiscount ?? (type === 'fixed' ? value : 10000000), 'Giảm tối đa', 0, 10000000), minAmount: integer(b.minAmount ?? 0, 'Giá trị đơn tối thiểu', 0, 100000000), startsAt: timestamp(b.startsAt || now(), 'Ngày bắt đầu'), expiresAt: timestamp(b.expiresAt, 'Ngày hết hạn'), usageLimit: integer(b.usageLimit, 'Giới hạn lượt dùng', 1, 10000000), perUserLimit: integer(b.perUserLimit ?? 1, 'Giới hạn mỗi người', 1, 1000), active: booleanInt(b.active ?? true) };
      if (!/^[A-Z0-9_-]+$/.test(data.code)) fail(400, 'Mã giảm giá chỉ gồm chữ không dấu, số, dấu gạch ngang hoặc gạch dưới.');
      if (data.expiresAt <= data.startsAt) fail(400, 'Ngày hết hạn phải sau ngày bắt đầu.');
      if (existing && data.usageLimit < existing.usedCount) fail(400, 'Giới hạn lượt dùng không được thấp hơn số lượt đã sử dụng.');
      const saved = existing ? await update(tx, 'vouchers', existing.id, data) : await insert(tx, 'vouchers', { ...data, usedCount: 0 });
      await log(tx, req.user.id, `voucher.${existing ? 'update' : 'create'}`, 'vouchers', saved.id, data);
      return saved;
    });
    res.status(method === 'post' ? 201 : 200).json(voucher);
  });
  staff('delete', '/admin/vouchers/:id', async (req, res) => {
    await db.transaction(async tx => {
      const voucher = await rowById(tx, 'vouchers', req.params.id);
      // Preserve references from invoices and paid tickets for the audit trail.
      await update(tx, 'vouchers', voucher.id, { active: 0 });
      await log(tx, req.user.id, 'voucher.deactivate', 'vouchers', voucher.id);
    });
    res.json({ ok: true });
  });
  staff('get', '/admin/feedback', async (_req, res) => res.json(await all(db, `SELECT f.*,u.name AS "userName",r.name AS "routeName" FROM feedback f JOIN users u ON u.id=f."userId" JOIN trips t ON t.id=f."tripId" JOIN routes r ON r.id=t."routeId" ORDER BY f."createdAt" DESC`)));
  staff('patch', '/admin/feedback/:id', async (req, res) => {
    const response = required(req.body.response, 'Nội dung phản hồi', 3000);
    choice(req.body.status, ['resolved'], 'Trạng thái phản ánh');
    const feedback = await db.transaction(async tx => {
      const existing = await rowById(tx, 'feedback', req.params.id);
      const saved = await update(tx, 'feedback', existing.id, { response, status: 'resolved' });
      await notify(tx, existing.userId, 'Phản ánh đã được xử lý', response);
      await log(tx, req.user.id, 'feedback.respond', 'feedback', saved.id);
      return saved;
    });
    res.json(feedback);
  });
  admin('get', '/admin/audit', async (req, res) => {
    const conditions = [], values = [];
    const add = (sql, value) => { values.push(value); conditions.push(sql.replace('?', '$' + values.length)); };
    if (req.query.action) add('a.action=?', required(req.query.action, 'Thao tác', 80));
    if (req.query.entity) add('a.entity=?', required(req.query.entity, 'Loại dữ liệu', 80));
    if (req.query.userId) add('a."userId"=?', identifier(req.query.userId, 'Tài khoản'));
    if (req.query.from) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.from)) fail(400, 'Ngày bắt đầu không hợp lệ.');
      add('a."createdAt">=?', new Date(`${req.query.from}T00:00:00+07:00`).toISOString());
    }
    if (req.query.to) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(req.query.to)) fail(400, 'Ngày kết thúc không hợp lệ.');
      add('a."createdAt"<?', new Date(Date.parse(`${req.query.to}T00:00:00+07:00`) + 86400000).toISOString());
    }
    if (req.query.search) {
      const search = `%${required(req.query.search, 'Từ khóa', 120)}%`;
      values.push(search);
      const index = values.length;
      conditions.push(`(u.name ILIKE $${index} OR a.action ILIKE $${index} OR a.entity ILIKE $${index} OR a."entityId" ILIKE $${index} OR a.details ILIKE $${index})`);
    }
    if (req.query.from && req.query.to && req.query.from > req.query.to) fail(400, 'Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.');
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    res.json(await all(db, `SELECT a.*,u.name AS "userName" FROM audit_logs a LEFT JOIN users u ON u.id=a."userId" ${where} ORDER BY a."createdAt" DESC, a.id DESC LIMIT 1000`, values));
  });
  admin('get', '/admin/outbox', async (_req, res) => res.json(await all(db, 'SELECT * FROM outbox ORDER BY "createdAt" DESC LIMIT 100')));
  staff('get', '/admin/refunds', async (_req, res) => res.json(await all(db, `SELECT rf.*,tk.code,tk.status AS "ticketStatus",tk."refundStatus",u.name AS "userName",u.email,t."departureTime",r.name AS "routeName" FROM refunds rf JOIN tickets tk ON tk.id=rf."ticketId" JOIN users u ON u.id=tk."userId" JOIN trips t ON t.id=tk."tripId" JOIN routes r ON r.id=t."routeId" ORDER BY rf."createdAt" DESC`)));
  staff('patch', '/admin/refunds/:id', async (req, res) => {
    const status = choice(req.body.status, ['processing', 'completed', 'rejected', 'failed'], 'Trạng thái hoàn tiền');
    const refund = await db.transaction(async tx => {
      const current = (await tx.query('SELECT * FROM refunds WHERE id=$1 FOR UPDATE', [identifier(req.params.id, 'Yêu cầu hoàn tiền')])).rows[0];
      if (!current) fail(404, 'Không tìm thấy yêu cầu hoàn tiền.');
      const allowed = { requested: ['processing', 'rejected', 'failed'], processing: ['completed', 'failed'], failed: ['processing'] };
      if (!allowed[current.status]?.includes(status)) fail(409, 'Không thể chuyển trạng thái hoàn tiền theo yêu cầu.');
      const updated = (await tx.query(`UPDATE refunds SET status=$1,"processedAt"=CASE WHEN $1 IN ('completed','rejected','failed') THEN $3 ELSE "processedAt" END WHERE id=$2 RETURNING *`, [status, current.id, now()])).rows[0];
      await tx.query('UPDATE tickets SET "refundStatus"=$1 WHERE id=$2', [status, current.ticketId]);
      if (status === 'completed') {
        await tx.query("UPDATE payments SET status='refunded' WHERE id=$1 AND status='paid'", [current.paymentId]);
      }
      await log(tx, req.user.id, 'REFUND', 'refunds', current.id, { status, amount: current.amount });
      return updated;
    });
    res.json(refund);
  });
}
