/**
 * SettleSight — Normalization layer for PayPal Invoicing v2 and Transaction Search v1.
 *
 * REST API References:
 * - PayPal Invoicing v2 API: https://developer.paypal.com/docs/api/invoicing/v2/
 * - PayPal Transaction Search v1 API: https://developer.paypal.com/docs/api/transaction-search/v1/
 * - PayPal Transaction Event Codes: https://developer.paypal.com/docs/transaction-search/transaction-event-codes/
 *
 * All monetary amounts are converted and held as integer cents internally.
 */

/**
 * Converts a currency value (decimal string, number, or object) to integer cents.
 *
 * @param {string|number|null|undefined} val
 * @returns {number} Integer cents
 */
export function toCents(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') {
    return Math.round(val * 100);
  }
  const str = String(val).trim();
  if (!str) return 0;
  const isNegative = str.startsWith('-');
  const clean = str.replace(/^[+-]/, '').replace(/,/g, '');
  const [whole = '0', frac = ''] = clean.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0').slice(0, 2));
  return isNegative ? -cents : cents;
}

/**
 * Converts integer cents back to decimal representation.
 *
 * @param {number} cents
 * @returns {number} Decimal number rounded to 2 decimal places
 */
export function fromCents(cents) {
  return Number(((cents || 0) / 100).toFixed(2));
}

/**
 * Calculates days overdue between a due date and reference date.
 *
 * @param {string} dueDate ISO YYYY-MM-DD
 * @param {string|Date} [asOfDate='2026-10-09']
 * @returns {number} Days overdue (0 if not overdue)
 */
