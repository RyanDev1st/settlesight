import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAllocation } from './validator.js';

function baseState() {
  return {
    invoices: [
      { id: 'inv_101', number: 'INV-101', amount: 100000, open_amount: 100000, currency: 'USD' },
      { id: 'inv_102', number: 'INV-102', amount: 50000, open_amount: 20000, currency: 'EUR' },
    ],
    transactions: [
      { id: 'txn_201', gross: 100000, currency: 'USD' },
      { id: 'txn_202', gross: 20000, currency: 'EUR' },
    ],
    matches: [],
  };
}

test('validateAllocation: valid candidate passes all invariants', () => {
  const state = baseState();
  const alloc = {
    transaction_id: 'txn_201',
    invoice_id: 'inv_101',
    allocated: 100000,
  };

  const res = validateAllocation(alloc, state);
  assert.equal(res.valid, true);
  assert.equal(res.reasons.length, 0);
});

test('validateAllocation: rejects over-allocation beyond invoice open amount', () => {
  const state = baseState();
  const alloc = {
    transaction_id: 'txn_201',
    invoice_id: 'inv_101',
    allocated: 150000, // 150000 > 100000
  };

  const res = validateAllocation(alloc, state);
  assert.equal(res.valid, false);
  assert.ok(res.error.includes('over-allocated'));
  assert.ok(res.reasons.some((r) => r.includes('exceeds available open amount')));
});

test('validateAllocation: rejects transaction allocating more than gross', () => {
  const state = baseState();
  // inv_101 has 100000 open, but txn_202 only has 20000 gross
  // and we test allocating 50000 from txn_201 when 80000 already used
  state.matches.push({
    id: 'mat_existing',
    transaction_id: 'txn_201',
    invoice_id: 'inv_other',
    allocated: 80000,
    state: 'approved',
  });

  const alloc = {
    transaction_id: 'txn_201',
    invoice_id: 'inv_101',
    allocated: 30000, // 80000 + 30000 = 110000 > 100000 gross
  };

  const res = validateAllocation(alloc, state);
  assert.equal(res.valid, false);
  assert.ok(res.error.includes('over-allocated'));
  assert.ok(res.reasons.some((r) => r.includes('exceeds available gross')));
});

test('validateAllocation: rejects currency mismatch between invoice and transaction', () => {
  const state = baseState();
  const alloc = {
    transaction_id: 'txn_202', // EUR
    invoice_id: 'inv_101', // USD
    allocated: 20000,
  };

  const res = validateAllocation(alloc, state);
  assert.equal(res.valid, false);
  assert.ok(res.error.includes('Currency mismatch'));
});

test('validateAllocation: rejects non-existent or invalid invoice and transaction IDs', () => {
  const state = baseState();
  const allocMissingInv = { transaction_id: 'txn_201', invoice_id: 'inv_missing', allocated: 10000 };
  const res1 = validateAllocation(allocMissingInv, state);
  assert.equal(res1.valid, false);
  assert.ok(res1.error.includes('Invoice not found'));

  const allocMissingTxn = { transaction_id: 'txn_missing', invoice_id: 'inv_101', allocated: 10000 };
  const res2 = validateAllocation(allocMissingTxn, state);
  assert.equal(res2.valid, false);
  assert.ok(res2.error.includes('Transaction not found'));
});

test('validateAllocation: rejects non-positive or non-integer allocated cents', () => {
  const state = baseState();
  const allocZero = { transaction_id: 'txn_201', invoice_id: 'inv_101', allocated: 0 };
  assert.equal(validateAllocation(allocZero, state).valid, false);

  const allocNegative = { transaction_id: 'txn_201', invoice_id: 'inv_101', allocated: -500 };
  assert.equal(validateAllocation(allocNegative, state).valid, false);

  const allocFloat = { transaction_id: 'txn_201', invoice_id: 'inv_101', allocated: 12.34 };
  assert.equal(validateAllocation(allocFloat, state).valid, false);
});
