import test from 'node:test';
import assert from 'node:assert/strict';
import { findCandidatesForTxn, findInvoiceCombinations } from './rules.js';

function mockInvoice(id, number, email, amount, openAmount = amount, paidAmount = 0) {
  return {
    id,
    number,
    customer_name: 'Test Customer',
    customer_email: email,
    amount,
    open_amount: openAmount,
    paid_amount: paidAmount,
    currency: 'USD',
  };
}

function mockTxn(id, gross, email, ref = '', fee = 0, kind = 'payment', eventCode = 'T0006') {
  return {
    id,
    gross,
    fee,
    net: gross - fee,
    payer_email: email,
    invoice_ref: ref,
    kind,
    event_code: eventCode,
    currency: 'USD',
  };
}

test('Rule: exact match generates confidence 1.0 auto candidate', () => {
  const inv = mockInvoice('inv_1', 'INV-2026-001', 'buyer@example.com', 50000);
  const txn = mockTxn('txn_1', 50000, 'buyer@example.com', 'INV-2026-001');

  const candidates = findCandidatesForTxn(txn, [inv]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].method, 'exact');
  assert.equal(candidates[0].confidence, 1.0);
  assert.equal(candidates[0].state, 'auto');
  assert.equal(candidates[0].allocated, 50000);
  assert.equal(candidates[0].invoice_id, 'inv_1');
});

test('Rule: fee_adjusted match detects gross received minus PayPal fee', () => {
  // Invoice is $1,000 (100000 cents). Buyer paid $970.70 (fee $29.30 deducted)
  const inv = mockInvoice('inv_2', 'INV-2026-002', 'buyer@example.com', 100000);
  const txn = mockTxn('txn_2', 97070, 'buyer@example.com', 'INV-2026-002', 2930);

  const candidates = findCandidatesForTxn(txn, [inv]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].method, 'fee_adjusted');
  assert.equal(candidates[0].confidence, 0.92);
  assert.equal(candidates[0].state, 'suggested');
  assert.equal(candidates[0].allocated, 97070);
});

test('Rule: combined match resolves 1 payment covering 2 open invoices for same email', () => {
  const inv1 = mockInvoice('inv_3a', 'INV-003A', 'toby@example.com', 35000);
  const inv2 = mockInvoice('inv_3b', 'INV-003B', 'toby@example.com', 65000);
  const txn = mockTxn('txn_3', 100000, 'toby@example.com', '');

  const candidates = findCandidatesForTxn(txn, [inv1, inv2]);
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].method, 'combined');
  assert.equal(candidates[1].method, 'combined');
  assert.equal(candidates[0].confidence, 0.88);
  assert.equal(candidates[0].allocated, 35000);
  assert.equal(candidates[1].allocated, 65000);
  assert.equal(candidates[0].allocated + candidates[1].allocated, 100000);
});

test('Rule: combined match resolves 1 payment covering 3 open invoices for same email', () => {
  const inv1 = mockInvoice('inv_4a', 'INV-004A', 'ursula@example.com', 20000);
  const inv2 = mockInvoice('inv_4b', 'INV-004B', 'ursula@example.com', 30000);
  const inv3 = mockInvoice('inv_4c', 'INV-004C', 'ursula@example.com', 50000);
  const txn = mockTxn('txn_4', 100000, 'ursula@example.com', '');

  const candidates = findCandidatesForTxn(txn, [inv1, inv2, inv3]);
  assert.equal(candidates.length, 3);
  assert.ok(candidates.every((c) => c.method === 'combined'));
  const totalAllocated = candidates.reduce((s, c) => s + c.allocated, 0);
  assert.equal(totalAllocated, 100000);
});

test('Rule: partial match links smaller payment to larger open balance', () => {
  const inv = mockInvoice('inv_5', 'INV-2026-005', 'client@example.com', 120000);
  const txn = mockTxn('txn_5', 60000, 'client@example.com', 'INV-2026-005');

  const candidates = findCandidatesForTxn(txn, [inv]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].method, 'partial');
  assert.equal(candidates[0].confidence, 0.80);
  assert.equal(candidates[0].allocated, 60000);
});

test('Rule: email match links transaction with equal amount and matching email without ref', () => {
  const inv = mockInvoice('inv_6', 'INV-2026-006', 'direct@example.com', 45000);
  const txn = mockTxn('txn_6', 45000, 'direct@example.com', '');

  const candidates = findCandidatesForTxn(txn, [inv]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].method, 'email');
  assert.equal(candidates[0].confidence, 0.75);
  assert.equal(candidates[0].allocated, 45000);
});

test('Rule: refund match links T1107 debit event to original invoice by reference or amount', () => {
  const inv = mockInvoice('inv_7', 'INV-2026-007', 'alice@example.com', 125000, 0, 125000);
  const txn = mockTxn('txn_7', -125000, 'alice@example.com', 'INV-2026-007', 0, 'refund', 'T1107');

  const candidates = findCandidatesForTxn(txn, [inv]);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].method, 'refund');
  assert.equal(candidates[0].confidence, 0.85);
  assert.equal(candidates[0].allocated, 125000);
});

test('Rule: duplicate match flags second payment for an already-settled invoice', () => {
  // Invoice has 0 open amount (already paid)
  const inv = mockInvoice('inv_8', 'INV-2026-008', 'diana@example.com', 62000, 0, 62000);
  const txn = mockTxn('txn_8', 62000, 'diana@example.com', 'INV-2026-008');

  const candidates = findCandidatesForTxn(txn, [inv], new Set(['inv_8']));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].method, 'duplicate');
  assert.equal(candidates[0].confidence, 0.70);
  assert.equal(candidates[0].allocated, 62000);
});
