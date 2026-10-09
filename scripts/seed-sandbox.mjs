#!/usr/bin/env node
/**
 * SettleSight - PayPal Sandbox Seeding Script
 *
 * Official PayPal API Documentation Citations:
 * - Invoicing v2 Create Draft & Send:
 *   https://developer.paypal.com/docs/api/invoicing/v2/#invoices_create
 *   https://developer.paypal.com/docs/api/invoicing/v2/#invoices_send
 * - Invoicing v2 Record Payment:
 *   https://developer.paypal.com/docs/api/invoicing/v2/#invoices_payments
 * - Orders v2 / Capture for sandbox payments:
 *   https://developer.paypal.com/docs/api/orders/v2/
 *
 * NOTE ON SANDBOX API LIMITATIONS:
 * In a pure seller sandbox app without an interactive buyer browser session,
 * incoming spontaneous transactions (such as a payer sending unreferenced money
 * via PayPal balance or direct P2P) cannot be fully triggered without buyer login.
 * Therefore, this script uses Invoicing v2's official `record-payment` API with
 * realistic method metadata and notes to seed the ledger.
 */

import { PayPalClient } from '../server/paypal.mjs';
import { loadEnvFile } from '../server/index.mjs';

// Load .env if present
loadEnvFile();

const isDryRun = process.argv.includes('--dry-run');
const TAG_PREFIX = 'SS-DEMO-';

