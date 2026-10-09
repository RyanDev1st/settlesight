/**
 * SettleSight — Reconciliation Agent Custom Tools
 *
 * Provides deterministic tool implementations for querying exceptions,
 * explaining matches, proposing allocations, and drafting payment reminders.
 */

import { validateAllocation } from '../match/validator.js';
import { applyDecision } from '../match/engine.js';
import { fromCents } from '../match/normalize.js';

/**
 * Lists candidate matches and ambiguous exceptions requiring review.
 */
export function listExceptions(state, filter) {
  const invoices = state.invoices || [];
  const transactions = state.transactions || [];
  const matches = state.matches || [];
  const exceptions = state.exceptions || [];

  const items = [];

  // 1. Matches flagged as suggested or with confidence < 1.0
  for (const m of matches) {
    if (m.state === 'suggested' || (m.confidence !== undefined && m.confidence < 1.0)) {
      const inv = invoices.find((i) => i.id === m.invoice_id);
      const txn = transactions.find((t) => t.id === m.transaction_id);

      if (filter?.minConfidence !== undefined && (m.confidence || 0) < filter.minConfidence) continue;
      if (filter?.maxConfidence !== undefined && (m.confidence || 0) > filter.maxConfidence) continue;
      if (filter?.overdueDays !== undefined && (inv?.days_overdue || 0) < filter.overdueDays) continue;

      items.push({
        id: m.id,
        invoiceId: m.invoice_id,
        invoiceNumber: inv?.number || m.invoice_id,
        customerName: inv?.customer_name || 'Unknown Customer',
        transactionId: m.transaction_id,
        payerName: txn?.payer_name || 'Unknown Payer',
        allocated: fromCents(m.allocated),
        openAmount: fromCents(inv?.open_amount || 0),
        method: m.method || 'heuristic',
        confidence: Number(Number(m.confidence || 0).toFixed(2)),
        reasons: Array.isArray(m.reasons) ? m.reasons.join('; ') : String(m.reasons || ''),
        state: m.state,
      });
    }
  }

  // 2. Ambiguity exceptions
  for (const exc of exceptions) {
    const inv = invoices.find((i) => i.id === exc.invoice_id);
    const txn = transactions.find((t) => t.id === exc.transaction_id);
    items.push({
      id: exc.id,
      invoiceId: exc.invoice_id || 'multiple',
      invoiceNumber: inv?.number || exc.invoice_id || 'Multiple Invoices',
      customerName: inv?.customer_name || 'Competing Claims',
      transactionId: exc.transaction_id || 'multiple',
      payerName: txn?.payer_name || 'Multiple Transactions',
      allocated: 0,
      openAmount: fromCents(inv?.open_amount || 0),
      method: 'ambiguity',
      confidence: exc.confidence || 0.5,
      reasons: Array.isArray(exc.reasons) ? exc.reasons.join('; ') : String(exc.reasons || 'Ambiguous match'),
      state: 'exception',
    });
  }

  return items;
}

/**
 * Returns a comprehensive audit explanation for a specific candidate match.
 */
export function explainMatch(state, matchId) {
  const match = (state.matches || []).find((m) => m.id === matchId);
  if (!match) {
    throw new Error(`Match record not found: ${matchId}`);
  }

  const inv = (state.invoices || []).find((i) => i.id === match.invoice_id);
  const txn = (state.transactions || []).find((t) => t.id === match.transaction_id);

  const invAmount = fromCents(inv?.amount || 0);
  const txnGross = fromCents(txn?.gross || 0);
  const txnFee = fromCents(txn?.fee || 0);
  const txnNet = fromCents(txn?.net || 0);
  const allocatedDollars = fromCents(match.allocated);

  let explanation = `Match method '${match.method}' with ${(match.confidence * 100).toFixed(0)}% confidence. `;
  if (match.reasons) {
    explanation += Array.isArray(match.reasons) ? match.reasons.join('. ') : match.reasons;
  }

  let recommendedAction = 'Approve match if customer name or reference aligns with your records.';
  if (match.method === 'fee_adjusted') {
    recommendedAction = `Confirm PayPal fee deduction: Gross $${txnGross.toFixed(2)} minus fee $${txnFee.toFixed(2)} matches net deposit.`;
  } else if (match.method === 'partial') {
    recommendedAction = `Confirm partial settlement: $${allocatedDollars.toFixed(2)} of $${invAmount.toFixed(2)} total invoice.`;
  } else if (match.method === 'email') {
    recommendedAction = `Verify buyer identity: Payer email matches invoice recipient, but reference code was omitted.`;
  }

  return {
    matchId: match.id,
    invoiceId: match.invoice_id,
    invoiceNumber: inv?.number || match.invoice_id,
    transactionId: match.transaction_id,
    customerName: inv?.customer_name || 'Unknown',
    payerName: txn?.payer_name || 'Unknown',
    allocatedDollars,
    invoiceTotalDollars: invAmount,
    transactionGrossDollars: txnGross,
    feeDollars: txnFee,
    netDollars: txnNet,
    method: match.method,
    confidence: match.confidence,
    explanation,
    recommendedAction,
  };
}

