import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const prefix = 'SBQR1';

function key() {
  const secret = process.env.QR_SECRET || 'smartbus-demo-ticket-qr-secret-change-in-production';
  return createHash('sha256').update(secret).digest();
}

export function encodeTicketQr({ code, ticketId, tripId }) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const plaintext = Buffer.from(JSON.stringify({ v: 1, code, ticketId, tripId, iat: Date.now() }), 'utf8');
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [prefix, iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decodeTicketQr(value) {
  if (typeof value !== 'string' || !value.startsWith(`${prefix}.`)) return null;
  const parts = value.split('.');
  if (parts.length !== 4) throw new Error('Mã QR không hợp lệ.');
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const encrypted = Buffer.from(parts[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || encrypted.length === 0) throw new Error('invalid');
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    const payload = JSON.parse(plaintext);
    if (payload?.v !== 1 || !payload.code || !payload.ticketId || !payload.tripId) throw new Error('invalid');
    return payload;
  } catch {
    throw new Error('Mã QR không hợp lệ.');
  }
}
