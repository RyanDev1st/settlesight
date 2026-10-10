import test from 'node:test';
import assert from 'node:assert/strict';
import { proposeMatches, applyDecision, summarize, toStudioSources } from './engine.js';

test('proposeMatches: exact matches are auto-applied with confidence 1.0', () => {
  const invoices = [
    {
      id: 'inv_1',
      number: 'INV-001',
      customer_name: 'Alpha',
      customer_email: 'alpha@example.com',
      amount: 100000,
      paid_amount: 0,
      open_amount: 100000,
      currency: 'USD',
      match_status: 'open',
    },
  ];
  const transactions = [
    {
      id: 'txn_1',
      gross: 100000,
      fee: 2900,
      net: 97100,
      payer_email: 'alpha@example.com',
      invoice_ref: 'INV-001',
      kind: 'payment',
      currency: 'USD',
      match_status: 'unmatched',
    },
  ];

  const result = proposeMatches(invoices, transactions, { autoApplyExact: true });
  assert.equal(result.matches.length, 1);
  const m = result.matches[0];
  assert.equal(m.method, 'exact');
  assert.equal(m.confidence, 1.0);
  assert.equal(m.state, 'auto');

  // Balances updated in result.state
  const inv = result.state.invoices[0];
  assert.equal(inv.open_amount, 0);
  assert.equal(inv.paid_amount, 100000);
  assert.equal(inv.match_status, 'matched');
  assert.equal(result.state.transactions[0].match_status, 'matched');
});

test('proposeMatches: ambiguity between competing candidates becomes an exception', () => {
  // Payer has two open invoices of identical amount ($250.00 each)
  const invoices = [
    {
      id: 'inv_a',
      number: 'INV-A',
      customer_name: 'Beta',
      customer_email: 'beta@example.com',
      amount: 25000,
      open_amount: 25000,
      paid_amount: 0,
      currency: 'USD',
      match_status: 'open',
    },
    {
      id: 'inv_b',
      number: 'INV-B',
      customer_name: 'Beta',
      customer_email: 'beta@example.com',
      amount: 25000,
      open_amount: 25000,
      paid_amount: 0,
      currency: 'USD',
      match_status: 'open',
    },
  ];
  // Payment of $250.00 from beta@example.com without invoice reference
  const transactions = [
    {
      id: 'txn_ambig',
      gross: 25000,
      fee: 750,
      net: 24250,
      payer_email: 'beta@example.com',
      invoice_ref: '',
      kind: 'payment',
      currency: 'USD',
      match_status: 'unmatched',
    },
  ];

  const result = proposeMatches(invoices, transactions);
  // Must NOT create an auto-match
  assert.equal(result.matches.length, 0);
  // Must record an exception
  assert.equal(result.exceptions.length, 1);
  assert.equal(result.exceptions[0].type, 'ambiguity');
  assert.equal(result.state.transactions[0].match_status, 'exception');
  assert.equal(result.state.invoices[0].match_status, 'exception');
  assert.equal(result.state.invoices[1].match_status, 'exception');
});

test('proposeMatches: competing transactions for the same invoice become exceptions', () => {
  const invoices = [
    {
      id: 'inv_target',
      number: 'INV-TARGET',
      customer_name: 'Gamma',
      customer_email: 'gamma@example.com',
      amount: 18000,
      open_amount: 18000,
      paid_amount: 0,
      currency: 'USD',
      match_status: 'open',
    },
  ];
  const transactions = [
    {
      id: 'txn_claim_1',
      gross: 18000,
      fee: 500,
      net: 17500,
      payer_email: 'gamma@example.com',
      invoice_ref: 'INV-TARGET',
      kind: 'payment',
      currency: 'USD',
      match_status: 'unmatched',
    },
    {
      id: 'txn_claim_2',
      gross: 18000,
      fee: 500,
      net: 17500,
      payer_email: 'gamma@example.com',
      invoice_ref: 'INV-TARGET',
      kind: 'payment',
      currency: 'USD',
      match_status: 'unmatched',
    },
  ];

  const result = proposeMatches(invoices, transactions);
  assert.equal(result.matches.length, 0);
  assert.ok(result.exceptions.length >= 1);
  assert.equal(result.state.invoices[0].match_status, 'exception');
  assert.equal(result.state.transactions[0].match_status, 'exception');
  assert.equal(result.state.transactions[1].match_status, 'exception');
});

test('applyDecision: approve action transitions state and updates open balances', () => {
  const state = {
    invoices: [
      { id: 'inv_1', number: 'INV-001', amount: 80000, open_amount: 80000, paid_amount: 0, currency: 'USD', match_status: 'suggested' },
    ],
    transactions: [
      { id: 'txn_1', gross: 40000, currency: 'USD', match_status: 'suggested' },
    ],
    matches: [
      { id: 'mat_1', invoice_id: 'inv_1', transaction_id: 'txn_1', allocated: 40000, method: 'partial', state: 'suggested' },
    ],
  };

  applyDecision(state, 'mat_1', 'approve');
  assert.equal(state.matches[0].state, 'approved');
  assert.equal(state.invoices[0].paid_amount, 40000);
  assert.equal(state.invoices[0].open_amount, 40000);
  assert.equal(state.invoices[0].match_status, 'open'); // 40000 open remaining with no pending suggested match
  assert.equal(state.transactions[0].match_status, 'matched');
});

