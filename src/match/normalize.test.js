import test from 'node:test';
import assert from 'node:assert/strict';
import {
  toCents,
  fromCents,
  calculateDaysOverdue,
  extractInvoiceReference,
  classifyEventCode,
  normalizeInvoices,
  normalizeTransactions,
} from './normalize.js';

test('toCents and fromCents accurately handle decimals and edge cases', () => {
  assert.equal(toCents('1250.00'), 125000);
  assert.equal(toCents('0.05'), 5);
  assert.equal(toCents(12.5), 1250);
  assert.equal(toCents('-45.20'), -4520);
  assert.equal(toCents(null), 0);
  assert.equal(toCents(''), 0);

  assert.equal(fromCents(125000), 1250.0);
  assert.equal(fromCents(5), 0.05);
  assert.equal(fromCents(0), 0);
});

test('calculateDaysOverdue accurately computes difference to reference date', () => {
  const asOf = '2026-10-09';
  // Due 10 days ago
  assert.equal(calculateDaysOverdue('2026-09-29', asOf), 10);
  // Due in future
  assert.equal(calculateDaysOverdue('2026-10-15', asOf), 0);
  // Invalid or missing date
  assert.equal(calculateDaysOverdue('', asOf), 0);
});

test('extractInvoiceReference extracts reference from invoice_id and note text', () => {
  assert.equal(extractInvoiceReference({ invoice_id: 'INV-2026-001' }), 'INV-2026-001');
  assert.equal(
    extractInvoiceReference({ transaction_subject: 'Payment for INV-2026-042 consulting' }),
    'INV-2026-042'
  );
  assert.equal(
    extractInvoiceReference({ transaction_note: 'Settling Invoice #8849' }),
    '8849'
  );
  assert.equal(extractInvoiceReference({ transaction_note: 'General transfer' }), '');
});

test('classifyEventCode distinguishes payments, refunds, and other events', () => {
  // Official doc: T0006/T0007/T0011 are checkout/invoicing payments, T1107 is refund
  assert.equal(classifyEventCode('T0006', 1000), 'payment');
  assert.equal(classifyEventCode('T0007', 1000), 'payment');
  assert.equal(classifyEventCode('T0011', 1000), 'payment');
  assert.equal(classifyEventCode('T1107', -1000), 'refund');
  assert.equal(classifyEventCode('T1105', -500), 'refund');
  assert.equal(classifyEventCode('T0200', -1500), 'other');
});

test('normalizeInvoices converts Invoicing v2 structure to internal contract with cents', () => {
  const rawInvoices = [
    {
      id: 'INV2-001',
      status: 'SENT',
      detail: {
        invoice_number: 'INV-2026-001',
        invoice_date: '2026-09-01',
        currency_code: 'USD',
        payment_term: { due_date: '2026-09-16' },
      },
      primary_recipients: [
        {
          billing_info: {
            name: { full_name: 'Alice Smith' },
            email_address: 'alice.smith@example.com',
          },
        },
      ],
      amount: { value: '1250.00', currency_code: 'USD' },
      paid_amount: { value: '250.00', currency_code: 'USD' },
    },
  ];

  const normalized = normalizeInvoices(rawInvoices, { asOfDate: '2026-10-09' });
  assert.equal(normalized.length, 1);
  const inv = normalized[0];

  assert.equal(inv.id, 'INV2-001');
  assert.equal(inv.number, 'INV-2026-001');
  assert.equal(inv.customer_name, 'Alice Smith');
  assert.equal(inv.customer_email, 'alice.smith@example.com');
  assert.equal(inv.amount, 125000);
  assert.equal(inv.paid_amount, 25000);
  assert.equal(inv.open_amount, 100000);
  assert.equal(inv.currency, 'USD');
  assert.equal(inv.days_overdue, 23);
  assert.equal(inv.match_status, 'open');
});

test('normalizeTransactions converts Transaction Search v1 items into internal rows', () => {
  const rawTxns = [
    {
      transaction_info: {
        transaction_id: 'TXN-001',
        transaction_event_code: 'T0006',
        transaction_initiation_date: '2026-09-15T10:00:00Z',
        transaction_amount: { value: '1250.00', currency_code: 'USD' },
        fee_amount: { value: '36.55', currency_code: 'USD' },
        invoice_id: 'INV-2026-001',
        transaction_subject: 'Payment for INV-2026-001',
      },
      payer_info: {
        email_address: 'alice.smith@example.com',
        payer_name: { alternate_full_name: 'Alice Smith' },
      },
    },
  ];

  const normalized = normalizeTransactions(rawTxns);
  assert.equal(normalized.length, 1);
  const txn = normalized[0];

  assert.equal(txn.id, 'TXN-001');
  assert.equal(txn.gross, 125000);
  assert.equal(txn.fee, 3655);
  assert.equal(txn.net, 121345);
  assert.equal(txn.kind, 'payment');
  assert.equal(txn.invoice_ref, 'INV-2026-001');
  assert.equal(txn.payer_email, 'alice.smith@example.com');
  assert.equal(txn.match_status, 'unmatched');
});
