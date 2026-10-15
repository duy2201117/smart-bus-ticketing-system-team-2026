import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaymentGateway } from './paymentGateway.js';

for (const provider of ['momo', 'vnpay', 'zalopay', 'bank']) {
  test(`sandbox gateway ${provider}: charge, signed callback and refund`, async () => {
    const gateway = createPaymentGateway({ demoMode: true, webhookSecret: 'unit-test-secret' });
    const pending = await gateway.charge({ method: provider, outcome: 'pending', amount: 123456 });
    assert.equal(pending.status, 'pending');
    assert.equal(pending.provider, provider);
    assert.ok(pending.reference.startsWith(provider.toUpperCase()));
    const signature = gateway.signCallback({ provider, reference: pending.reference, status: 'paid' });
    assert.deepEqual(gateway.verifyCallback({ provider, reference: pending.reference, status: 'paid', signature }), { provider, reference: pending.reference, status: 'paid' });
    assert.throws(() => gateway.verifyCallback({ provider, reference: pending.reference, status: 'paid', signature: 'tampered' }), /Chữ ký callback/);
    const refund = await gateway.refund({ method: provider, reference: pending.reference, amount: 123456, outcome: 'success' });
    assert.equal(refund.status, 'completed');
    assert.equal(refund.amount, 123456);
    assert.ok(refund.reference.startsWith('RF-'));
  });
}