export function calculateDaysOverdue(dueDate, asOfDate = '2026-10-09') {
  if (!dueDate) return 0;
  const due = new Date(dueDate.slice(0, 10));
  const asOf = typeof asOfDate === 'string' ? new Date(asOfDate.slice(0, 10)) : asOfDate;
  if (Number.isNaN(due.getTime()) || Number.isNaN(asOf.getTime())) return 0;
  const diffMs = asOf.getTime() - due.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * Extracts invoice reference number from PayPal transaction fields.
 *
 * @param {object} info PayPal transaction_info object
 * @returns {string} Extracted invoice number or empty string
 */
export function extractInvoiceReference(info = {}) {
  if (info.invoice_id && typeof info.invoice_id === 'string' && info.invoice_id.trim()) {
    return info.invoice_id.trim();
  }
  const text = `${info.transaction_subject || ''} ${info.transaction_note || ''} ${info.custom_field || ''}`.trim();
  if (!text) return '';

  // Match patterns like INV-2026-001, INV_101, INV123 (must have digits)
  const invWithDigits = text.match(/\b(INV(?:OICE)?[-_]?[0-9][A-Za-z0-9-_]*)\b/i);
  if (invWithDigits) return invWithDigits[1].toUpperCase();

  // Match patterns like Invoice #8849, Inv: 101, Invoice 2026-001
  const numMatch = text.match(/\b(?:invoice|inv)\b[#:\s\-_]+([A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)/i);
  if (numMatch && !/^(?:reference|note|payment|received|transfer)$/i.test(numMatch[1])) {
    return numMatch[1].trim();
  }

  return '';
}

/**
 * Determines transaction kind from PayPal transaction event code.
 * Reference: https://developer.paypal.com/docs/transaction-search/transaction-event-codes/
 * - T0006, T0007, T0011, etc: payments
 * - T1107: payment refund (T11xx family)
 *
 * @param {string} eventCode
 * @param {number} grossCents
 * @returns {'payment'|'refund'|'other'}
 */
export function classifyEventCode(eventCode = '', grossCents = 0) {
  const code = String(eventCode).toUpperCase().trim();
  if (code.startsWith('T11')) {
    return 'refund';
  }
  if (grossCents < 0 && !code.startsWith('T02') && !code.startsWith('T00')) {
    return 'refund';
  }
  // T0006 (Express Checkout), T0007 (Standard Checkout), T0011 (Invoicing/Dispute), T0000-T0013
  if (/^T00(0[0-9]|1[0-3])$/.test(code) || code === 'T0006' || code === 'T0007' || code === 'T0011') {
    return 'payment';
  }
  return 'other';
}

/**
 * Normalizes PayPal Invoicing v2 API response items into internal invoice rows.
 * Reference: https://developer.paypal.com/docs/api/invoicing/v2/
 *
 * @param {Array|object} paypalInvoices Array of invoice objects or { items: [...] }
 * @param {object} [opts]
 * @param {string|Date} [opts.asOfDate='2026-10-09'] Reference date for overdue calculation
 * @returns {Array<object>} Normalized invoice objects
 */
export function normalizeInvoices(paypalInvoices, opts = {}) {
  const rawList = Array.isArray(paypalInvoices)
    ? paypalInvoices
    : (paypalInvoices?.items || []);
  const asOf = opts.asOfDate || '2026-10-09';

  return rawList.map((item, index) => {
    const detail = item.detail || {};
    const primaryRecipients = item.primary_recipients || [];
    const recipient = primaryRecipients[0] || {};
    const billingInfo = recipient.billing_info || {};
    const billingName = billingInfo.name || {};

    const fullName = billingName.full_name ||
      [billingName.given_name, billingName.surname].filter(Boolean).join(' ') ||
      billingInfo.email_address ||
      `Customer ${index + 1}`;

    const totalAmount = toCents(item.amount?.value ?? detail.amount?.value ?? 0);
    const recordedPayments = (item.payments?.transactions || [])
      .filter((payment) => payment.type !== 'REFUND')
      .map((payment) => ({
        id: payment.payment_id || payment.transaction_id,
        amount: toCents(payment.amount?.value || 0),
        currency: payment.amount?.currency_code || item.amount?.currency_code || 'USD',
        date: (payment.payment_date || payment.payment_date_time || '').slice(0, 10),
      }));
    const paidValue = item.payments?.paid_amount?.value ?? item.paid_amount?.value;
    const paidAmount = paidValue !== undefined ? toCents(paidValue) : recordedPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const openAmount = Math.max(0, totalAmount - paidAmount);
    const dueDate = detail.payment_term?.due_date || detail.invoice_date || '';
    const daysOverdue = openAmount > 0 ? calculateDaysOverdue(dueDate, asOf) : 0;

    let matchStatus = 'open';
    if (openAmount === 0 && totalAmount > 0) {
      matchStatus = 'matched';
    }

    return {
      id: item.id || `inv_${index + 1}`,
      number: detail.invoice_number || item.id || `INV-${index + 1}`,
      customer_name: fullName,
      customer_email: (billingInfo.email_address || '').trim().toLowerCase(),
      issue_date: (detail.invoice_date || '').slice(0, 10),
      due_date: (dueDate || '').slice(0, 10),
      amount: totalAmount,
      currency: item.amount?.currency_code || detail.currency_code || 'USD',
      paypal_status: item.status || (openAmount === 0 ? 'PAID' : 'SENT'),
      paid_amount: paidAmount,
      baseline_paid: paidAmount,
      recorded_payments: recordedPayments,
      open_amount: openAmount,
      days_overdue: daysOverdue,
      match_status: matchStatus,
    };
  });
}

/**
 * Normalizes PayPal Transaction Search v1 response items into internal transaction rows.
 * Reference: https://developer.paypal.com/docs/api/transaction-search/v1/
 *
 * @param {Array|object} paypalTxns Array of transaction objects or { transaction_details: [...] }
 * @param {object} [opts]
 * @returns {Array<object>} Normalized transaction objects
 */
export function normalizeTransactions(paypalTxns, opts = {}) {
  const rawList = Array.isArray(paypalTxns)
    ? paypalTxns
    : (paypalTxns?.transaction_details || []);

  return rawList.map((item, index) => {
    const info = item.transaction_info || item || {};
    const payer = item.payer_info || {};
    const payerName = payer.payer_name || {};

    const fullName = payerName.alternate_full_name ||
      [payerName.given_name, payerName.surname].filter(Boolean).join(' ') ||
      payer.email_address ||
      '';

    const gross = toCents(info.transaction_amount?.value ?? info.gross ?? 0);
    const fee = toCents(info.fee_amount?.value ?? info.fee ?? 0);
    const net = gross - fee;

    const eventCode = info.transaction_event_code || '';
    const kind = classifyEventCode(eventCode, gross);
    const invoiceRef = extractInvoiceReference(info);
    const note = info.transaction_note || info.transaction_subject || info.note || '';

    return {
      id: info.transaction_id || item.id || `txn_${index + 1}`,
      date: (info.transaction_initiation_date || info.transaction_updated_date || info.date || '').slice(0, 10),
      payer_name: fullName,
      payer_email: (payer.email_address || payer.payer_email || '').trim().toLowerCase(),
      gross,
      fee,
      net,
      currency: info.transaction_amount?.currency_code || info.currency || 'USD',
      event_code: eventCode,
      kind,
      invoice_ref: invoiceRef,
      note,
      match_status: 'unmatched',
    };
  });
}