/**
 * Validates a proposed allocation against math rules without mutating state.
 */
export function proposeAllocation(state, matchId, allocatedCents) {
  const match = (state.matches || []).find((m) => m.id === matchId);
  if (!match) {
    return { valid: false, allocatedCents, allocatedDollars: fromCents(allocatedCents), error: `Match ${matchId} not found` };
  }

  const candidate = { ...match, allocated: allocatedCents };
  const validation = validateAllocation(candidate, state);

  return {
    valid: validation.valid,
    allocatedCents,
    allocatedDollars: fromCents(allocatedCents),
    error: validation.error,
  };
}

/**
 * Approves a candidate match after validating allocation math.
 */
export function approveMatch(state, matchId, _options) {
  const match = (state.matches || []).find((m) => m.id === matchId);
  if (!match) {
    return { success: false, matchId, error: `Match ${matchId} not found` };
  }

  const validation = validateAllocation(match, state);
  if (!validation.valid) {
    return { success: false, matchId, error: validation.error || 'Allocation invariant failed' };
  }

  try {
    const updatedState = applyDecision(state, matchId, 'approve');
    return { success: true, matchId, state: updatedState };
  } catch (err) {
    return { success: false, matchId, error: err.message };
  }
}

/**
 * Drafts a professional payment reminder email for an invoice.
 * NEVER sends automatically; explicitly returns a draft.
 */
export function draftReminder(state, invoiceQuery) {
  const invoices = state.invoices || [];
  const q = String(invoiceQuery).toLowerCase().trim();

  let inv = invoices.find((i) => {
    return (
      (i.id && i.id.toLowerCase() === q) ||
      (i.number && i.number.toLowerCase() === q) ||
      (i.customer_name && i.customer_name.toLowerCase().includes(q)) ||
      (i.number && i.number.toLowerCase().includes(q))
    );
  });

  // If no direct name/number match, fall back to the most overdue open invoice
  if (!inv) {
    const overdueList = invoices
      .filter((i) => (i.open_amount || 0) > 0)
      .sort((a, b) => (b.days_overdue || 0) - (a.days_overdue || 0));
    inv = overdueList[0] || invoices[0];
  }

  if (!inv) {
    throw new Error(`No invoice available to draft reminder for`);
  }

  const openDollars = fromCents(inv.open_amount || 0);
  const totalDollars = fromCents(inv.amount || 0);
  const daysOverdue = inv.days_overdue || 0;
  const custName = inv.customer_name || 'Valued Customer';
  const recipientEmail = inv.customer_email || 'accounting@customer.com';
  const invNumber = inv.number || inv.id;
  const dueDate = inv.due_date || 'immediate';

  const subject = daysOverdue > 0
    ? `Friendly Reminder: Payment overdue for Invoice ${invNumber} ($${openDollars.toFixed(2)})`
    : `Upcoming Due Date: Invoice ${invNumber} ($${openDollars.toFixed(2)})`;

  const body = `Dear ${custName},\n\n` +
    `I hope this note finds you well.\n\n` +
    `This is a friendly reminder regarding Invoice ${invNumber} for $${totalDollars.toFixed(2)}, which had a due date of ${dueDate} ` +
    (daysOverdue > 0 ? `(${daysOverdue} days ago).\n\n` : `.\n\n`) +
    `Our records show an open balance of $${openDollars.toFixed(2)}. ` +
    `You can review and complete payment securely via PayPal using your customer invoice link:\n` +
    `https://www.paypal.com/invoice/p/#${inv.id}\n\n` +
    `If you have already sent this payment or if you have any questions, please let us know so we can update our accounts.\n\n` +
    `Thank you for your business,\n` +
    `Accounts Receivable`;

  return {
    invoiceId: inv.id,
    invoiceNumber: invNumber,
    recipientEmail,
    recipientName: custName,
    subject,
    body,
    openAmountDollars: openDollars,
    daysOverdue,
    status: 'draft_only',
  };
}