// Realistic 30-invoice dataset specification
export const SEED_SPECIFICATION = [
  // 1. Exact Matches (1-8): clean reference, exact amount
  { num: '001', cust: 'Alpha Corp', email: 'billing@alpha.example.com', amt: 1250.00, term: 15, scenario: 'exact', payAmt: 1250.00, method: 'PAYPAL', note: 'Full payment for SS-DEMO-001' },
  { num: '002', cust: 'Beta Design', email: 'finance@beta.example.com', amt: 450.00, term: 14, scenario: 'exact', payAmt: 450.00, method: 'PAYPAL', note: 'Invoice SS-DEMO-002 payment' },
  { num: '003', cust: 'Gamma LLC', email: 'ap@gamma.example.com', amt: 2800.00, term: 30, scenario: 'exact', payAmt: 2800.00, method: 'PAYPAL', note: 'Payment for SS-DEMO-003' },
  { num: '004', cust: 'Delta Works', email: 'delta@example.com', amt: 950.00, term: 15, scenario: 'exact', payAmt: 950.00, method: 'PAYPAL', note: 'SS-DEMO-004 settled' },
  { num: '005', cust: 'Epsilon Media', email: 'pay@epsilon.example.com', amt: 1500.00, term: 15, scenario: 'exact', payAmt: 1500.00, method: 'PAYPAL', note: 'Payment SS-DEMO-005' },
  { num: '006', cust: 'Zeta Labs', email: 'zeta@example.com', amt: 600.00, term: 14, scenario: 'exact', payAmt: 600.00, method: 'PAYPAL', note: 'Settlement for SS-DEMO-006' },
  { num: '007', cust: 'Eta Global', email: 'eta@example.com', amt: 3200.00, term: 30, scenario: 'exact', payAmt: 3200.00, method: 'PAYPAL', note: 'Invoice SS-DEMO-007 paid' },
  { num: '008', cust: 'Theta Studio', email: 'theta@example.com', amt: 850.00, term: 15, scenario: 'exact', payAmt: 850.00, method: 'PAYPAL', note: 'Wire reference SS-DEMO-008' },

  // 2. Fee-Adjusted Matches (9-13): customer paid gross, fee deducted
  { num: '009', cust: 'Iota Systems', email: 'iota@example.com', amt: 1800.00, term: 15, scenario: 'fee_adjusted', payAmt: 1800.00, fee: 62.70, method: 'PAYPAL', note: 'PayPal checkout gross $1800, net $1737.30' },
  { num: '010', cust: 'Kappa Ventures', email: 'kappa@example.com', amt: 2400.00, term: 30, scenario: 'fee_adjusted', payAmt: 2400.00, fee: 83.50, method: 'PAYPAL', note: 'Gross $2400, standard 3.49% fee deducted' },
  { num: '011', cust: 'Lambda Consulting', email: 'lambda@example.com', amt: 900.00, term: 15, scenario: 'fee_adjusted', payAmt: 900.00, fee: 31.60, method: 'PAYPAL', note: 'Gross $900 with PayPal transaction fee' },
  { num: '012', cust: 'Mu Retail', email: 'mu@example.com', amt: 1350.00, term: 15, scenario: 'fee_adjusted', payAmt: 1350.00, fee: 47.20, method: 'PAYPAL', note: 'Full gross payment via credit card through PayPal' },
  { num: '013', cust: 'Nu Digital', email: 'nu@example.com', amt: 720.00, term: 14, scenario: 'fee_adjusted', payAmt: 720.00, fee: 25.30, method: 'PAYPAL', note: 'Online invoice payment gross $720' },

  // 3. Combined Payments (14-17): 1 payment covers 2 invoices
  { num: '014', cust: 'Omni Holding', email: 'treasury@omni.example.com', amt: 1000.00, term: 15, scenario: 'combined', payAmt: 1000.00, method: 'BANK_TRANSFER', note: 'Combined wire #101: covers SS-DEMO-014 and SS-DEMO-015 ($2,500 total)' },
  { num: '015', cust: 'Omni Holding', email: 'treasury@omni.example.com', amt: 1500.00, term: 15, scenario: 'combined', payAmt: 1500.00, method: 'BANK_TRANSFER', note: 'Combined wire #101: covers SS-DEMO-014 and SS-DEMO-015 ($2,500 total)' },
  { num: '016', cust: 'Pacific Group', email: 'ap@pacific.example.com', amt: 650.00, term: 15, scenario: 'combined', payAmt: 650.00, method: 'PAYPAL', note: 'Pacific multi-invoice settlement batch for 016 & 017' },
  { num: '017', cust: 'Pacific Group', email: 'ap@pacific.example.com', amt: 850.00, term: 15, scenario: 'combined', payAmt: 850.00, method: 'PAYPAL', note: 'Pacific multi-invoice settlement batch for 016 & 017' },

  // 4. Partial Payments (18-21): paid 50% installment
  { num: '018', cust: 'Quantum Corp', email: 'quantum@example.com', amt: 1200.00, term: 30, scenario: 'partial', payAmt: 600.00, method: 'PAYPAL', note: 'Installment 1 of 2 (50% deposit)' },
  { num: '019', cust: 'Redwood Software', email: 'redwood@example.com', amt: 3000.00, term: 30, scenario: 'partial', payAmt: 1500.00, method: 'BANK_TRANSFER', note: 'First milestone tranche 50%' },
  { num: '020', cust: 'Solaris Energy', email: 'solaris@example.com', amt: 800.00, term: 15, scenario: 'partial', payAmt: 400.00, method: 'PAYPAL', note: 'Half-payment pending project sign-off' },
  { num: '021', cust: 'Terra Nova', email: 'terra@example.com', amt: 2200.00, term: 30, scenario: 'partial', payAmt: 1100.00, method: 'PAYPAL', note: 'Initial retainer deposit' },

  // 5. Payer-Email Match with Missing Reference (22-24)
  { num: '022', cust: 'Umbra Analytics', email: 'director@umbra.example.com', amt: 750.00, term: 15, scenario: 'email_match', payAmt: 750.00, method: 'PAYPAL', note: 'General retainer deposit (no ref provided)' },
  { num: '023', cust: 'Vanguard Security', email: 'billing@vanguard.example.com', amt: 1650.00, term: 30, scenario: 'email_match', payAmt: 1650.00, method: 'PAYPAL', note: 'Security review services' },
  { num: '024', cust: 'Waveform Labs', email: 'hello@waveform.example.com', amt: 480.00, term: 15, scenario: 'email_match', payAmt: 480.00, method: 'PAYPAL', note: 'Monthly API access fee' },

  // 6. Refund Linked (25-26): paid then refund adjustment
  { num: '025', cust: 'Xenon Logistics', email: 'xenon@example.com', amt: 1100.00, term: 15, scenario: 'refund', payAmt: 1100.00, refundAmt: 100.00, method: 'PAYPAL', note: 'Paid $1100, courtesy refund credit $100 issued' },
  { num: '026', cust: 'Yellowstone Co', email: 'yellowstone@example.com', amt: 850.00, term: 15, scenario: 'refund', payAmt: 850.00, refundAmt: 50.00, method: 'PAYPAL', note: 'Paid $850, partial service credit refund $50' },

  // 7. Duplicate Payment (27)
  { num: '027', cust: 'Zenith Apex', email: 'zenith@example.com', amt: 500.00, term: 15, scenario: 'duplicate', payAmt: 500.00, method: 'PAYPAL', note: 'Duplicate payment entry recorded for same reference' },

  // 8. Overdue / Unpaid Invoices (28-30): no payments
  { num: '028', cust: 'Aura Cloud', email: 'aura@example.com', amt: 3400.00, term: -20, scenario: 'overdue_unpaid' },
  { num: '029', cust: 'Borealis AI', email: 'borealis@example.com', amt: 1950.00, term: -15, scenario: 'overdue_unpaid' },
  { num: '030', cust: 'Cascade Systems', email: 'cascade@example.com', amt: 2100.00, term: -10, scenario: 'overdue_unpaid' },
];

