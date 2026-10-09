import type { AgDataSourcesDefinition } from 'ag-studio';
import {
  DEMO_INVOICES,
  DEMO_TRANSACTIONS,
  DEMO_MATCHES,
  type DemoInvoice,
  type DemoTransaction,
  type DemoMatch,
} from './placeholder-data';

export type { DemoInvoice, DemoTransaction, DemoMatch };

export interface RawDataResult {
  mode: 'demo' | 'live';
  invoices: any;
  transactions: any;
}

/**
 * Loads invoices and transactions.
 * Tries live backend proxy first (/api/health). If live credentials exist,
 * fetches real sandbox data; otherwise falls back gracefully to demo JSON.
 */
export async function loadData(): Promise<RawDataResult> {
  // 1. Check if backend server is available and has PayPal configured
  try {
    const healthRes = await fetch('/api/health');
    if (healthRes.ok) {
      const health = await healthRes.json();
      if (health.hasPaypal) {
        const [invRes, txnRes] = await Promise.all([
          fetch('/api/invoices'),
          fetch('/api/transactions'),
        ]);

        if (invRes.ok && txnRes.ok) {
          const invoices = await invRes.json();
          const transactions = await txnRes.json();
          return {
            mode: 'live',
            invoices,
            transactions,
          };
        }
      }
    }
  } catch (err) {
    // Backend server offline or request failed; fall back to demo mode
  }

  // 2. Demo fallback: load pre-seeded demo JSON
  try {
    const [invModule, txnModule] = await Promise.all([
      import('../data/demo/invoices.json').catch(() => null),
      import('../data/demo/transactions.json').catch(() => null),
    ]);

    if (invModule && txnModule) {
      return {
        mode: 'demo',
        invoices: invModule.default || invModule,
        transactions: txnModule.default || txnModule,
      };
    }
  } catch (err) {
    // Dynamic import fallback
  }

  // 3. Static fallback shape if demo JSON is missing
  return {
    mode: 'demo',
    invoices: {
      total_items: DEMO_INVOICES.length,
      total_pages: 1,
      items: DEMO_INVOICES.map((inv) => ({
        id: inv.id,
        status: inv.paypal_status,
        detail: {
          invoice_number: inv.number,
          invoice_date: inv.issue_date,
          currency_code: inv.currency,
          payment_term: { due_date: inv.due_date },
        },
        primary_recipients: [
          {
            billing_info: {
              name: { full_name: inv.customer_name },
              email_address: inv.customer_email,
            },
          },
        ],
        amount: { currency_code: inv.currency, value: inv.amount.toFixed(2) },
        due_amount: { currency_code: inv.currency, value: inv.open_amount.toFixed(2) },
      })),
    },
    transactions: {
      total_items: DEMO_TRANSACTIONS.length,
      total_pages: 1,
      transaction_details: DEMO_TRANSACTIONS.map((txn) => ({
        transaction_info: {
          transaction_id: txn.id,
          transaction_initiation_date: `${txn.date}T10:00:00Z`,
          transaction_amount: { currency_code: txn.currency, value: txn.gross.toFixed(2) },
          fee_amount: { currency_code: txn.currency, value: txn.fee.toFixed(2) },
          net_amount: { currency_code: txn.currency, value: txn.net.toFixed(2) },
          transaction_status: 'S',
          invoice_id: txn.invoice_ref,
          transaction_note: txn.note,
          transaction_event_code: txn.event_code,
        },
        payer_info: {
          email_address: txn.payer_email,
          payer_name: { alternate_full_name: txn.payer_name },
        },
      })),
    },
  };
}

/**
 * Provides AG Studio formatted data sources for analytical dashboard.
 */
export function loadDemoData(): AgDataSourcesDefinition {
  return {
    sources: [
      {
        id: 'invoices',
        name: 'Invoices',
        description: 'PayPal Invoicing v2 records with status and match tracking',
        data: DEMO_INVOICES,
      },
      {
        id: 'transactions',
        name: 'Transactions',
        description: 'PayPal Transaction Search activity including fees and net amounts',
        data: DEMO_TRANSACTIONS,
      },
      {
        id: 'matches',
        name: 'Reconciliation Matches',
        description: 'Deterministic and AI-assisted match candidates and allocations',
        data: DEMO_MATCHES,
      },
    ],
    relationships: [
      {
        id: 'match-to-invoice',
        source: { tableId: 'matches', fieldId: 'invoice_id' },
        target: { tableId: 'invoices', fieldId: 'id' },
        type: 'many-to-one',
      },
      {
        id: 'match-to-transaction',
        source: { tableId: 'matches', fieldId: 'transaction_id' },
        target: { tableId: 'transactions', fieldId: 'id' },
        type: 'many-to-one',
      },
    ],
  };
}
