/**
 * SettleSight — Allocation Invariant Validator.
 *
 * Pre-existing work credit:
 * Extends the allocation safety checks and invariant principles originally
 * authored in products/invoice-match-desk/core.js (written before 2026-10-01).
 *
 * Invariants:
 * 1. Both transaction and invoice must exist in current state.
 * 2. Currencies must match exactly.
 * 3. Allocation amount must be a positive integer of cents.
 * 4. Only matches in state 'auto' or 'approved' consume capacity.
 * 5. Invoice cannot be over-allocated beyond its available amount.
 * 6. Transaction cannot allocate more than its available gross amount.
 */

/**
 * Validates a proposed match allocation against current state invariants.
 * Single source of truth: only matches in state 'auto' or 'approved' consume capacity.
 *
 * @param {object} alloc Proposed allocation { id, transaction_id, invoice_id, allocated }
 * @param {object} state Current reconciliation state { invoices, transactions, matches }
 * @returns {{ valid: boolean, error?: string, reasons: string[] }} Validation outcome
 */
export function validateAllocation(alloc, state = {}) {
  const reasons = [];

  if (!alloc || typeof alloc !== 'object') {
    return { valid: false, error: 'Allocation payload is required', reasons: ['Allocation payload is missing or invalid'] };
  }

  const txnId = alloc.transaction_id || alloc.transactionId;
  const invId = alloc.invoice_id || alloc.invoiceId;
  const allocatedCents = alloc.allocated;

  if (!txnId) {
    reasons.push('Missing transaction_id in allocation');
  }
  if (!invId) {
    reasons.push('Missing invoice_id in allocation');
  }

  if (reasons.length > 0) {
    return { valid: false, error: reasons.join('; '), reasons };
  }

  const invoices = state.invoices || [];
  const transactions = state.transactions || [];
  const matches = state.matches || [];

  const invoice = invoices.find((i) => i.id === invId || i.number === invId);
  const transaction = transactions.find((t) => t.id === txnId);

  if (!invoice) {
    reasons.push(`Invoice not found for ID: ${invId}`);
  }
  if (!transaction) {
    reasons.push(`Transaction not found for ID: ${txnId}`);
  }

  if (!invoice || !transaction) {
    return { valid: false, error: reasons.join('; '), reasons };
  }

  // Integer cents invariant
  if (typeof allocatedCents !== 'number' || !Number.isSafeInteger(allocatedCents) || allocatedCents <= 0) {
    reasons.push(`Allocated amount must be a positive integer of cents, got ${allocatedCents}`);
  }

  // Currency match invariant
  const invCurrency = (invoice.currency || 'USD').toUpperCase();
  const txnCurrency = (transaction.currency || 'USD').toUpperCase();
  if (invCurrency !== txnCurrency) {
    reasons.push(`Currency mismatch: invoice is ${invCurrency} but transaction is ${txnCurrency}`);
  }

  // Single source of truth: only matches in state 'auto' or 'approved' consume capacity.
  // Excluding alloc.id so validating an existing suggested/auto/approved match does not count against itself.
  const allocId = alloc.id;

  const committedInvAllocated = matches
    .filter(
      (m) =>
        m.invoice_id === invoice.id &&
        (m.state === 'auto' || m.state === 'approved') &&
        m.id !== allocId
    )
    .reduce((sum, m) => sum + (m.allocated || 0), 0);

  const availableInvOpen = Math.max(0, invoice.amount - (invoice.baseline_paid || 0) - committedInvAllocated);
  if (allocatedCents > availableInvOpen) {
    reasons.push(
      `Invoice ${invoice.number} (${invoice.id}) over-allocated: requested ${allocatedCents} cents exceeds available open amount ${availableInvOpen} cents`
    );
  }

  const committedTxnAllocated = matches
    .filter(
      (m) =>
        m.transaction_id === transaction.id &&
        (m.state === 'auto' || m.state === 'approved') &&
        m.id !== allocId
    )
    .reduce((sum, m) => sum + (m.allocated || 0), 0);

  const availableTxnGross = Math.max(0, Math.abs(transaction.gross) - committedTxnAllocated);
  if (transaction.recorded_payment_invoice_id) {
    reasons.push(`Transaction ${transaction.id} is already included in the PayPal recorded-payment baseline`);
  }
  if (allocatedCents > availableTxnGross) {
    reasons.push(
      `Transaction ${transaction.id} over-allocated: requested ${allocatedCents} cents exceeds available gross ${availableTxnGross} cents`
    );
  }

  if (reasons.length > 0) {
    return { valid: false, error: reasons.join('; '), reasons };
  }

  return { valid: true, reasons: [] };
}