export async function run() {
  console.log(`=== SettleSight Sandbox Seeder ===`);
  console.log(`Prefix: ${TAG_PREFIX} | Items: ${SEED_SPECIFICATION.length} | Mode: ${isDryRun ? 'DRY-RUN' : 'LIVE'}\n`);

  if (isDryRun) {
    console.log('--- Dry Run Execution Plan ---');
    console.log(`Total Invoices Planned: ${SEED_SPECIFICATION.length}`);
    const scenarios = {};
    let totalInvoiced = 0;
    let totalPayments = 0;

    for (const spec of SEED_SPECIFICATION) {
      scenarios[spec.scenario] = (scenarios[spec.scenario] || 0) + 1;
      totalInvoiced += spec.amt;
      if (spec.payAmt) totalPayments += spec.payAmt;
    }

    console.log(`Total Value Invoiced:  $${totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log(`Total Value Payments:  $${totalPayments.toLocaleString('en-US', { minimumFractionDigits: 2 })}`);
    console.log('\nScenario Distribution:');
    for (const [k, v] of Object.entries(scenarios)) {
      console.log(`  - ${k.padEnd(16)}: ${v} invoice(s)`);
    }

    console.log('\nSample Invoice Plan (first 3):');
    SEED_SPECIFICATION.slice(0, 3).forEach((s) => {
      console.log(`  ${TAG_PREFIX}${s.num} | ${s.cust} (${s.email}) | $${s.amt.toFixed(2)} | Scenario: ${s.scenario}`);
    });

    console.log('\nNote: In sandbox live execution, each draft invoice is created via Invoicing v2,');
    console.log('sent, and then payments are recorded via /v2/invoicing/invoices/{id}/payments.');
    console.log('Dry-run complete: no network calls were made.');
    return;
  }

  const client = new PayPalClient();
  if (!client.hasCredentials()) {
    console.error('Error: PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are required for live sandbox seeding.');
    console.error('Set them in .env or run with --dry-run to preview the plan.');
    process.exit(1);
  }

  console.log('Connecting to PayPal Sandbox...');
  await client.getAccessToken();
  console.log('OAuth authentication successful. Checking existing invoices...');

  const existing = await client.listInvoices();
  const existingNumbers = new Set(
    (existing.items || []).map((i) => i.detail?.invoice_number).filter(Boolean)
  );

  console.log(`Found ${existingNumbers.size} existing invoices in sandbox.`);

  let createdCount = 0;
  for (const spec of SEED_SPECIFICATION) {
    const invNumber = `${TAG_PREFIX}${spec.num}`;
    if (existingNumbers.has(invNumber)) {
      console.log(`[Skip] Invoice ${invNumber} already exists.`);
      continue;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + spec.term);

    const draftPayload = {
      detail: {
        invoice_number: invNumber,
        reference: `REF-${spec.num}`,
        invoice_date: new Date().toISOString().slice(0, 10),
        currency_code: 'USD',
        payment_term: {
          due_date: dueDate.toISOString().slice(0, 10),
        },
        note: `SettleSight sandbox test invoice (${spec.scenario})`,
      },
      primary_recipients: [
        {
          billing_info: {
            name: { full_name: spec.cust },
            email_address: spec.email,
          },
        },
      ],
      items: [
        {
          name: `Professional Services (${spec.scenario})`,
          quantity: '1',
          unit_amount: { currency_code: 'USD', value: spec.amt.toFixed(2) },
        },
      ],
    };

    console.log(`Creating ${invNumber} for ${spec.cust}...`);
    const draftRes = await client.request('/v2/invoicing/invoices', {
      method: 'POST',
      body: JSON.stringify(draftPayload),
    });
    const draft = await draftRes.json();
    const invoiceId = draft.id || (draft.href ? draft.href.split('/').pop() : null);

    if (invoiceId) {
      // Send invoice
      await client.request(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/send`, { method: 'POST' });

      // Record payment if specified
      if (spec.payAmt) {
        await client.recordPayment(invoiceId, {
          amount: spec.payAmt,
          method: spec.method || 'PAYPAL',
          note: spec.note,
        });
      }
      createdCount++;
    }
  }

  console.log(`\nSeeding completed. Created ${createdCount} new sandbox invoices.`);
}

if (process.argv[1] && process.argv[1].includes('seed-sandbox.mjs')) {
  run().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
  });
}
