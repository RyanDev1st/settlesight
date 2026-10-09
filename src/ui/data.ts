/**
 * SettleSight — Reconciliation Data Loader & Studio Sources
 *
 * Connects PayPal sandbox REST data (live) or pre-seeded JSON (demo)
 * directly into the deterministic reconciliation match engine.
 */

import type { AgDataSourcesDefinition } from 'ag-studio';
import { normalizeInvoices, normalizeTransactions, fromCents } from '../match/normalize.js';
import { proposeMatches, applyDecision } from '../match/engine.js';
import { validateAllocation } from '../match/validator.js';
import { summarize, toStudioSources } from '../match/summary.js';

export { validateAllocation, applyDecision, summarize };

export interface ReconciliationDataResult {
  mode: 'demo' | 'live';
  hasLlm: boolean;
  state: {
    invoices: any[];
    transactions: any[];
    matches: any[];
    exceptions: any[];
  };
  summary: ReturnType<typeof summarize>;
  sources: AgDataSourcesDefinition;
}

/**
 * Builds AG Studio sources and aging summary from engine state.
 */
export function buildStudioSources(state: any, summary: any): AgDataSourcesDefinition {
  const baseSources = toStudioSources(state);

  // Add aging_bucket field to each invoice for chart grouping
  const invoicesWithAging = baseSources.invoices.map((inv: any) => {
    let aging_bucket = '0-30 days';
    const od = Number(inv.days_overdue) || 0;
    if (od > 90) aging_bucket = '90+ days';
    else if (od > 60) aging_bucket = '61-90 days';
    else if (od > 30) aging_bucket = '31-60 days';
    return { ...inv, aging_bucket };
  });

  // Dedicated aging buckets source for bar chart widget
  const agingData = [
    {
      bucket: '0-30 days',
      open_balance: fromCents(summary?.aging_buckets?.['0-30']?.value || 0),
      count: summary?.aging_buckets?.['0-30']?.count || 0,
    },
    {
      bucket: '31-60 days',
      open_balance: fromCents(summary?.aging_buckets?.['31-60']?.value || 0),
      count: summary?.aging_buckets?.['31-60']?.count || 0,
    },
    {
      bucket: '61-90 days',
      open_balance: fromCents(summary?.aging_buckets?.['61-90']?.value || 0),
      count: summary?.aging_buckets?.['61-90']?.count || 0,
    },
    {
      bucket: '90+ days',
      open_balance: fromCents(summary?.aging_buckets?.['90+']?.value || 0),
      count: summary?.aging_buckets?.['90+']?.count || 0,
    },
  ];

  return {
    sources: [
      {
        id: 'invoices',
        name: 'Invoices',
        description: 'PayPal Invoicing v2 records with payment terms and aging',
        data: invoicesWithAging,
      },
      {
        id: 'transactions',
        name: 'Transactions',
        description: 'PayPal Transaction Search records including gross, fees, and net',
        data: baseSources.transactions,
      },
      {
        id: 'matches',
        name: 'Reconciliation Matches',
        description: 'Engine proposed allocations, confidence scores, and rule reasons',
        data: baseSources.matches,
      },
      {
        id: 'aging',
        name: 'Aging Buckets',
        description: 'Overdue invoice balances grouped by aging period',
        data: agingData,
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

/**
 * Loads invoices and transactions, executes engine match rules, and returns full reconciliation state.
 */
export async function loadReconciliationData(): Promise<ReconciliationDataResult> {
  let mode: 'demo' | 'live' = 'demo';
  let hasLlm = false;
  let rawInvoices: any = null;
  let rawTransactions: any = null;

  // 1. Check live backend health
  try {
    const healthRes = await fetch('/api/health');
    if (healthRes.ok) {
      const health = await healthRes.json();
      hasLlm = Boolean(health.hasLlm);
      if (health.hasPaypal) {
        const [invRes, txnRes] = await Promise.all([
          fetch('/api/invoices'),
          fetch('/api/transactions'),
        ]);
        if (invRes.ok && txnRes.ok) {
          rawInvoices = await invRes.json();
          rawTransactions = await txnRes.json();
          mode = 'live';
        }
      }
    }
  } catch {
    // Backend offline or error; fallback to demo JSON
  }

  // 2. Demo fallback if not live
  if (!rawInvoices || !rawTransactions) {
    const [invModule, txnModule] = await Promise.all([
      import('../data/demo/invoices.json'),
      import('../data/demo/transactions.json'),
    ]);
    rawInvoices = invModule.default || invModule;
    rawTransactions = txnModule.default || txnModule;
    mode = 'demo';
  }

  // 3. Normalize and run reconciliation match engine
  const normInvoices = normalizeInvoices(rawInvoices);
  const normTransactions = normalizeTransactions(rawTransactions);
  const { state, summary } = proposeMatches(normInvoices, normTransactions);
  const sources = buildStudioSources(state, summary);

  return {
    mode,
    hasLlm,
    state,
    summary,
    sources,
  };
}

/**
 * Backwards compatibility helper for AG Studio data loader.
 */
export function loadDemoData(): AgDataSourcesDefinition {
  // Synchronous initial fallback while async loader runs
  return buildStudioSources({ invoices: [], transactions: [], matches: [], exceptions: [] }, null);
}
