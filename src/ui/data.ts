/**
 * SettleSight — Reconciliation Data Loader & Studio Sources
 *
 * Connects PayPal sandbox REST data (live) or pre-seeded JSON (demo)
 * directly into the deterministic reconciliation match engine.
 */

import type { AgDataSourcesDefinition, AgFieldDefinition } from 'ag-studio';
import { normalizeInvoices, normalizeTransactions, fromCents } from '../match/normalize.js';
import { proposeMatches, applyDecision } from '../match/engine.js';
import { validateAllocation } from '../match/validator.js';
import { summarize, toStudioSources } from '../match/summary.js';
import demoInvoices from '../data/demo/invoices.json';
import demoTransactions from '../data/demo/transactions.json';

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

import { listExceptions } from '../agent/tools.js';

export const INVOICE_FIELDS: AgFieldDefinition[] = [
  { id: 'id', name: 'Invoice ID', format: 'textFormat' },
  { id: 'number', name: 'Invoice #', format: 'textFormat' },
  { id: 'customer_name', name: 'Customer', format: 'textFormat' },
  { id: 'customer_email', name: 'Customer Email', format: 'textFormat' },
  { id: 'issue_date', name: 'Issue Date', format: 'textFormat' },
  { id: 'due_date', name: 'Due Date', format: 'textFormat' },
  { id: 'amount', name: 'Amount', format: 'currencyFormat', formatOptions: { format: '$#,##0.00' } },
  { id: 'currency', name: 'Currency', format: 'textFormat' },
  { id: 'paypal_status', name: 'PayPal Status', format: 'textFormat' },
  { id: 'paid_amount', name: 'Paid Amount', format: 'currencyFormat', formatOptions: { format: '$#,##0.00' } },
  { id: 'open_amount', name: 'Open Amount', format: 'currencyFormat', formatOptions: { format: '$#,##0.00' } },
  { id: 'days_overdue', name: 'Days Overdue', format: 'integerFormat' },
  { id: 'match_status', name: 'Match Status', format: 'textFormat' },
  { id: 'aging_bucket', name: 'Aging Bucket', format: 'textFormat' },
];

export const TRANSACTION_FIELDS: AgFieldDefinition[] = [
  { id: 'id', name: 'Transaction ID', format: 'textFormat' },
  { id: 'date', name: 'Date', format: 'textFormat' },
  { id: 'payer_name', name: 'Payer', format: 'textFormat' },
  { id: 'payer_email', name: 'Payer Email', format: 'textFormat' },
  { id: 'gross', name: 'Gross', format: 'currencyFormat', formatOptions: { format: '$#,##0.00' } },
  { id: 'fee', name: 'Fee', format: 'currencyFormat', formatOptions: { format: '$#,##0.00' } },
  { id: 'net', name: 'Net', format: 'currencyFormat', formatOptions: { format: '$#,##0.00' } },
  { id: 'currency', name: 'Currency', format: 'textFormat' },
  { id: 'event_code', name: 'Event Code', format: 'textFormat' },
  { id: 'kind', name: 'Type', format: 'textFormat' },
  { id: 'invoice_ref', name: 'Invoice Ref', format: 'textFormat' },
  { id: 'note', name: 'Note', format: 'textFormat' },
  { id: 'match_status', name: 'Match Status', format: 'textFormat' },
];

export const MATCH_FIELDS: AgFieldDefinition[] = [
  { id: 'id', name: 'Match ID', format: 'textFormat' },
  { id: 'transaction_id', name: 'Transaction ID', format: 'textFormat' },
  { id: 'invoice_id', name: 'Invoice ID', format: 'textFormat' },
  { id: 'allocated', name: 'Allocated', format: 'currencyFormat', formatOptions: { format: '$#,##0.00' } },
  { id: 'method', name: 'Method', format: 'textFormat' },
  { id: 'confidence', name: 'Confidence', format: 'decimalFormat' },
  { id: 'reasons', name: 'Reasons', format: 'textFormat' },
  { id: 'state', name: 'State', format: 'textFormat' },
];

