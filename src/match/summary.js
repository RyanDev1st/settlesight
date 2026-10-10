/**
 * SettleSight — Summary KPIs and AG Studio Source Transformation.
 *
 * Money is held internally as integer cents and converted to decimal values
 * only at the Studio boundary (toStudioSources).
 */

import { fromCents } from './normalize.js';

/**
 * Computes reconciliation metrics, KPIs, and aging distribution buckets.
 *
 * @param {object} state Current reconciliation state
 * @returns {object} Summary KPI object
 */
export function summarize(state = {}) {
  const invoices = state.invoices || [];
  const matches = state.matches || [];
  const exceptions = state.exceptions || [];

  let totalInvoicedCents = 0;
  let paidCents = 0;
  let openCents = 0;
  let openCount = 0;

  const agingBuckets = {
    '0-30': { count: 0, value: 0 },
    '31-60': { count: 0, value: 0 },
    '61-90': { count: 0, value: 0 },
    '90+': { count: 0, value: 0 },
  };

  for (const inv of invoices) {
    totalInvoicedCents += inv.amount || 0;
    paidCents += inv.paid_amount || 0;
    const openAmount = inv.open_amount || 0;

    if (openAmount > 0) {
      openCents += openAmount;
      openCount += 1;
      const overdue = inv.days_overdue || 0;

      if (overdue <= 30) {
        agingBuckets['0-30'].count += 1;
        agingBuckets['0-30'].value += openAmount;
      } else if (overdue <= 60) {
        agingBuckets['31-60'].count += 1;
        agingBuckets['31-60'].value += openAmount;
      } else if (overdue <= 90) {
        agingBuckets['61-90'].count += 1;
        agingBuckets['61-90'].value += openAmount;
      } else {
        agingBuckets['90+'].count += 1;
        agingBuckets['90+'].value += openAmount;
      }
    }
  }

  const matchedPercent = totalInvoicedCents > 0
    ? Number(((paidCents / totalInvoicedCents) * 100).toFixed(2))
    : 0;

  const exceptionsCount = (exceptions || []).length;
  const suggestedCount = (matches || []).filter((m) => m.state === 'suggested').length;

  return {
    total_invoiced: totalInvoicedCents,
    matched_value: paidCents,
    matched_percent: matchedPercent,
    open_count: openCount,
    open_value: openCents,
    exceptions_count: exceptionsCount,
    suggested_count: suggestedCount,
    aging_buckets: agingBuckets,
  };
}

/**
 * Transforms internal state rows into AG Studio data sources format,
 * converting all integer cent fields into decimal numbers at this boundary.
 *
 * @param {object} state
 * @returns {{ invoices: Array, transactions: Array, matches: Array }}
 */
export function toStudioSources(state = {}) {
  const invoices = (state.invoices || []).map((inv) => ({
    id: inv.id,
    number: inv.number,
    customer_name: inv.customer_name,
    customer_email: inv.customer_email,
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    amount: fromCents(inv.amount),
    currency: inv.currency,
    paypal_status: inv.paypal_status,
    paid_amount: fromCents(inv.paid_amount),
    open_amount: fromCents(inv.open_amount),
    days_overdue: inv.days_overdue,
    match_status: inv.match_status,
  }));

  const transactions = (state.transactions || []).map((txn) => ({
    id: txn.id,
    date: txn.date,
    payer_name: txn.payer_name,
    payer_email: txn.payer_email,
    gross: fromCents(txn.gross),
    fee: fromCents(txn.fee),
    net: fromCents(txn.net),
    currency: txn.currency,
    event_code: txn.event_code,
    kind: txn.kind,
    invoice_ref: txn.invoice_ref,
    note: txn.note,
    match_status: txn.match_status,
  }));

  const matches = (state.matches || []).map((m) => ({
    id: m.id,
    transaction_id: m.transaction_id,
    invoice_id: m.invoice_id,
    allocated: fromCents(m.allocated),
    method: m.method,
    confidence: Number(Number(m.confidence || 0).toFixed(2)),
    reasons: Array.isArray(m.reasons) ? m.reasons.join('; ') : String(m.reasons || ''),
    state: m.state,
  }));

  return {
    invoices,
    transactions,
    matches,
  };
}
