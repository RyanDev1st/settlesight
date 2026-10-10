/**
 * SettleSight — Reconciliation Matching Rules.
 *
 * Pre-existing work credit:
 * Extends the deterministic exact-match heuristics originally authored in
 * products/invoice-match-desk/core.js (written before 2026-10-01).
 *
 * Priority order of matching rules:
 * 1. exact: Reference matches + gross equals open amount (confidence: 1.0, state: 'auto')
 * 2. fee_adjusted: Net or gross within fee tolerance of open amount (confidence: 0.92, state: 'suggested')
 * 3. combined: One payment equals sum of 2-3 open invoices for same email (confidence: 0.88, state: 'suggested')
 * 4. partial: Payment smaller than open amount with matching email or ref (confidence: 0.80, state: 'suggested')
 * 5. email: Gross equals open amount with matching email, no ref (confidence: 0.75, state: 'suggested')
 * 6. refund: Refund event linked by ref or amount + email (confidence: 0.85, state: 'suggested')
 * 7. duplicate: Second payment for an already-settled invoice (confidence: 0.70, state: 'suggested')
 */

/**
 * Checks if references match.
 *
 * @param {string} ref
 * @param {object} inv
 * @returns {boolean}
 */
export function matchRef(ref, inv) {
  if (!ref || !inv) return false;
  const cleanRef = String(ref).trim().toUpperCase();
  const cleanNum = String(inv.number || '').trim().toUpperCase();
  const cleanId = String(inv.id || '').trim().toUpperCase();
  return cleanRef === cleanNum || cleanRef === cleanId;
}

/**
 * Checks if emails match.
 *
 * @param {string} emailA
 * @param {string} emailB
 * @returns {boolean}
 */
export function matchEmail(emailA, emailB) {
  if (!emailA || !emailB) return false;
  return emailA.trim().toLowerCase() === emailB.trim().toLowerCase();
}

/**
 * Evaluates candidates for a single transaction against candidate invoices.
 *
 * @param {object} txn Normalized transaction
 * @param {Array<object>} invoices Normalized invoices
 * @param {Set<string>} settledInvoiceIds Set of invoice IDs that are already fully satisfied
 * @returns {Array<object>} List of candidate match objects
 */