export const AGING_FIELDS: AgFieldDefinition[] = [
  { id: 'bucket', name: 'Aging Period', format: 'textFormat' },
  { id: 'open_balance', name: 'Open Balance', format: 'currencyFormat', formatOptions: { format: '$#,##0.00' } },
  { id: 'count', name: 'Count', format: 'integerFormat' },
];

export const REVIEW_ITEM_FIELDS: AgFieldDefinition[] = [
  { id: 'id', name: 'Item ID', format: 'textFormat' },
  { id: 'invoice_id', name: 'Invoice ID', format: 'textFormat' },
  { id: 'invoice_number', name: 'Invoice #', format: 'textFormat' },
  { id: 'payer_name', name: 'Payer', format: 'textFormat' },
  { id: 'allocated', name: 'Allocated', format: 'currencyFormat', formatOptions: { format: '$#,##0.00' } },
  { id: 'method', name: 'Method', format: 'textFormat' },
  { id: 'confidence', name: 'Confidence', format: 'decimalFormat' },
  { id: 'state', name: 'State', format: 'textFormat' },
];

/**
 * Builds AG Studio sources and aging summary from engine state.
 */
export function buildStudioSources(state: any, summary: any): AgDataSourcesDefinition {
  const baseSources = toStudioSources(state || {});

  // Add aging_bucket field to each invoice for chart grouping
  const invoicesWithAging = (baseSources.invoices || []).map((inv: any) => {
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

  // Dedicated review_items source: exactly the rows needing review in Exceptions Queue (20 suggested + 3 unresolvable = 23 initially)
  const rawExceptions = listExceptions(state || {}).filter((item: any) => item.state !== 'approved');
  const reviewItemsData = rawExceptions.map((item: any) => ({
    id: item.id,
    invoice_id: item.invoiceId || item.id,
    invoice_number: item.invoiceNumber || item.id,
    payer_name: item.payerName || 'Unknown Payer',
    allocated: Number(item.allocated) || 0,
    method: item.method || 'manual',
    confidence: Number(item.confidence) || 0,
    state: item.state || 'exception',
  }));

  return {
    sources: [
      {
        id: 'invoices',
        name: 'Invoices',
        description: 'PayPal Invoicing v2 records with payment terms and aging',
        data: invoicesWithAging,
        fields: INVOICE_FIELDS,
      },
      {
        id: 'transactions',
        name: 'Transactions',
        description: 'PayPal Transaction Search records including gross, fees, and net',
        data: baseSources.transactions || [],
        fields: TRANSACTION_FIELDS,
      },
      {
        id: 'matches',
        name: 'Reconciliation Matches',
        description: 'Engine proposed allocations, confidence scores, and rule reasons',
        data: baseSources.matches || [],
        fields: MATCH_FIELDS,
      },
      {
        id: 'aging',
        name: 'Aging Buckets',
        description: 'Overdue invoice balances grouped by aging period',
        data: agingData,
        fields: AGING_FIELDS,
      },
      {
        id: 'review_items',
        name: 'Needs Review',
        description: 'Exceptions and candidate matches awaiting seller confirmation',
        data: reviewItemsData,
        fields: REVIEW_ITEM_FIELDS,
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
 * Returns the synchronous initial reconciliation state based on pre-seeded demo fixtures.
 */
export function getInitialDemoData(): ReconciliationDataResult {
  const normInvoices = normalizeInvoices(demoInvoices);
  const normTransactions = normalizeTransactions(demoTransactions);
  const { state, summary } = proposeMatches(normInvoices, normTransactions);
  const sources = buildStudioSources(state, summary);
  return {
    mode: 'demo',
    hasLlm: false,
    state,
    summary,
    sources,
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
    return getInitialDemoData();
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
  return getInitialDemoData().sources;
}
