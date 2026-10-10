import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { proposeMatches, validateAllocation, applyDecision } from './engine.js';

const invoice = (paid, records = []) => ({ id: 'inv_live', amount: { value: '100.00', currency_code: 'USD' }, detail: { invoice_number: 'INV-LIVE-1', invoice_date: '2026-10-11' }, payments: { paid_amount: { value: paid }, transactions: records } });
const txn = (id, amount, date = '2026-10-11') => ({ transaction_info: { transaction_id: id, transaction_amount: { value: amount, currency_code: 'USD' }, transaction_initiation_date: date, transaction_event_code: 'T0011', invoice_id: 'INV-LIVE-1' } });

test('PayPal recorded payments remain a baseline and reduce available allocation capacity', () => {
  const { state } = proposeMatches([invoice('25.00')], [txn('txn_new', '10.00')]);
  assert.equal(state.invoices[0].baseline_paid, 2500);
  assert.equal(state.invoices[0].paid_amount, 2500);
  assert.equal(state.invoices[0].open_amount, 7500);
  state.transactions.push({ id: 'txn_capacity', gross: 10000, currency: 'USD' });
  const overAllocation = validateAllocation({ transaction_id: 'txn_capacity', invoice_id: 'inv_live', allocated: 7600 }, state);
  assert.equal(overAllocation.valid, false);
  assert.match(overAllocation.error, /available open amount 7500 cents/);
  applyDecision(state, state.matches[0].id, 'approve');
  assert.equal(state.invoices[0].paid_amount, 3500);
  assert.equal(state.invoices[0].open_amount, 6500);
  applyDecision(state, state.matches[0].id, 'reject');
  assert.equal(state.invoices[0].open_amount, 7500);
});

test('Write-back and reload preserve updated PayPal paid amount and fully-paid status', () => {
  assert.equal(proposeMatches([invoice('0.00')], []).state.invoices[0].open_amount, 10000);
  const reloaded = proposeMatches([invoice('25.00')], []).state.invoices[0];
  assert.equal(reloaded.open_amount, 7500);
  assert.equal(reloaded.paid_amount, 2500);
  assert.equal(proposeMatches([invoice('100.00')], []).state.invoices[0].match_status, 'matched');
});

test('A transaction with the recorded payment amount, date and reference is excluded once', () => {
  const recorded = { payment_id: 'pay_recorded', payment_date: '2026-10-11', amount: { value: '25.00', currency_code: 'USD' } };
  const { state } = proposeMatches([invoice('25.00', [recorded])], [txn('txn_recorded', '25.00'), txn('txn_new', '25.00', '2026-10-12')]);
  assert.equal(state.invoices[0].paid_amount, 2500);
  assert.equal(state.invoices[0].open_amount, 7500);
  assert.equal(state.transactions.find(t => t.id === 'txn_recorded').match_status, 'matched');
  assert.equal(state.matches.some(m => m.transaction_id === 'txn_recorded'), false);
  assert.equal(validateAllocation({ transaction_id: 'txn_recorded', invoice_id: 'inv_live', allocated: 2500 }, state).valid, false);
  assert.equal(state.matches.some(m => m.transaction_id === 'txn_new'), true);
  applyDecision(state, state.matches[0].id, 'approve');
  assert.equal(state.invoices[0].open_amount, 5000);
});

test('Recorded payment exclusion does not swallow an additional identical payment or a different reference', () => {
  const recorded = { payment_date: '2026-10-11', amount: { value: '25.00', currency_code: 'USD' } };
  const wrongRef = txn('txn_other_invoice', '25.00');
  wrongRef.transaction_info.invoice_id = 'INV-OTHER-2';
  const { state } = proposeMatches([invoice('25.00', [recorded])], [txn('txn_a', '25.00'), txn('txn_b', '25.00'), wrongRef]);
  assert.equal(state.transactions.filter(t => t.recorded_payment_invoice_id).length, 1);
  assert.equal(state.matches.filter(m => ['txn_a', 'txn_b'].includes(m.transaction_id)).length, 1);
  assert.equal(state.transactions.find(t => t.id === 'txn_other_invoice').recorded_payment_invoice_id, undefined);
});

test('Recorded transaction amounts are usable when the aggregate paid amount is absent', () => {
  const raw = invoice('25.00', [{ payment_date: '2026-10-11', amount: { value: '25.00' } }]);
  delete raw.payments.paid_amount;
  assert.equal(proposeMatches([raw], []).state.invoices[0].open_amount, 7500);
});

test('Demo dataset totals are unchanged by recorded-payment baselines', () => {
  const invoices = JSON.parse(fs.readFileSync(new URL('../data/demo/invoices.json', import.meta.url))).items;
  const transactions = JSON.parse(fs.readFileSync(new URL('../data/demo/transactions.json', import.meta.url))).transaction_details;
  const { summary } = proposeMatches(invoices, transactions);
  assert.equal(summary.total_invoiced, 3699500);
  assert.equal(summary.matched_value, 1728500);
  assert.equal(summary.open_value, 1971000);
  assert.equal(summary.exceptions_count, 3);
  assert.equal(summary.suggested_count, 20);
});