export function findCandidatesForTxn(txn, invoices, settledInvoiceIds = new Set()) {
  const candidates = [];
  const openInvoices = invoices.filter((i) => i.open_amount > 0 && !settledInvoiceIds.has(i.id));

  // 1. Exact Match
  if (txn.kind === 'payment' && txn.invoice_ref) {
    for (const inv of openInvoices) {
      if (matchRef(txn.invoice_ref, inv) && txn.gross === inv.open_amount) {
        candidates.push({
          method: 'exact',
          confidence: 1.0,
          state: 'auto',
          invoice_id: inv.id,
          transaction_id: txn.id,
          allocated: txn.gross,
          reasons: [
            `Exact match: reference ${inv.number} matches and gross $${(txn.gross / 100).toFixed(2)} equals open amount`,
          ],
        });
      }
    }
    if (candidates.length > 0) return candidates;
  }

  // 6. Refund Match (Priority high if transaction is a refund)
  if (txn.kind === 'refund' || txn.event_code?.startsWith('T11') || txn.gross < 0) {
    const refundAbs = Math.abs(txn.gross);
    for (const inv of invoices) {
      const refMatched = txn.invoice_ref && matchRef(txn.invoice_ref, inv);
      const emailMatched = matchEmail(txn.payer_email, inv.customer_email);
      const amountMatched = refundAbs === inv.paid_amount || refundAbs === inv.amount;

      if (refMatched || (emailMatched && amountMatched)) {
        candidates.push({
          method: 'refund',
          confidence: 0.85,
          state: 'suggested',
          invoice_id: inv.id,
          transaction_id: txn.id,
          allocated: refundAbs,
          reasons: [
            `Refund match: $${(refundAbs / 100).toFixed(2)} refund linked to ${inv.number} via ${refMatched ? 'reference' : 'email and amount'}`,
          ],
        });
      }
    }
    if (candidates.length > 0) return candidates;
  }

  // 2. Fee Adjusted Match
  if (txn.kind === 'payment') {
    for (const inv of openInvoices) {
      const refMatched = txn.invoice_ref && matchRef(txn.invoice_ref, inv);
      const emailMatched = matchEmail(txn.payer_email, inv.customer_email);

      if ((refMatched || emailMatched) && txn.gross !== inv.open_amount) {
        const feeTolerance = Math.max(txn.fee || 0, 500); // at least $5.00 tolerance
        const isNetEqual = txn.net === inv.open_amount;
        const isGrossMinusFee = txn.gross === (inv.open_amount - (txn.fee || 0));
        const withinFeeMargin = Math.abs(txn.gross - inv.open_amount) <= feeTolerance ||
          Math.abs(txn.net - inv.open_amount) <= feeTolerance;

        if (isNetEqual || isGrossMinusFee || withinFeeMargin) {
          candidates.push({
            method: 'fee_adjusted',
            confidence: 0.92,
            state: 'suggested',
            invoice_id: inv.id,
            transaction_id: txn.id,
            allocated: Math.min(txn.gross, inv.open_amount),
            reasons: [
              `Fee-adjusted match: payment within fee tolerance of open amount for ${inv.number} (fee: $${((txn.fee || 0) / 100).toFixed(2)})`,
            ],
          });
        }
      }
    }
    if (candidates.length > 0) return candidates;
  }

  // 3. Combined Match (one payment covers 2-3 open invoices for same payer email)
  if (txn.kind === 'payment' && txn.payer_email) {
    const payerInvoices = openInvoices.filter((i) => matchEmail(txn.payer_email, i.customer_email));
    if (payerInvoices.length >= 2) {
      const combinations = findInvoiceCombinations(payerInvoices, txn.gross, 3);
      if (combinations.length === 1) {
        const matchedGroup = combinations[0];
        const groupRefs = matchedGroup.map((i) => i.number).join(', ');
        for (const inv of matchedGroup) {
          candidates.push({
            method: 'combined',
            confidence: 0.88,
            state: 'suggested',
            invoice_id: inv.id,
            transaction_id: txn.id,
            allocated: inv.open_amount,
            reasons: [
              `Combined payment: $${(txn.gross / 100).toFixed(2)} covers ${matchedGroup.length} invoices (${groupRefs}) for ${txn.payer_email}`,
            ],
          });
        }
        return candidates;
      }
      if (combinations.length > 1) {
        // Ambiguous combination: flag as equal candidates for exception
        for (const group of combinations) {
          for (const inv of group) {
            candidates.push({
              method: 'combined',
              confidence: 0.88,
              state: 'suggested',
              invoice_id: inv.id,
              transaction_id: txn.id,
              allocated: inv.open_amount,
              reasons: [
                `Ambiguous combined candidate: covers invoices (${group.map((g) => g.number).join(', ')})`,
              ],
            });
          }
        }
        return candidates;
      }
    }
  }

  // 4. Partial Match
  if (txn.kind === 'payment') {
    for (const inv of openInvoices) {
      const refMatched = txn.invoice_ref && matchRef(txn.invoice_ref, inv);
      const emailMatched = matchEmail(txn.payer_email, inv.customer_email);

      if ((refMatched || emailMatched) && txn.gross > 0 && txn.gross < inv.open_amount) {
        candidates.push({
          method: 'partial',
          confidence: 0.80,
          state: 'suggested',
          invoice_id: inv.id,
          transaction_id: txn.id,
          allocated: txn.gross,
          reasons: [
            `Partial payment: $${(txn.gross / 100).toFixed(2)} received toward open balance $${(inv.open_amount / 100).toFixed(2)} on ${inv.number}`,
          ],
        });
      }
    }
    if (candidates.length > 0) return candidates;
  }

  // 5. Email Match (amount matches one open invoice, no reference)
  if (txn.kind === 'payment' && !txn.invoice_ref && txn.payer_email) {
    for (const inv of openInvoices) {
      if (matchEmail(txn.payer_email, inv.customer_email) && txn.gross === inv.open_amount) {
        candidates.push({
          method: 'email',
          confidence: 0.75,
          state: 'suggested',
          invoice_id: inv.id,
          transaction_id: txn.id,
          allocated: txn.gross,
          reasons: [
            `Email match: amount $${(txn.gross / 100).toFixed(2)} matches open invoice ${inv.number} for ${txn.payer_email} without reference`,
          ],
        });
      }
    }
    if (candidates.length > 0) return candidates;
  }

  // 7. Duplicate Match (second payment for already settled invoice)
  if (txn.kind === 'payment') {
    for (const inv of invoices) {
      const isSettled = inv.open_amount === 0 || settledInvoiceIds.has(inv.id);
      if (isSettled) {
        const refMatched = txn.invoice_ref && matchRef(txn.invoice_ref, inv);
        const emailAndAmount = matchEmail(txn.payer_email, inv.customer_email) && txn.gross === inv.amount;

        if (refMatched || emailAndAmount) {
          candidates.push({
            method: 'duplicate',
            confidence: 0.70,
            state: 'suggested',
            invoice_id: inv.id,
            transaction_id: txn.id,
            allocated: txn.gross,
            reasons: [
              `Duplicate payment: $${(txn.gross / 100).toFixed(2)} received for already-settled invoice ${inv.number}`,
            ],
          });
        }
      }
    }
    if (candidates.length > 0) return candidates;
  }

  return candidates;
}

/**
 * Finds subsets of 2 or 3 invoices whose open amounts sum exactly to target.
 *
 * @param {Array<object>} invoices
 * @param {number} targetCents
 * @param {number} maxCount Maximum invoices in combination (default: 3)
 * @returns {Array<Array<object>>} Matching subsets
 */
export function findInvoiceCombinations(invoices, targetCents, maxCount = 3) {
  const results = [];
  const n = invoices.length;

  // Pairs (size 2)
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (invoices[i].open_amount + invoices[j].open_amount === targetCents) {
        results.push([invoices[i], invoices[j]]);
      }
    }
  }

  // Triplets (size 3)
  if (maxCount >= 3) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        for (let k = j + 1; k < n; k++) {
          if (invoices[i].open_amount + invoices[j].open_amount + invoices[k].open_amount === targetCents) {
            results.push([invoices[i], invoices[j], invoices[k]]);
          }
        }
      }
    }
  }

  return results;
}
