import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { fail } from './domain.js';

const methods = ['momo', 'vnpay', 'zalopay', 'bank'];
const outcomes = ['success', 'pending', 'failed', 'cancelled'];
const callbackStatuses = ['paid', 'failed', 'cancelled'];
const makeReference = provider => `${provider.toUpperCase()}-${randomUUID().replaceAll('-', '').slice(0, 24)}`;

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Payment abstraction used by the application.
 *
 * - In demo mode it behaves like a deterministic sandbox for MoMo, VNPay,
 *   ZaloPay and bank card and supports signed webhooks.
 * - In non-demo mode browser supplied outcomes are rejected. Real provider
 *   credentials/adapters can be connected without changing booking logic.
 */
export function createPaymentGateway({ demoMode, webhookSecret = process.env.PAYMENT_WEBHOOK_SECRET || 'smartbus-demo-webhook-secret-change-me' }) {
  const signCallback = ({ provider, reference, status }) => createHmac('sha256', webhookSecret).update(`${provider}|${reference}|${status}`).digest('hex');
  return {
    mode: demoMode ? 'sandbox' : 'external-required',
    providers: methods,
    async charge({ method, outcome, amount }) {
      if (!methods.includes(method)) fail(400, 'Phương thức thanh toán không hợp lệ.');
      if (!demoMode) fail(503, 'Cổng thanh toán production chưa có merchant credential. Hãy cấu hình adapter nhà cung cấp.');
      if (!outcomes.includes(outcome)) fail(400, 'Kết quả mô phỏng không hợp lệ.');
      const reference = makeReference(method);
      const status = outcome === 'success' ? 'paid' : outcome;
      return {
        status,
        amount,
        method,
        reference,
        provider: method,
        sandbox: true,
        redirectUrl: `/payment-result?provider=${encodeURIComponent(method)}&reference=${encodeURIComponent(reference)}`,
        callbackSignature: status === 'pending' ? signCallback({ provider: method, reference, status: 'paid' }) : null,
      };
    },
    signCallback,
    verifyCallback({ provider, reference, status, signature }) {
      if (!methods.includes(provider)) fail(400, 'Nhà cung cấp thanh toán không hợp lệ.');
      if (!callbackStatuses.includes(status)) fail(400, 'Trạng thái callback không hợp lệ.');
      const expected = signCallback({ provider, reference, status });
      if (!safeEqual(expected, signature)) fail(401, 'Chữ ký callback thanh toán không hợp lệ.');
      return { provider, reference, status };
    },
    async refund({ method, reference, amount, outcome = 'success' }) {
      if (!methods.includes(method)) fail(400, 'Phương thức hoàn tiền không hợp lệ.');
      if (!demoMode) fail(503, 'Hoàn tiền production chưa có merchant credential. Hãy cấu hình adapter nhà cung cấp.');
      if (!['success', 'failed'].includes(outcome)) fail(400, 'Kết quả hoàn tiền mô phỏng không hợp lệ.');
      return {
        status: outcome === 'success' ? 'completed' : 'failed',
        amount,
        provider: method,
        paymentReference: reference,
        reference: `RF-${makeReference(method)}`,
        processedAt: new Date().toISOString(),
        sandbox: true,
      };
    },
  };
}
