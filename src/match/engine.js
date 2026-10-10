/**
 * SettleSight — Deterministic Reconciliation Match Engine.
 *
 * Pre-existing work disclosure:
 * Extends the deterministic exact-match heuristics and invariant validation
 * originally authored in products/invoice-match-desk/core.js (written before 2026-10-01).
 *
 * Rules priority:
 * 1. exact (confidence 1.0, state: 'auto')
 * 2. fee_adjusted (confidence 0.92, state: 'suggested')
 * 3. combined (confidence 0.88, state: 'suggested')
 * 4. partial (confidence 0.80, state: 'suggested')
 * 5. email (confidence 0.75, state: 'suggested')
 * 6. refund (confidence 0.85, state: 'suggested')
 * 7. duplicate (confidence 0.70, state: 'suggested')
 *
 * Ambiguity (several candidates with equal top scores) becomes an exception, never auto-matched.
 */

import { normalizeInvoices, normalizeTransactions } from './normalize.js';
import { findCandidatesForTxn } from './rules.js';
import { validateAllocation } from './validator.js';
import { summarize, toStudioSources } from './summary.js';

export { validateAllocation, summarize, toStudioSources };

/**
 * Derives the current match_status for an invoice based on state.
 *
 * @param {object} invoice
 * @param {object} state
 * @returns {'matched'|'suggested'|'exception'|'open'}
 */
export function deriveInvoiceStatus(invoice, state = {}) {
  const matches = state.matches || [];
  const exceptions = state.exceptions || [];

  const committed = matches
    .filter((m) => m.invoice_id === invoice.id && (m.state === 'auto' || m.state === 'approved'))
    .reduce((sum, m) => sum + (m.allocated || 0), 0);

  const openAmount = Math.max(0, invoice.amount - committed);
  if (openAmount === 0) {
    return 'matched';
  }

  const hasPendingSuggested = matches.some(
    (m) => m.invoice_id === invoice.id && m.state === 'suggested'
  );
  if (hasPendingSuggested) {
    return 'suggested';
  }

  const inExceptions = exceptions.some(
    (e) => e.invoice_id === invoice.id || (e.invoice_ids && e.invoice_ids.includes(invoice.id))
  );
  if (inExceptions) {
    return 'exception';
  }

  return 'open';
}

/**
 * Derives the current match_status for a transaction based on state.
 *
 * @param {object} transaction
 * @param {object} state
 * @returns {'matched'|'suggested'|'exception'|'unmatched'}
 */
export function deriveTransactionStatus(transaction, state = {}) {
  const matches = state.matches || [];
  const exceptions = state.exceptions || [];

  const committed = matches
    .filter((m) => m.transaction_id === transaction.id && (m.state === 'auto' || m.state === 'approved'))
    .reduce((sum, m) => sum + (m.allocated || 0), 0);

  const remainingGross = Math.max(0, Math.abs(transaction.gross) - committed);
  if (remainingGross === 0 && committed > 0) {
    return 'matched';
  }

  const hasPendingSuggested = matches.some(
    (m) => m.transaction_id === transaction.id && m.state === 'suggested'
  );
  if (hasPendingSuggested) {
    return 'suggested';
  }

  const inExceptions = exceptions.some(
    (e) => e.transaction_id === transaction.id || (e.transaction_ids && e.transaction_ids.includes(transaction.id))
  );
  if (inExceptions) {
    return 'exception';
  }

  return 'unmatched';
}

/**
 * Refreshes open amounts, paid amounts, and statuses across invoices and transactions.
 *
 * @param {object} state
 */
export function refreshEntityStatus(state = {}) {
  const matches = state.matches || [];
  for (const inv of state.invoices || []) {
    const committed = matches
      .filter((m) => m.invoice_id === inv.id && (m.state === 'auto' || m.state === 'approved'))
      .reduce((sum, m) => sum + (m.allocated || 0), 0);
    inv.paid_amount = committed;
    inv.open_amount = Math.max(0, inv.amount - committed);
    inv.match_status = deriveInvoiceStatus(inv, state);
  }
  for (const txn of state.transactions || []) {
    txn.match_status = deriveTransactionStatus(txn, state);
  }
}

/**
 * Checks if candidates for a transaction have an ambiguous tie at the top score.
 *
 * @param {Array<object>} candidates
 * @returns {boolean} True if multiple competing candidates share the top confidence
 */
function isAmbiguousCandidates(candidates) {
  if (candidates.length <= 1) return false;
  const isSingleCombinedGroup = candidates.every((c) => c.method === 'combined') &&
    candidates[0]?.reasons?.[0]?.includes('covers');
  if (isSingleCombinedGroup && !candidates.some((c) => c.reasons?.[0]?.startsWith('Ambiguous'))) {
    return false;
  }
  const topScore = candidates[0].confidence;
  const topTies = candidates.filter((c) => Math.abs(c.confidence - topScore) < 0.001);
  return topTies.length > 1;
}

/**
 * Proposes matches between invoices and transactions using prioritized deterministic rules.
 *
 * @param {Array<object>} rawInvoices Normalized or raw PayPal invoices
 * @param {Array<object>} rawTransactions Normalized or raw PayPal transactions
 * @param {object} [opts]
 * @param {boolean} [opts.autoApplyExact=true] Whether exact matches automatically update balances
 * @returns {{ matches: Array, exceptions: Array, summary: object, state: object }}
 */
