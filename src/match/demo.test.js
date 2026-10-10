import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeInvoices, normalizeTransactions } from './normalize.js';
import { proposeMatches } from './engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const demoDir = path.resolve(__dirname, '../data/demo');

test('demo dataset loads and produces expected counts per method and exceptions', () => {
  const rawInvoicesJson = JSON.parse(
    fs.readFileSync(path.join(demoDir, 'invoices.json'), 'utf8')
  );
  const rawTxnsJson = JSON.parse(
    fs.readFileSync(path.join(demoDir, 'transactions.json'), 'utf8')
  );

  assert.equal(rawInvoicesJson.items.length, 40, 'Should have exactly 40 invoices');
  assert.equal(
    rawTxnsJson.transaction_details.length,
    60,
    'Should have exactly 60 transactions'
  );

  const normalizedInvoices = normalizeInvoices(rawInvoicesJson.items, { asOfDate: '2026-10-09' });
  const normalizedTxns = normalizeTransactions(rawTxnsJson.transaction_details);

  const result = proposeMatches(normalizedInvoices, normalizedTxns, { autoApplyExact: true });

  const methodCounts = result.matches.reduce((acc, m) => {
    acc[m.method] = (acc[m.method] || 0) + 1;
    return acc;
  }, {});

  // Method counts
  assert.equal(methodCounts.exact, 15, 'Exact matches count should be 15');
  assert.equal(methodCounts.fee_adjusted, 4, 'Fee-adjusted matches count should be 4');
  assert.equal(methodCounts.combined, 5, 'Combined matches count should be 5 (covering 5 invoices)');
  assert.equal(methodCounts.partial, 3, 'Partial matches count should be 3');
  assert.equal(methodCounts.email, 3, 'Email matches count should be 3');
  assert.equal(methodCounts.refund, 3, 'Refund matches count should be 3');
  assert.equal(methodCounts.duplicate, 2, 'Duplicate matches count should be 2');

  // Ambiguity exceptions: exactly 3 ambiguous exceptions
  assert.equal(result.exceptions.length, 3, 'Should have exactly 3 ambiguous exceptions');
  assert.equal(result.summary.exceptions_count, 3, 'Summary exceptions_count must match exceptions.length');
  assert.equal(
    result.summary.suggested_count,
    result.matches.filter((m) => m.state === 'suggested').length,
    'Summary suggested_count must match suggested matches count'
  );

  // Aging buckets should have representation in all buckets
  const summary = result.summary;
  assert.ok(summary.aging_buckets['0-30'].count >= 1, 'Bucket 0-30 should have items');
  assert.ok(summary.aging_buckets['31-60'].count >= 1, 'Bucket 31-60 should have items');
  assert.ok(summary.aging_buckets['61-90'].count >= 1, 'Bucket 61-90 should have items');
  assert.ok(summary.aging_buckets['90+'].count >= 2, 'Bucket 90+ should have items');
});
