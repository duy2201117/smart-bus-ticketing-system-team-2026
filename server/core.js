import QRCode from 'qrcode';
import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';
import { id, nowISO, fail, audit, expireHolds, listTrips, getTrip, getTicket, textField, integer } from './domain.js';
import { createPaymentGateway } from './paymentGateway.js';
import { createPrivateStorage } from './privateStorage.js';
import { estimateEta } from './eta.js';

const holdMillis = 10 * 60 * 1000;
const discountRates = { pupil: 10, student: 10, senior: 10 };
const ownTicket = async (db, req, ticketId) => {
  const ticket = await getTicket(db, ticketId);
  if (!ticket) fail(404, 'Không tìm thấy vé.');
  if (ticket.userId !== req.user.id && !['admin', 'manager'].includes(req.user.role)) fail(404, 'Không tìm thấy vé.');
  return ticket;
};

function voucherDiscount(voucher, amount) {
  if (voucher.type === 'fixed') return Math.min(Number(voucher.value), amount);
  return Math.min(Math.floor(amount * Number(voucher.value || voucher.percent) / 100), Number(voucher.maxDiscount || amount));
}

async function checkedVoucher(tx, code, userId, amount) {
  if (!code) return null;
  const voucher = (await tx.query('SELECT * FROM vouchers WHERE code=$1 AND active=1 FOR UPDATE', [code.toUpperCase()])).rows[0];
  if (!voucher) fail(400, 'Mã ưu đãi không tồn tại hoặc đã ngừng hoạt động.');
  const time = nowISO();
  if (voucher.startsAt > time || voucher.expiresAt <= time) fail(400, 'Mã ưu đãi chưa có hiệu lực hoặc đã hết hạn.');
  if (Number(voucher.usedCount) >= Number(voucher.usageLimit)) fail(409, 'Mã ưu đãi đã hết lượt sử dụng.');
  if (amount < Number(voucher.minAmount)) fail(400, `Đơn hàng tối thiểu ${Number(voucher.minAmount).toLocaleString('vi-VN')} VNĐ để dùng mã này.`);
  const uses = Number((await tx.query('SELECT COUNT(*)::int AS total FROM voucher_usages WHERE "voucherId"=$1 AND "userId"=$2', [voucher.id, userId])).rows[0].total);
  if (uses >= Number(voucher.perUserLimit || 1)) fail(409, 'Bạn đã sử dụng mã ưu đãi này đủ số lần cho phép.');
  return voucher;
}