export function proposeMatches(rawInvoices, rawTransactions, opts = {}) {
  const autoApplyExact = opts.autoApplyExact ?? true;

  const invoices = (rawInvoices || []).map((i) =>
    i.open_amount !== undefined ? { ...i } : normalizeInvoices([i], opts)[0]
  );
  const transactions = (rawTransactions || []).map((t) =>
    t.gross !== undefined ? { ...t } : normalizeTransactions([t], opts)[0]
  );

  const matches = [];
  const exceptions = [];
  const settledInvoiceIds = new Set(
    invoices.filter((i) => i.open_amount === 0).map((i) => i.id)
  );

  const sortedTxns = [...transactions].sort((a, b) => {
    const dComp = (a.date || '').localeCompare(b.date || '');
    if (dComp !== 0) return dComp;
    return a.id.localeCompare(b.id);
  });

  const txnsByDate = new Map();
  for (const t of sortedTxns) {
    const d = t.date || 'unknown';
    if (!txnsByDate.has(d)) txnsByDate.set(d, []);
    txnsByDate.get(d).push(t);
  }

  for (const [, dayTxns] of txnsByDate.entries()) {
    const dayCandidatesMap = new Map();
    for (const txn of dayTxns) {
      const candidates = findCandidatesForTxn(txn, invoices, settledInvoiceIds);
      dayCandidatesMap.set(txn.id, candidates);
    }

    const dayInvoiceClaimMap = new Map();
    for (const [txnId, cands] of dayCandidatesMap.entries()) {
      if (cands.length === 1 && cands[0].confidence >= 0.8) {
        const invId = cands[0].invoice_id;
        if (!dayInvoiceClaimMap.has(invId)) dayInvoiceClaimMap.set(invId, []);
        dayInvoiceClaimMap.get(invId).push({ txnId, cand: cands[0] });
      }
    }

    const dayConflictingTxnIds = new Set();
    const dayConflictingInvIds = new Set();

    for (const [invId, claims] of dayInvoiceClaimMap.entries()) {
      if (claims.length > 1) {
        const topScore = claims[0].cand.confidence;
        const equalClaims = claims.filter((c) => Math.abs(c.cand.confidence - topScore) < 0.001);
        if (equalClaims.length > 1) {
          dayConflictingInvIds.add(invId);
          equalClaims.forEach((c) => dayConflictingTxnIds.add(c.txnId));

          exceptions.push({
            id: `exc_${exceptions.length + 1}`,
            type: 'ambiguity',
            invoice_id: invId,
            transaction_ids: equalClaims.map((c) => c.txnId),
            confidence: topScore,
            reasons: [
              `Ambiguity: multiple transactions (${equalClaims.map((c) => c.txnId).join(', ')}) compete for invoice ${invId} with equal confidence ${topScore}`,
            ],
          });
        }
      }
    }

    for (const txn of dayTxns) {
      if (dayConflictingTxnIds.has(txn.id)) {
        txn.match_status = 'exception';
        continue;
      }

      const candidates = dayCandidatesMap.get(txn.id) || [];
      if (candidates.length === 0) continue;

      if (isAmbiguousCandidates(candidates)) {
        txn.match_status = 'exception';
        const candidateInvIds = candidates.map((c) => c.invoice_id);
        for (const invId of candidateInvIds) {
          const inv = invoices.find((i) => i.id === invId);
          if (inv) inv.match_status = 'exception';
        }

        exceptions.push({
          id: `exc_${exceptions.length + 1}`,
          type: 'ambiguity',
          transaction_id: txn.id,
          invoice_ids: candidateInvIds,
          confidence: candidates[0].confidence,
          reasons: [
            `Ambiguity: transaction ${txn.id} has ${candidates.length} competing candidates with equal confidence ${candidates[0].confidence}`,
          ],
        });
        continue;
      }

      for (const cand of candidates) {
        if (dayConflictingInvIds.has(cand.invoice_id)) continue;

        const matchId = `mat_${matches.length + 1}`;
        const matchRecord = {
          id: matchId,
          transaction_id: cand.transaction_id,
          invoice_id: cand.invoice_id,
          allocated: cand.allocated,
          method: cand.method,
          confidence: cand.confidence,
          reasons: cand.reasons,
          state: cand.state,
        };

        matches.push(matchRecord);

        const targetInv = invoices.find((i) => i.id === cand.invoice_id);
        if (cand.state === 'auto' && autoApplyExact && targetInv) {
          targetInv.paid_amount += cand.allocated;
          targetInv.open_amount = Math.max(0, targetInv.amount - targetInv.paid_amount);
          if (targetInv.open_amount === 0) {
            settledInvoiceIds.add(targetInv.id);
          }
        }
      }
    }
  }

  const state = { invoices, transactions, matches, exceptions };
  refreshEntityStatus(state);
  const summary = summarize(state);

  return { matches, exceptions, summary, state };
}

/**
 * Applies a seller or agent decision to an existing match record.
 *
 * @param {object} state Current reconciliation state
 * @param {string} matchId ID of match to update
 * @param {'approve'|'reject'} decision Decision action
 * @returns {object} Updated state
 */
export function applyDecision(state, matchId, decision) {
  if (!state || !state.matches) {
    throw new Error('Invalid state provided to applyDecision');
  }

  const match = state.matches.find((m) => m.id === matchId);
  if (!match) {
    throw new Error(`Match not found: ${matchId}`);
  }

  if (decision === 'approve') {
    const validation = validateAllocation(match, state);
    if (!validation.valid) {
      throw new Error(`Cannot approve invalid allocation: ${validation.error}`);
    }
    match.state = 'approved';
  } else if (decision === 'reject') {
    match.state = 'rejected';
  } else {
    throw new Error(`Unsupported decision: ${decision}. Use 'approve' or 'reject'.`);
  }

  refreshEntityStatus(state);
  return state;
}