test('applyDecision: reject action marks match rejected and resets status to open', () => {
  const state = {
    invoices: [
      { id: 'inv_1', number: 'INV-001', amount: 50000, open_amount: 50000, paid_amount: 0, currency: 'USD', match_status: 'suggested' },
    ],
    transactions: [
      { id: 'txn_1', gross: 50000, currency: 'USD', match_status: 'suggested' },
    ],
    matches: [
      { id: 'mat_1', invoice_id: 'inv_1', transaction_id: 'txn_1', allocated: 50000, method: 'email', state: 'suggested' },
    ],
  };

  applyDecision(state, 'mat_1', 'reject');
  assert.equal(state.matches[0].state, 'rejected');
  assert.equal(state.invoices[0].open_amount, 50000);
  assert.equal(state.invoices[0].paid_amount, 0);
  assert.equal(state.invoices[0].match_status, 'open');
  assert.equal(state.transactions[0].match_status, 'unmatched');
});

test('summarize: computes matched percent, open values, and all 4 aging buckets', () => {
  const state = {
    invoices: [
      { id: 'inv_1', amount: 100000, paid_amount: 100000, open_amount: 0, days_overdue: 0, match_status: 'matched' },
      { id: 'inv_2', amount: 50000, paid_amount: 0, open_amount: 50000, days_overdue: 15, match_status: 'open' },
      { id: 'inv_3', amount: 60000, paid_amount: 0, open_amount: 60000, days_overdue: 45, match_status: 'open' },
      { id: 'inv_4', amount: 70000, paid_amount: 0, open_amount: 70000, days_overdue: 75, match_status: 'open' },
      { id: 'inv_5', amount: 80000, paid_amount: 0, open_amount: 80000, days_overdue: 120, match_status: 'open' },
    ],
    transactions: [],
    matches: [],
    exceptions: [],
  };

  const s = summarize(state);
  assert.equal(s.total_invoiced, 360000);
  assert.equal(s.matched_value, 100000);
  assert.equal(s.matched_percent, 27.78);
  assert.equal(s.open_count, 4);
  assert.equal(s.open_value, 260000);

  assert.equal(s.aging_buckets['0-30'].count, 1);
  assert.equal(s.aging_buckets['0-30'].value, 50000);
  assert.equal(s.aging_buckets['31-60'].count, 1);
  assert.equal(s.aging_buckets['31-60'].value, 60000);
  assert.equal(s.aging_buckets['61-90'].count, 1);
  assert.equal(s.aging_buckets['61-90'].value, 70000);
  assert.equal(s.aging_buckets['90+'].count, 1);
  assert.equal(s.aging_buckets['90+'].value, 80000);
});

test('toStudioSources: transforms state into AG Studio data contract with decimals', () => {
  const state = {
    invoices: [
      {
        id: 'inv_1',
        number: 'INV-101',
        customer_name: 'Customer 1',
        customer_email: 'c1@example.com',
        issue_date: '2026-09-01',
        due_date: '2026-09-15',
        amount: 125000,
        currency: 'USD',
        paypal_status: 'PAID',
        paid_amount: 125000,
        open_amount: 0,
        days_overdue: 0,
        match_status: 'matched',
      },
    ],
    transactions: [
      {
        id: 'txn_1',
        date: '2026-09-10',
        payer_name: 'Customer 1',
        payer_email: 'c1@example.com',
        gross: 125000,
        fee: 3655,
        net: 121345,
        currency: 'USD',
        event_code: 'T0006',
        kind: 'payment',
        invoice_ref: 'INV-101',
        note: 'Payment note',
        match_status: 'matched',
      },
    ],
    matches: [
      {
        id: 'mat_1',
        transaction_id: 'txn_1',
        invoice_id: 'inv_1',
        allocated: 125000,
        method: 'exact',
        confidence: 1.0,
        reasons: ['Exact match: INV-101'],
        state: 'auto',
      },
    ],
  };

  const sources = toStudioSources(state);
  assert.equal(sources.invoices[0].amount, 1250.0);
  assert.equal(sources.invoices[0].paid_amount, 1250.0);
  assert.equal(sources.invoices[0].open_amount, 0.0);

  assert.equal(sources.transactions[0].gross, 1250.0);
  assert.equal(sources.transactions[0].fee, 36.55);
  assert.equal(sources.transactions[0].net, 1213.45);

  assert.equal(sources.matches[0].allocated, 1250.0);
  assert.equal(sources.matches[0].reasons, 'Exact match: INV-101');
});