async function completeTicketPayment(tx, { ticket, payment, userId }) {
  const createdAt = nowISO();
  if (ticket.voucherId) {
    const voucher = (await tx.query('SELECT * FROM vouchers WHERE id=$1 FOR UPDATE', [ticket.voucherId])).rows[0];
    const usage = Number((await tx.query('SELECT COUNT(*)::int AS total FROM voucher_usages WHERE "voucherId"=$1 AND "userId"=$2', [ticket.voucherId, userId])).rows[0].total);
    if (!voucher || !voucher.active || voucher.startsAt > createdAt || voucher.expiresAt <= createdAt || Number(voucher.usedCount) >= Number(voucher.usageLimit) || usage >= Number(voucher.perUserLimit || 1)) fail(409, 'Mã ưu đãi không còn đủ điều kiện tại thời điểm xác nhận thanh toán.');
    const existingUsage = (await tx.query('SELECT 1 FROM voucher_usages WHERE "ticketId"=$1', [ticket.id])).rows[0];
    if (!existingUsage) {
      await tx.query('INSERT INTO voucher_usages(id,"voucherId","userId","ticketId","discountAmount","createdAt") VALUES($1,$2,$3,$4,$5,$6)', [id('voucher-use'), ticket.voucherId, userId, ticket.id, Number(ticket.basePrice) - Number(ticket.price), createdAt]);
      await tx.query('UPDATE vouchers SET "usedCount"="usedCount"+1 WHERE id=$1', [ticket.voucherId]);
    }
  }
  await tx.query('UPDATE payments SET status=$1,"updatedAt"=$2 WHERE id=$3', ['paid', createdAt, payment.id]);
  await tx.query('UPDATE tickets SET status=$1,"paidAt"=$2,"paymentMethod"=$3 WHERE id=$4', ['paid', createdAt, payment.method, ticket.id]);
  await tx.query(`UPDATE seat_holds SET status='consumed' WHERE "ticketId"=$1 AND status='active'`, [ticket.id]);
  await tx.query("UPDATE bookings SET status='paid' WHERE id=$1", [ticket.bookingId]);
  const invoiceExists = (await tx.query('SELECT 1 FROM invoices WHERE "ticketId"=$1', [ticket.id])).rows[0];
  if (!invoiceExists) await tx.query('INSERT INTO invoices(id,"ticketId","paymentId",number,amount,subtotal,"discountAmount","createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id('invoice'), ticket.id, payment.id, `HD-${id().slice(-10).toUpperCase()}`, ticket.price, ticket.basePrice, ticket.discountAmount, createdAt]);
  const recipient = (await tx.query('SELECT email FROM users WHERE id=$1', [userId])).rows[0]?.email;
  if (recipient && !(await tx.query('SELECT 1 FROM outbox WHERE "ticketId"=$1 AND subject=$2', [ticket.id, 'Hóa đơn SmartBus'])).rows[0]) {
    await tx.query('INSERT INTO outbox(id,"userId","ticketId",recipient,subject,body,status,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id('mail'), userId, ticket.id, recipient, 'Hóa đơn SmartBus', `Thanh toán thành công · Mã vé ${ticket.code} · Tổng tiền ${Number(ticket.price).toLocaleString('vi-VN')} VNĐ`, 'queued', createdAt]);
  }
  await audit(tx, userId, 'payment.success', 'payments', payment.id, { ticketId: ticket.id, amount: ticket.price, method: payment.method });
}

async function closeFailedPayment(tx, { ticket, payment, status, userId }) {
  const updatedAt = nowISO();
  await tx.query('UPDATE payments SET status=$1,"updatedAt"=$2 WHERE id=$3', [status, updatedAt, payment.id]);
  if (ticket.status === 'held') {
    await tx.query("UPDATE tickets SET status='expired' WHERE id=$1", [ticket.id]);
    await tx.query(`UPDATE seat_holds SET status='expired' WHERE "ticketId"=$1 AND status='active'`, [ticket.id]);
    await tx.query("UPDATE bookings SET status='expired' WHERE id=$1", [ticket.bookingId]);
  }
  await audit(tx, userId, 'payment.failed', 'payments', payment.id, { status });
}

export function registerCore(app, { db, requireAuth, allowRoles, demoMode }) {
  const gateway = createPaymentGateway({ demoMode });
  const privateStorage = createPrivateStorage();
  const passenger = [requireAuth, allowRoles('passenger')];
  app.get('/api/health', (_req, res) => res.json({ ok: true, demoMode }));
  app.get('/api/config', (_req, res) => res.json({ demoMode, paymentMode: gateway.mode, paymentProviders: gateway.providers, refundPolicy: 'Vé hợp lệ được hoàn tiền tự động qua sandbox; production sử dụng adapter merchant cấu hình bằng biến môi trường.' }));

  app.get('/api/vouchers/active', async (_req, res) => {
    const time = nowISO();
    const vouchers = (await db.query(`SELECT code,name,description,type,value,percent,"maxDiscount","minAmount","expiresAt"
      FROM vouchers
      WHERE active=1 AND "startsAt"<=$1 AND "expiresAt">$1 AND "usedCount"<"usageLimit"
      ORDER BY "expiresAt",code`, [time])).rows;
    res.json(vouchers);
  });

  app.get('/api/routes', async (_req, res) => res.json((await db.query('SELECT id,code,name,origin,destination,price,"durationMinutes" FROM routes WHERE active=1 ORDER BY code')).rows));
  app.get('/api/stops', async (_req, res) => res.json((await db.query('SELECT * FROM stops ORDER BY name')).rows));
  app.get('/api/trips', async (req, res) => {
    await expireHolds(db);
    res.json(await listTrips(db, { origin: req.query.origin, destination: req.query.destination, routeId: req.query.routeId, date: req.query.date, time: req.query.time }));
  });
  app.get('/api/trips/:id', async (req, res) => {
    await expireHolds(db);
    const trip = await getTrip(db, req.params.id);
    if (!trip) fail(404, 'Không tìm thấy chuyến xe.');
    const seats = (await db.query(`SELECT s.number AS seat,CASE WHEN tk.status='held' THEN 'held' WHEN tk.status='checked_in' THEN 'checked_in' WHEN tk.status='paid' THEN 'paid' ELSE 'available' END AS status FROM seats s LEFT JOIN tickets tk ON tk."tripId"=$1 AND tk.seat=s.number AND (tk.status IN ('paid','checked_in') OR (tk.status='held' AND tk."holdExpiresAt">$2)) WHERE s."busId"=$3 ORDER BY s.number`, [trip.id, nowISO(), trip.busId])).rows;
    const stops = (await db.query('SELECT s.id,s.name,s.address,s.lat,s.lng,rs."stopOrder" FROM route_stops rs JOIN stops s ON s.id=rs."stopId" WHERE rs."routeId"=$1 ORDER BY rs."stopOrder"', [trip.routeId])).rows;
    res.json({ ...trip, seats, stops, ...estimateEta(trip, stops) });
  });

  app.post('/api/holds', ...passenger, async (req, res) => {
    const tripId = textField(req.body.tripId, 'Chuyến xe', 1, 120);
    const seat = integer(req.body.seat, 'Số ghế', 1, 100);
    const voucherCode = typeof req.body.voucherCode === 'string' ? req.body.voucherCode.trim().toUpperCase() : '';
    const ticket = await db.transaction(async tx => {
      await expireHolds(tx);
      const trip = (await tx.query('SELECT t.*,r.price AS "basePrice",r.active AS "routeActive",b.status AS "busStatus",b."seatCount" FROM trips t JOIN routes r ON r.id=t."routeId" JOIN buses b ON b.id=t."busId" WHERE t.id=$1 FOR UPDATE', [tripId])).rows[0];
      if (!trip) fail(404, 'Không tìm thấy chuyến xe.');
      if (trip.status !== 'scheduled' || Date.parse(trip.departureTime) <= Date.now() || !trip.routeActive || trip.busStatus !== 'active') fail(409, 'Chuyến xe hiện không nhận đặt chỗ.');
      if (seat > Number(trip.seatCount) || !(await tx.query('SELECT 1 FROM seats WHERE "busId"=$1 AND number=$2', [trip.busId, seat])).rows.length) fail(400, 'Số ghế không hợp lệ với xe này.');
      const occupied = (await tx.query(`SELECT 1 FROM tickets WHERE "tripId"=$1 AND seat=$2 AND (status IN ('paid','checked_in') OR (status='held' AND "holdExpiresAt">$3))`, [tripId, seat, nowISO()])).rows[0];
      if (occupied) fail(409, 'Ghế vừa được người khác giữ hoặc đặt. Vui lòng chọn ghế khác.');
      const user = (await tx.query('SELECT * FROM users WHERE id=$1 AND active=1', [req.user.id])).rows[0];
      const subtotal = Number(trip.basePrice);
      let amount = subtotal;
      if (user.discountStatus === 'approved' && discountRates[user.discountType]) amount -= Math.floor(amount * discountRates[user.discountType] / 100);
      const voucher = await checkedVoucher(tx, voucherCode, user.id, amount);
      if (voucher) amount -= voucherDiscount(voucher, amount);
      const expiresAt = new Date(Date.now() + holdMillis).toISOString();
      const bookingId = id('booking'), ticketId = id('ticket'), createdAt = nowISO();
      await tx.query('INSERT INTO bookings(id,"userId",status,total,subtotal,"discountAmount","voucherId","createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [bookingId, user.id, 'held', amount, subtotal, subtotal - amount, voucher?.id || null, createdAt]);
      const code = `SB-${id().slice(-12).toUpperCase()}`;
      const saved = (await tx.query('INSERT INTO tickets(id,"userId","tripId","bookingId",seat,status,price,"basePrice","discountAmount",code,"holdExpiresAt","createdAt","voucherId") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *', [ticketId, user.id, tripId, bookingId, seat, 'held', amount, subtotal, subtotal - amount, code, expiresAt, createdAt, voucher?.id || null])).rows[0];
      await tx.query('INSERT INTO seat_holds(id,"ticketId","tripId",seat,"userId","expiresAt",status) VALUES($1,$2,$3,$4,$5,$6,$7)', [id('hold'), ticketId, tripId, seat, user.id, expiresAt, 'active']);
      await audit(tx, user.id, 'hold.create', 'tickets', ticketId, { tripId, seat, expiresAt });
      return saved;
    });
    res.status(201).json(ticket);
  });

  app.post('/api/holds/:id/release', ...passenger, async (req, res) => {
    await db.transaction(async tx => {
      const ticket = (await tx.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [req.params.id])).rows[0];
      if (!ticket || ticket.userId !== req.user.id) fail(404, 'Không tìm thấy lượt giữ chỗ.');
      if (ticket.status !== 'held') fail(409, 'Lượt giữ chỗ không còn hiệu lực.');
      await tx.query("UPDATE tickets SET status='expired' WHERE id=$1", [ticket.id]);
      await tx.query("UPDATE seat_holds SET status='released' WHERE \"ticketId\"=$1 AND status='active'", [ticket.id]);
      await tx.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [ticket.bookingId]);
      await audit(tx, req.user.id, 'hold.release', 'tickets', ticket.id);
    });
    res.json({ ok: true });
  });

  app.post('/api/payments', ...passenger, async (req, res) => {
    const ticketId = textField(req.body.ticketId, 'Vé', 1, 120);
    const method = req.body.method === 'card' ? 'bank' : req.body.method;
    const outcome = req.body.outcome || 'success';
    const idempotencyKey = textField(req.body.idempotencyKey || req.get('Idempotency-Key') || id('attempt'), 'Mã giao dịch', 8, 200);
    const existingTicket = await getTicket(db, ticketId);
    if (!existingTicket || existingTicket.userId !== req.user.id) fail(404, 'Không tìm thấy lượt giữ chỗ.');
    const charge = await gateway.charge({ method, outcome, amount: Number(existingTicket.price) });
    const result = await db.transaction(async tx => {
      const duplicate = (await tx.query('SELECT * FROM payments WHERE "idempotencyKey"=$1 FOR UPDATE', [idempotencyKey])).rows[0];
      if (duplicate) {
        if (duplicate.userId !== req.user.id || duplicate.ticketId !== ticketId) fail(409, 'Mã giao dịch đã được dùng cho yêu cầu khác.');
        return { ticket: await getTicket(tx, ticketId), payment: duplicate, message: duplicate.status === 'paid' ? 'Giao dịch đã được xác nhận trước đó.' : 'Giao dịch này đã được xử lý.' };
      }
      const ticket = (await tx.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [ticketId])).rows[0];
      if (!ticket || ticket.userId !== req.user.id) fail(404, 'Không tìm thấy vé.');
      if (ticket.status === 'paid' || ticket.status === 'checked_in') return { ticket: await getTicket(tx, ticketId), payment: null, message: 'Vé đã được thanh toán trước đó.' };
      if (ticket.status !== 'held' || !ticket.holdExpiresAt || Date.parse(ticket.holdExpiresAt) <= Date.now()) fail(409, 'Thời gian giữ ghế đã hết. Vui lòng chọn lại ghế.');
      const paymentId = id('payment'), createdAt = nowISO();
      const payment = (await tx.query('INSERT INTO payments(id,"ticketId","bookingId","userId",amount,method,status,reference,"idempotencyKey","providerPayload","createdAt","updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11) RETURNING *', [paymentId, ticket.id, ticket.bookingId, ticket.userId, ticket.price, method, charge.status, charge.reference, idempotencyKey, JSON.stringify({ provider: charge.provider, sandbox: charge.sandbox, redirectUrl: charge.redirectUrl }), createdAt])).rows[0];
      if (charge.status === 'pending') {
        await audit(tx, req.user.id, 'payment.pending', 'payments', payment.id, { ticketId: ticket.id, amount: ticket.price, provider: method });
        return { ticket: await getTicket(tx, ticket.id), payment, sandboxCallback: demoMode ? { provider: method, reference: payment.reference, successSignature: gateway.signCallback({ provider: method, reference: payment.reference, status: 'paid' }), failedSignature: gateway.signCallback({ provider: method, reference: payment.reference, status: 'failed' }) } : null, message: 'Giao dịch đang chờ callback xác nhận. Ghế vẫn được giữ trong thời gian còn lại.' };
      }
      if (charge.status !== 'paid') {
        await closeFailedPayment(tx, { ticket, payment, status: charge.status, userId: req.user.id });
        return { ticket: await getTicket(tx, ticket.id), payment: { ...payment, status: charge.status }, message: outcome === 'cancelled' ? 'Bạn đã hủy giao dịch. Ghế đã được trả.' : 'Thanh toán thất bại. Ghế đã được trả.' };
      }
      await completeTicketPayment(tx, { ticket, payment, userId: req.user.id });
      return { ticket: await getTicket(tx, ticket.id), payment: { ...payment, status: 'paid' }, message: 'Thanh toán thành công. Vé điện tử và hóa đơn đã sẵn sàng.' };
    });
    res.json(result);
  });

  app.post('/api/payments/webhook/:provider', async (req, res) => {
    const provider = String(req.params.provider || '').toLowerCase();
    const reference = textField(req.body.reference, 'Mã tham chiếu', 4, 160);
    const status = String(req.body.status || '').toLowerCase();
    const signature = req.get('x-smartbus-signature') || req.body.signature;
    gateway.verifyCallback({ provider, reference, status, signature });
    const result = await db.transaction(async tx => {
      const payment = (await tx.query('SELECT * FROM payments WHERE reference=$1 FOR UPDATE', [reference])).rows[0];
      if (!payment) fail(404, 'Không tìm thấy giao dịch callback.');
      if (payment.method !== provider) fail(409, 'Callback không đúng nhà cung cấp của giao dịch.');
      if (['paid', 'refunded'].includes(payment.status)) return { payment, ticket: payment.ticketId ? await getTicket(tx, payment.ticketId) : null, idempotent: true };
      if (['failed', 'cancelled'].includes(payment.status)) return { payment, ticket: payment.ticketId ? await getTicket(tx, payment.ticketId) : null, idempotent: true };
      const ticket = payment.ticketId ? (await tx.query('SELECT * FROM tickets WHERE id=$1 FOR UPDATE', [payment.ticketId])).rows[0] : null;
      if (!ticket) fail(409, 'Giao dịch không gắn với vé hợp lệ.');
      if (status === 'paid') {
        if (ticket.status !== 'held' || !ticket.holdExpiresAt || Date.parse(ticket.holdExpiresAt) <= Date.now()) {
          await closeFailedPayment(tx, { ticket, payment, status: 'failed', userId: payment.userId });
          fail(409, 'Callback đến sau khi lượt giữ ghế đã hết hạn.');
        }
        await completeTicketPayment(tx, { ticket, payment, userId: payment.userId });
      } else {
        await closeFailedPayment(tx, { ticket, payment, status, userId: payment.userId });
      }
      await tx.query('UPDATE payments SET "providerPayload"=$1 WHERE id=$2', [JSON.stringify({ provider, reference, status, receivedAt: nowISO() }), payment.id]);
      return { payment: (await tx.query('SELECT * FROM payments WHERE id=$1', [payment.id])).rows[0], ticket: await getTicket(tx, ticket.id), idempotent: false };
    });
    res.json(result);
  });

  app.get('/api/tickets', ...passenger, async (req, res) => {
    await expireHolds(db);
    res.json((await db.query(`SELECT tk.*,t."departureTime",t."arrivalTime",t."routeId",r.name AS "routeName",r.origin,r.destination,b.plate FROM tickets tk JOIN trips t ON t.id=tk."tripId" JOIN routes r ON r.id=t."routeId" JOIN buses b ON b.id=t."busId" WHERE tk."userId"=$1 ORDER BY tk."createdAt" DESC`, [req.user.id])).rows);
  });
  app.get('/api/tickets/:id/qr', ...passenger, async (req, res) => {
    const ticket = await ownTicket(db, req, req.params.id);
    if (!['paid', 'checked_in'].includes(ticket.status)) fail(409, 'Mã QR chỉ có hiệu lực với vé đã thanh toán.');
    res.json({ code: ticket.code, dataUrl: await QRCode.toDataURL(ticket.code, { errorCorrectionLevel: 'M', margin: 2, width: 320 }) });
  });
  app.get('/api/tickets/:id/invoice', ...passenger, async (req, res) => {
    const ticket = await ownTicket(db, req, req.params.id);
    const invoice = (await db.query('SELECT i.*,p.method,p.reference FROM invoices i JOIN payments p ON p.id=i."paymentId" WHERE i."ticketId"=$1', [ticket.id])).rows[0];
    if (!invoice) fail(404, 'Hóa đơn chưa được phát hành.');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Hoa-don-SmartBus-${ticket.id}.pdf"`);
    const pdf = new PDFDocument({ margin: 52, size: 'A4' });
    const fontPath = ['C:/Windows/Fonts/arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', '/Library/Fonts/Arial.ttf'].find(existsSync);
    if (fontPath) pdf.font(fontPath);
    pdf.pipe(res);
    const formatMoney = value => `${Number(value).toLocaleString('vi-VN')} VNĐ`;
    pdf.fillColor('#087657').fontSize(20).text('HÓA ĐƠN ĐIỆN TỬ SMARTBUS');
    pdf.moveDown().fillColor('#20352e').fontSize(11).text(`Mã hóa đơn: ${invoice.number}`);
    pdf.text(`Thời gian thanh toán: ${new Date(invoice.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
    pdf.text(`Khách hàng: ${ticket.passengerName} · ${ticket.passengerEmail}`);
    pdf.moveDown().fontSize(13).text('Thông tin hành trình');
    pdf.fontSize(11).text(`Tuyến: ${ticket.routeName} · ${ticket.origin} → ${ticket.destination}`);
    pdf.text(`Khởi hành: ${new Date(ticket.departureTime).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`);
    pdf.text(`Ghế ${ticket.seat} · Mã vé ${ticket.code} · Xe ${ticket.plate}`);
    pdf.moveDown().fontSize(13).text('Chi tiết thanh toán');
    pdf.fontSize(11).text(`Giá vé: ${formatMoney(invoice.subtotal || ticket.basePrice)}`);
    pdf.text(`Giảm giá: -${formatMoney(invoice.discountAmount || ticket.discountAmount)}`);
    pdf.text(`Phương thức: ${invoice.method}`);
    pdf.moveDown().fillColor('#087657').fontSize(15).text(`TỔNG THANH TOÁN: ${formatMoney(invoice.amount)}`);
    pdf.moveDown().fillColor('#66766e').fontSize(9).text('SmartBus · Hệ thống bán vé xe buýt thông minh');
    pdf.end();
  });
  app.post('/api/tickets/:id/email', ...passenger, async (req, res) => {
    const ticket = await ownTicket(db, req, req.params.id);
    await db.query('INSERT INTO outbox(id,"userId","ticketId",recipient,subject,body,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7)', [id('mail'), req.user.id, ticket.id, ticket.passengerEmail, 'Hóa đơn SmartBus', `Mã vé ${ticket.code} · ${ticket.routeName} · Ghế ${ticket.seat}`, nowISO()]);
    res.json({ message: 'Đã đưa hóa đơn vào hộp thư mô phỏng.' });
  });
  app.post('/api/tickets/:id/cancel', ...passenger, async (req, res) => {
    const result = await db.transaction(async tx => {
      const current = (await tx.query('SELECT tk.*,t."departureTime" FROM tickets tk JOIN trips t ON t.id=tk."tripId" WHERE tk.id=$1 FOR UPDATE', [req.params.id])).rows[0];
      if (!current || current.userId !== req.user.id) fail(404, 'Không tìm thấy vé.');
      if (current.status !== 'paid' || Date.parse(current.departureTime) <= Date.now()) fail(409, 'Vé không đủ điều kiện hủy.');
      const reason = typeof req.body.reason === 'string' ? req.body.reason.trim().slice(0, 500) : '';
      if (reason.length < 3) fail(400, 'Vui lòng nhập lý do hủy vé.');
      const payment = (await tx.query("SELECT * FROM payments WHERE \"ticketId\"=$1 AND status='paid' ORDER BY \"createdAt\" DESC LIMIT 1 FOR UPDATE", [current.id])).rows[0];
      if (!payment) fail(409, 'Không tìm thấy giao dịch đã thanh toán để hoàn tiền.');
      const existingRefund = (await tx.query('SELECT * FROM refunds WHERE "ticketId"=$1 FOR UPDATE', [current.id])).rows[0];
      if (existingRefund) fail(409, 'Vé đã có yêu cầu hoàn tiền trước đó.');
      const refundResult = await gateway.refund({ method: payment.method, reference: payment.reference, amount: Number(current.price), outcome: req.body.refundOutcome || 'success' });
      const refundStatus = refundResult.status;
      await tx.query('UPDATE tickets SET status=$1,"refundStatus"=$2,"cancelReason"=$3 WHERE id=$4', ['cancelled', refundStatus, reason, current.id]);
      await tx.query("UPDATE bookings SET status='cancelled' WHERE id=$1", [current.bookingId]);
      if (refundStatus === 'completed') await tx.query("UPDATE payments SET status='refunded',\"updatedAt\"=$2 WHERE id=$1", [payment.id, refundResult.processedAt]);
      const refund = (await tx.query('INSERT INTO refunds(id,"ticketId","paymentId",amount,status,reference,"providerStatus","processedAt","createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [id('refund'), current.id, payment.id, current.price, refundStatus, refundResult.reference, refundResult.status, refundResult.processedAt, nowISO()])).rows[0];
      await audit(tx, req.user.id, 'REFUND', 'refunds', refund.id, { reason, amount: current.price, status: refundStatus, provider: payment.method, automatic: true });
      return { ticket: await getTicket(tx, current.id), refund };
    });
    res.json({ ...result.ticket, refund: result.refund, message: result.refund.status === 'completed' ? 'Hủy vé thành công. Hoàn tiền sandbox đã hoàn tất tự động.' : 'Hủy vé thành công nhưng hoàn tiền chưa hoàn tất.' });
  });
  app.post('/api/tickets/:id/change', ...passenger, async (req, res) => {
    const tripId = textField(req.body.tripId, 'Chuyến mới', 1, 120), seat = integer(req.body.seat, 'Số ghế', 1, 100);
    const ticket = await db.transaction(async tx => {
      const current = (await tx.query('SELECT tk.*,t."departureTime",t."routeId" AS "oldRouteId",r.price AS "oldPrice" FROM tickets tk JOIN trips t ON t.id=tk."tripId" JOIN routes r ON r.id=t."routeId" WHERE tk.id=$1 FOR UPDATE', [req.params.id])).rows[0];
      if (!current || current.userId !== req.user.id) fail(404, 'Không tìm thấy vé.');
      if (current.status !== 'paid' || Date.parse(current.departureTime) <= Date.now()) fail(409, 'Vé không đủ điều kiện đổi.');
      const next = (await tx.query('SELECT t.*,r.price,b."seatCount",b.status AS "busStatus" FROM trips t JOIN routes r ON r.id=t."routeId" JOIN buses b ON b.id=t."busId" WHERE t.id=$1 FOR UPDATE', [tripId])).rows[0];
      if (!next || next.status !== 'scheduled' || next.busStatus !== 'active' || Date.parse(next.departureTime) <= Date.now() || next.routeId !== current.oldRouteId || Number(next.price) !== Number(current.oldPrice)) fail(409, 'Chuyến mới phải cùng tuyến, cùng giá và còn nhận đặt chỗ.');
      if (seat > Number(next.seatCount) || !(await tx.query('SELECT 1 FROM seats WHERE "busId"=$1 AND number=$2', [next.busId, seat])).rows.length) fail(400, 'Ghế mới không hợp lệ.');
      if ((await tx.query(`SELECT 1 FROM tickets WHERE "tripId"=$1 AND seat=$2 AND status IN ('paid','checked_in')`, [tripId, seat])).rows.length) fail(409, 'Ghế mới vừa được người khác đặt.');
      const newCode = `SB-${id().slice(-12).toUpperCase()}`;
      await tx.query('INSERT INTO ticket_changes(id,"ticketId","fromTripId","toTripId","fromSeat","toSeat",status,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id('change'), current.id, current.tripId, tripId, current.seat, seat, 'completed', nowISO()]);
      await tx.query('UPDATE tickets SET "tripId"=$1,seat=$2,code=$3,"changedAt"=$4 WHERE id=$5', [tripId, seat, newCode, nowISO(), current.id]);
      await audit(tx, req.user.id, 'ticket.change', 'tickets', current.id, { oldTripId: current.tripId, tripId, oldSeat: current.seat, seat });
      return await getTicket(tx, current.id);
    });
    res.json(ticket);
  });

  app.get('/api/passes', ...passenger, async (req, res) => res.json((await db.query('SELECT p.*,r.name AS "routeName" FROM monthly_passes p JOIN routes r ON r.id=p."routeId" WHERE p."userId"=$1 ORDER BY p."createdAt" DESC', [req.user.id])).rows));
  app.post('/api/passes', ...passenger, async (req, res) => {
    const routeId = textField(req.body.routeId, 'Tuyến đường', 1, 120);
    const requestKey = textField(req.body.idempotencyKey || req.get('Idempotency-Key') || id('request'), 'Mã yêu cầu', 8, 200);
    const pass = await db.transaction(async tx => {
      const existingPayment = (await tx.query('SELECT * FROM payments WHERE "userId"=$1 AND "idempotencyKey"=$2', [req.user.id, `pass-purchase:${requestKey}`])).rows[0];
      if (existingPayment) return (await tx.query('SELECT p.*,r.name AS "routeName" FROM monthly_passes p JOIN routes r ON r.id=p."routeId" WHERE p."bookingId"=$1', [existingPayment.bookingId])).rows[0];
      const route = (await tx.query('SELECT * FROM routes WHERE id=$1 AND active=1', [routeId])).rows[0];
      if (!route) fail(404, 'Không tìm thấy tuyến xe đang hoạt động.');
      const user = (await tx.query('SELECT * FROM users WHERE id=$1', [req.user.id])).rows[0];
      const price = Math.floor(Number(route.price) * 20 * (user.discountStatus === 'approved' && discountRates[user.discountType] ? 1 - discountRates[user.discountType] / 100 : 1));
      const createdAt = nowISO(), start = new Date(), end = new Date(start.getTime() + 30 * 86400000);
      const bookingId = id('booking'), paymentId = id('payment');
      await tx.query('INSERT INTO bookings(id,"userId",status,total,"createdAt") VALUES($1,$2,$3,$4,$5)', [bookingId, user.id, 'paid', price, createdAt]);
      const passId = id('pass');
      const saved = (await tx.query('INSERT INTO monthly_passes(id,code,"userId","routeId","startDate","endDate",price,status,"bookingId","createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *', [passId, `MV-${id().slice(-10).toUpperCase()}`, user.id, route.id, start.toISOString(), end.toISOString(), price, 'active', bookingId, createdAt])).rows[0];
      await tx.query('INSERT INTO payments(id,"bookingId","userId",amount,method,status,reference,"idempotencyKey","createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [paymentId, bookingId, user.id, price, 'demo_pass', 'paid', id('DEMO'), `pass-purchase:${requestKey}`, createdAt]);
      await tx.query('INSERT INTO invoices(id,"paymentId",number,amount,"createdAt") VALUES($1,$2,$3,$4,$5)', [id('invoice'), paymentId, `HD-${id().slice(-10).toUpperCase()}`, price, createdAt]);
      await audit(tx, user.id, 'pass.purchase', 'monthly_passes', saved.id, { routeId: route.id, price });
      return { ...saved, routeName: route.name };
    });
    res.status(201).json(pass);
  });
  app.post('/api/passes/:id/renew', ...passenger, async (req, res) => {
    if (gateway.mode !== 'sandbox') fail(503, 'Chưa cấu hình thanh toán vé tháng.');
    const requestKey = textField(req.body.idempotencyKey || req.get('Idempotency-Key') || id('request'), 'Mã yêu cầu', 8, 200);
    const pass = await db.transaction(async tx => {
      const current = (await tx.query('SELECT * FROM monthly_passes WHERE id=$1 AND "userId"=$2 FOR UPDATE', [req.params.id, req.user.id])).rows[0];
      if (!current) fail(404, 'Không tìm thấy vé tháng.');
      const idempotencyKey = `pass-renew:${current.id}:${requestKey}`;
      const previous = (await tx.query('SELECT * FROM payments WHERE "userId"=$1 AND "idempotencyKey"=$2', [req.user.id, idempotencyKey])).rows[0];
      if (previous) return current;
      const charge = await gateway.charge({ method: 'bank', outcome: 'success', amount: Number(current.price) });
      const start = new Date(Math.max(Date.now(), Date.parse(current.endDate))), end = new Date(start.getTime() + 30 * 86400000);
      const bookingId = id('booking'), paymentId = id('payment'), createdAt = nowISO();
      await tx.query('INSERT INTO bookings(id,"userId",status,total,subtotal,"createdAt") VALUES($1,$2,$3,$4,$4,$5)', [bookingId, req.user.id, 'paid', current.price, createdAt]);
      await tx.query('INSERT INTO payments(id,"bookingId","userId",amount,method,status,reference,"idempotencyKey","createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [paymentId, bookingId, req.user.id, current.price, charge.method, charge.status, charge.reference, idempotencyKey, createdAt]);
      await tx.query('INSERT INTO invoices(id,"paymentId",number,amount,subtotal,"createdAt") VALUES($1,$2,$3,$4,$4,$5)', [id('invoice'), paymentId, `HD-${id().slice(-10).toUpperCase()}`, current.price, createdAt]);
      const saved = (await tx.query('UPDATE monthly_passes SET "startDate"=$1,"endDate"=$2,status=$3,"bookingId"=$4 WHERE id=$5 RETURNING *', [start.toISOString(), end.toISOString(), 'active', bookingId, current.id])).rows[0];
      await audit(tx, req.user.id, 'pass.renew', 'monthly_passes', saved.id, { bookingId, amount: current.price });
      return saved;
    });
    res.json(pass);
  });

  app.post('/api/profile/discount-evidence', ...passenger, async (req, res) => {
    const fileName = textField(req.body.fileName, 'Tên tệp', 1, 180);
    const mimeType = textField(req.body.mimeType, 'Loại tệp', 3, 100);
    const savedFile = await privateStorage.saveBase64({ fileName, mimeType, dataBase64: req.body.dataBase64 });
    const record = (await db.query('INSERT INTO private_files(id,"userId",kind,"originalName","mimeType","sizeBytes","storagePath","createdAt") VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id,"originalName","mimeType","sizeBytes","createdAt"', [id('file'), req.user.id, 'discount-evidence', savedFile.originalName, savedFile.mimeType, savedFile.sizeBytes, savedFile.storagePath, nowISO()])).rows[0];
    await audit(db, req.user.id, 'discount.evidence.upload', 'private_files', record.id, { sizeBytes: record.sizeBytes, mimeType: record.mimeType });
    res.status(201).json(record);
  });

  app.get('/api/private-files/:id', requireAuth, async (req, res) => {
    const file = (await db.query('SELECT * FROM private_files WHERE id=$1', [req.params.id])).rows[0];
    if (!file) fail(404, 'Không tìm thấy tệp minh chứng.');
    if (file.userId !== req.user.id && !['admin', 'manager'].includes(req.user.role)) fail(403, 'Bạn không có quyền xem tệp này.');
    const content = await privateStorage.read(file.storagePath);
    res.setHeader('Content-Type', file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.originalName)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(content);
  });

  app.post('/api/profile/discount', ...passenger, async (req, res) => {
    const type = req.body.discountType;
    if (!Object.hasOwn(discountRates, type)) fail(400, 'Đối tượng ưu đãi không hợp lệ.');
    const evidenceText = typeof req.body.discountEvidence === 'string' ? req.body.discountEvidence.trim().slice(0, 2000) : '';
    const evidenceFileId = typeof req.body.evidenceFileId === 'string' && req.body.evidenceFileId.trim() ? textField(req.body.evidenceFileId, 'Tệp minh chứng', 1, 120) : null;
    if (evidenceText.length < 3 && !evidenceFileId) fail(400, 'Vui lòng nhập mô tả hoặc tải tệp minh chứng.');
    const user = await db.transaction(async tx => {
      const current = (await tx.query('SELECT * FROM users WHERE id=$1 FOR UPDATE', [req.user.id])).rows[0];
      if (current.discountStatus === 'approved') fail(409, 'Hồ sơ đã được duyệt. Liên hệ quản lý nếu cần thay đổi.');
      if (evidenceFileId) {
        const file = (await tx.query('SELECT * FROM private_files WHERE id=$1 AND "userId"=$2 AND kind=$3', [evidenceFileId, current.id, 'discount-evidence'])).rows[0];
        if (!file) fail(400, 'Tệp minh chứng không hợp lệ hoặc không thuộc tài khoản này.');
      }
      const evidence = evidenceText || 'Minh chứng được đính kèm trong tệp riêng tư.';
      await tx.query("UPDATE users SET \"discountType\"=$1,\"discountStatus\"='pending',\"discountEvidence\"=$2 WHERE id=$3", [type, evidence, current.id]);
      await tx.query("UPDATE discount_profiles SET status='rejected' WHERE \"userId\"=$1 AND status='pending'", [current.id]);
      await tx.query('INSERT INTO discount_profiles(id,"userId","discountType","discountEvidence","evidenceFileId",status,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7)', [id('discount'), current.id, type, evidence, evidenceFileId, 'pending', nowISO()]);
      await audit(tx, current.id, 'discount.submit', 'users', current.id, { type, evidenceFileId });
      return (await tx.query('SELECT id,name,email,role,phone,"discountType","discountStatus","discountEvidence",active,"createdAt" FROM users WHERE id=$1', [current.id])).rows[0];
    });
    res.json({ user });
  });
  app.get('/api/notifications', requireAuth, async (req, res) => res.json((await db.query('SELECT * FROM notifications WHERE "userId"=$1 ORDER BY "createdAt" DESC LIMIT 200', [req.user.id])).rows));
  app.post('/api/notifications/:id/read', requireAuth, async (req, res) => {
    const result = await db.query('UPDATE notifications SET read=1 WHERE id=$1 AND "userId"=$2', [req.params.id, req.user.id]);
    if (!result.rowCount) fail(404, 'Không tìm thấy thông báo.');
    res.json({ ok: true });
  });
  app.get('/api/feedback', ...passenger, async (req, res) => res.json((await db.query('SELECT f.*,r.name AS "routeName" FROM feedback f JOIN trips t ON t.id=f."tripId" JOIN routes r ON r.id=t."routeId" WHERE f."userId"=$1 ORDER BY f."createdAt" DESC', [req.user.id])).rows));
  app.post('/api/feedback', ...passenger, async (req, res) => {
    const tripId = textField(req.body.tripId, 'Chuyến xe', 1, 120), rating = integer(req.body.rating, 'Điểm đánh giá', 1, 5), message = textField(req.body.message, 'Nội dung đánh giá', 1, 2000);
    const feedback = await db.transaction(async tx => {
      if (!(await tx.query("SELECT 1 FROM tickets WHERE \"userId\"=$1 AND \"tripId\"=$2 AND status IN ('paid','checked_in')", [req.user.id, tripId])).rows.length) fail(403, 'Chỉ hành khách đã mua vé chuyến này mới được đánh giá.');
      if ((await tx.query('SELECT 1 FROM feedback WHERE "userId"=$1 AND "tripId"=$2', [req.user.id, tripId])).rows.length) fail(409, 'Bạn đã gửi đánh giá cho chuyến này.');
      return (await tx.query('INSERT INTO feedback(id,"userId","tripId",rating,message,status,"createdAt") VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *', [id('feedback'), req.user.id, tripId, rating, message, 'open', nowISO()])).rows[0];
    });
    res.status(201).json(feedback);
  });

  app.get('/api/complaints', ...passenger, async (req, res) => res.json((await db.query('SELECT * FROM complaints WHERE "userId"=$1 ORDER BY "createdAt" DESC', [req.user.id])).rows));
  app.post('/api/complaints', ...passenger, async (req, res) => {
    const category = textField(req.body.category, 'Danh mục', 2, 60), content = textField(req.body.content, 'Nội dung', 2, 3000);
    const tripId = req.body.tripId ? textField(req.body.tripId, 'Chuyến xe', 1, 120) : null;
    const complaint = (await db.query('INSERT INTO complaints(id,"userId","tripId",category,content,status,"createdAt","updatedAt") VALUES($1,$2,$3,$4,$5,$6,$7,$7) RETURNING *', [id('complaint'), req.user.id, tripId, category, content, 'open', nowISO()])).rows[0];
    res.status(201).json(complaint);
  });
  app.get('/api/admin/complaints', requireAuth, allowRoles('admin', 'manager'), async (_req, res) => res.json((await db.query('SELECT c.*,u.name AS "userName" FROM complaints c JOIN users u ON u.id=c."userId" ORDER BY c."createdAt" DESC')).rows));
  app.patch('/api/admin/complaints/:id', requireAuth, allowRoles('admin', 'manager'), async (req, res) => {
    const response = textField(req.body.response, 'Nội dung phản hồi', 2, 3000);
    const status = req.body.status;
    if (!['processing', 'resolved', 'rejected'].includes(status)) fail(400, 'Trạng thái phản ánh không hợp lệ.');
    const result = await db.query('UPDATE complaints SET response=$1,status=$2,"updatedAt"=$3 WHERE id=$4 RETURNING *', [response, status, nowISO(), req.params.id]);
    if (!result.rows[0]) fail(404, 'Không tìm thấy phản ánh.');
    await audit(db, req.user.id, 'complaint.update', 'complaints', req.params.id, { status });
    res.json(result.rows[0]);
  });
}