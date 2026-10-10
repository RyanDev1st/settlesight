import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  proposeMatches,
  applyDecision,
  validateAllocation,
  summarize,
  deriveInvoiceStatus,
  deriveTransactionStatus,
} from './engine.js';
import { normalizeInvoices, normalizeTransactions } from './normalize.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const demoDir = path.resolve(__dirname, '../data/demo');

test('Bug 1 Regression: partial approve then remainder allocation is valid without double-counting', () => {
  const rawInvoicesJson = JSON.parse(
    fs.readFileSync(path.join(demoDir, 'invoices.json'), 'utf8')
  );
  const rawTxnsJson = JSON.parse(
    fs.readFileSync(path.join(demoDir, 'transactions.json'), 'utf8')
  );

  const invoices = normalizeInvoices(rawInvoicesJson.items);
  const transactions = normalizeTransactions(rawTxnsJson.transaction_details);

  const result = proposeMatches(invoices, transactions, { autoApplyExact: true });

  // Find the partial match on INV-2026-025 (amount 80000, allocated 40000)
  const partialMatch = result.matches.find(
    (m) => m.method === 'partial' && m.allocated === 40000
  );
  assert.ok(partialMatch, 'Partial match for 40000 should exist');

  // Approve it
  applyDecision(result.state, partialMatch.id, 'approve');

  const inv = result.state.invoices.find((i) => i.id === partialMatch.invoice_id);
  assert.equal(inv.open_amount, 40000);
  assert.equal(inv.paid_amount, 40000);

  // Validate allocation of remaining 40000 with a new/unused transaction
  const unusedTxn = {
    id: 'txn_remainder_unused',
    gross: 40000,
    currency: 'USD',
    match_status: 'unmatched',
  };
  result.state.transactions.push(unusedTxn);

  const remainderAlloc = {
    transaction_id: unusedTxn.id,
    invoice_id: inv.id,
    allocated: 40000,
  };

  const validation = validateAllocation(remainderAlloc, result.state);
  assert.equal(
    validation.valid,
    true,
    `Remainder allocation should be valid, but got: ${validation.error}`
  );
});

test('Bug 1 Regression: suggested match does not consume capacity until approved', () => {
  const state = {
    invoices: [
      { id: 'inv_cap', number: 'INV-CAP', amount: 100000, open_amount: 100000, paid_amount: 0, currency: 'USD' },
    ],
    transactions: [
      { id: 'txn_cap1', gross: 50000, currency: 'USD' },
      { id: 'txn_cap2', gross: 100000, currency: 'USD' },
    ],
    matches: [
      { id: 'mat_sugg', invoice_id: 'inv_cap', transaction_id: 'txn_cap1', allocated: 50000, state: 'suggested' },
    ],
  };

  // Another transaction allocating the full 100000 capacity should still be valid because mat_sugg is only 'suggested'
  const allocFull = {
    transaction_id: 'txn_cap2',
    invoice_id: 'inv_cap',
    allocated: 100000,
  };

  const validation = validateAllocation(allocFull, state);
  assert.equal(validation.valid, true, 'Suggested match must not block capacity');
});

test('Bug 2 Regression: invoice match_status transitions from suggested to open after partial approval', () => {
  const state = {
    invoices: [
      { id: 'inv_partial', number: 'INV-P', amount: 80000, open_amount: 80000, paid_amount: 0, currency: 'USD', match_status: 'suggested' },
    ],
    transactions: [
      { id: 'txn_p1', gross: 40000, currency: 'USD', match_status: 'suggested' },
      { id: 'txn_p2', gross: 40000, currency: 'USD', match_status: 'unmatched' },
    ],
    matches: [
      { id: 'mat_p1', invoice_id: 'inv_partial', transaction_id: 'txn_p1', allocated: 40000, method: 'partial', state: 'suggested' },
    ],
    exceptions: [],
  };

  // Initially status is suggested because of pending suggested match
  assert.equal(deriveInvoiceStatus(state.invoices[0], state), 'suggested');

  // Approve the partial match
  applyDecision(state, 'mat_p1', 'approve');

  // After approving partial with no remaining suggested matches, open_amount is 40000 and status should be 'open'
  assert.equal(state.invoices[0].open_amount, 40000);
  assert.equal(state.invoices[0].match_status, 'open');

  // Now create and approve the second half
  state.matches.push({
    id: 'mat_p2',
    invoice_id: 'inv_partial',
    transaction_id: 'txn_p2',
    allocated: 40000,
    method: 'partial',
    state: 'suggested',
  });
  applyDecision(state, 'mat_p2', 'approve');

  // When fully paid, status becomes 'matched'
  assert.equal(state.invoices[0].open_amount, 0);
  assert.equal(state.invoices[0].match_status, 'matched');
});

test('Bug 3 Regression: summarize().exceptions_count strictly equals exceptions.length and exposes suggested_count', () => {
  const rawInvoicesJson = JSON.parse(
    fs.readFileSync(path.join(demoDir, 'invoices.json'), 'utf8')
  );
  const rawTxnsJson = JSON.parse(
    fs.readFileSync(path.join(demoDir, 'transactions.json'), 'utf8')
  );

  const invoices = normalizeInvoices(rawInvoicesJson.items);
  const transactions = normalizeTransactions(rawTxnsJson.transaction_details);
  const result = proposeMatches(invoices, transactions, { autoApplyExact: true });

  const summary = summarize(result.state);
  assert.equal(summary.exceptions_count, result.exceptions.length);
  assert.equal(summary.exceptions_count, 3, 'Demo data should have exactly 3 true exceptions');

  const expectedSuggestedCount = result.matches.filter((m) => m.state === 'suggested').length;
  assert.equal(summary.suggested_count, expectedSuggestedCount);
  assert.ok(summary.suggested_count > 0, 'Should have pending suggested matches');
});

test('Bug 4 Regression: src/match/index.js contains no references to process and only re-exports', () => {
  const indexPath = path.resolve(__dirname, 'index.js');
  const indexContent = fs.readFileSync(indexPath, 'utf8');

  assert.ok(!indexContent.includes('process.'), 'index.js must not reference process.');
  assert.ok(!indexContent.includes('process'), 'index.js must not reference process global');
  assert.ok(indexContent.includes('export * from'), 'index.js must re-export modules');
});
