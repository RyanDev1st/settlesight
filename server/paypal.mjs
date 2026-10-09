/**
 * SettleSight - PayPal Sandbox Client
 *
 * Official API Documentation Citations:
 * - OAuth 2.0 Client Credentials:
 *   https://developer.paypal.com/api/rest/authentication/
 * - Invoicing v2 (Create draft, send, list, record-payment, remind):
 *   https://developer.paypal.com/docs/api/invoicing/v2/
 * - Transaction Search v1:
 *   https://developer.paypal.com/docs/api/transaction-search/v1/
 *   NOTE: Transaction Search must be enabled on the sandbox REST app.
 *   Transaction search data enforces a maximum 31-day query range, and
 *   new sandbox activity can take up to 3 hours to appear in reporting feeds.
 * - Orders v2 / Capture:
 *   https://developer.paypal.com/docs/api/orders/v2/
 */

const DEFAULT_SANDBOX_URL = 'https://api-m.sandbox.paypal.com';
const MAX_TRANSACTION_WINDOW_DAYS = 31;

export class PayPalClient {
  constructor(options = {}) {
    this.clientId = options.clientId || process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = options.clientSecret || process.env.PAYPAL_CLIENT_SECRET || '';
    this.baseUrl = (options.baseUrl || process.env.PAYPAL_BASE_URL || DEFAULT_SANDBOX_URL).replace(/\/+$/, '');
    this.fetchFn = options.fetchFn || globalThis.fetch;

    // In-memory token cache
    this.cachedToken = null;
    this.tokenExpiresAt = 0;
  }

  hasCredentials() {
    return Boolean(this.clientId && this.clientSecret);
  }

  /**
   * Retrieves an OAuth 2.0 Bearer access token with in-memory caching.
   * Cites: https://developer.paypal.com/api/rest/authentication/
   */
  async getAccessToken() {
    if (!this.hasCredentials()) {
      throw new Error('PayPal client credentials not configured (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET missing)');
    }

    // Reuse cached token if it has more than 60 seconds of validity remaining
    const now = Date.now();
    if (this.cachedToken && this.tokenExpiresAt > now + 60000) {
      return this.cachedToken;
    }

    const authHeader = 'Basic ' + Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const tokenUrl = `${this.baseUrl}/v1/oauth2/token`;

    const response = await this.fetchFn(tokenUrl, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PayPal OAuth authentication failed (HTTP ${response.status}): ${errText}`);
    }

    const data = await response.json();
    this.cachedToken = data.access_token;
    const expiresInMs = (Number(data.expires_in) || 3600) * 1000;
    this.tokenExpiresAt = now + expiresInMs;

    return this.cachedToken;
  }

  /**
   * Authenticated request helper
   */
  async request(path, options = {}) {
    const token = await this.getAccessToken();
    const url = `${this.baseUrl}${path.startsWith('/') ? path : '/' + path}`;

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    return this.fetchFn(url, { ...options, headers });
  }

  /**
   * Lists all invoices across all pages.
   * Cites: https://developer.paypal.com/docs/api/invoicing/v2/#invoices_list
   */
  async listInvoices(options = {}) {
    const pageSize = options.pageSize || 20;
    let page = 1;
    let totalPages = 1;
    const allItems = [];
    let totalItems = 0;

    while (page <= totalPages) {
      const query = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        total_required: 'true',
      });

      const res = await this.request(`/v2/invoicing/invoices?${query.toString()}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to list PayPal invoices (HTTP ${res.status}): ${text}`);
      }

      const body = await res.json();
      totalItems = body.total_items ?? totalItems;
      totalPages = body.total_pages || 1;

      if (Array.isArray(body.items)) {
        allItems.push(...body.items);
      }

      page++;
    }

    return {
      total_items: totalItems || allItems.length,
      total_pages: totalPages,
      items: allItems,
    };
  }

  /**
   * Lists transactions by chunking the date range into <= 31-day intervals.
   * Cites: https://developer.paypal.com/docs/api/transaction-search/v1/
   */
  async listTransactions(startDateInput, endDateInput) {
    const now = new Date();
    const endDate = endDateInput ? new Date(endDateInput) : now;
    // Default to 90 days ago if no start date provided
    const startDate = startDateInput ? new Date(startDateInput) : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    const windows = splitDateRangeIntoWindows(startDate, endDate, MAX_TRANSACTION_WINDOW_DAYS);
    const allTransactions = [];

    for (const win of windows) {
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const query = new URLSearchParams({
          start_date: win.start.toISOString(),
          end_date: win.end.toISOString(),
          fields: 'all',
          page_size: '100',
          page: String(page),
        });

        const res = await this.request(`/v1/reporting/transactions?${query.toString()}`);
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to search transactions for window ${win.start.toISOString()} - ${win.end.toISOString()} (HTTP ${res.status}): ${text}`);
        }

        const body = await res.json();
        totalPages = body.total_pages || 1;

        if (Array.isArray(body.transaction_details)) {
          allTransactions.push(...body.transaction_details);
        }

        page++;
      }
    }

    return {
      total_items: allTransactions.length,
      total_pages: 1,
      transaction_details: allTransactions,
    };
  }

  /**
   * Records an external or offline payment on a sent invoice.
   * Cites: https://developer.paypal.com/docs/api/invoicing/v2/#invoices_payments
   */
  async recordPayment(invoiceId, paymentData = {}) {
    if (!invoiceId) throw new Error('invoiceId is required to record payment');

    const amountObj = typeof paymentData.amount === 'object' && paymentData.amount !== null
      ? paymentData.amount
      : { currency_code: paymentData.currency || 'USD', value: Number(paymentData.amount || 0).toFixed(2) };

    const payload = {
      method: paymentData.method || 'PAYPAL',
      payment_date: paymentData.date || new Date().toISOString().slice(0, 10),
      amount: amountObj,
      note: paymentData.note || 'Payment recorded via SettleSight reconciliation desk',
    };

    const res = await this.request(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/payments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to record payment for invoice ${invoiceId} (HTTP ${res.status}): ${text}`);
    }

    return res.status === 204 ? { success: true } : res.json();
  }

  /**
   * Sends a reminder for an unpaid or overdue invoice.
   * Cites: https://developer.paypal.com/docs/api/invoicing/v2/#invoices_remind
   */
  async sendReminder(invoiceId, reminderData = {}) {
    if (!invoiceId) throw new Error('invoiceId is required to send reminder');

    const payload = {
      subject: reminderData.subject || 'Reminder: Invoice pending payment',
      note: reminderData.note || 'This is a friendly reminder regarding your outstanding invoice.',
      send_to_recipient: true,
    };

    const res = await this.request(`/v2/invoicing/invoices/${encodeURIComponent(invoiceId)}/remind`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to send reminder for invoice ${invoiceId} (HTTP ${res.status}): ${text}`);
    }

    return { success: true, status: res.status };
  }
}

/**
 * Splits a start and end date into slices of at most maxDays duration.
 * Required because PayPal Transaction Search rejects ranges > 31 days.
 */
export function splitDateRangeIntoWindows(startDate, endDate, maxDays = 31) {
  const windows = [];
  let currentStart = new Date(startDate);
  const finalEnd = new Date(endDate);

  if (currentStart > finalEnd) {
    return [{ start: finalEnd, end: finalEnd }];
  }

  while (currentStart < finalEnd) {
    const nextEnd = new Date(currentStart.getTime() + maxDays * 24 * 60 * 60 * 1000);
    const windowEnd = nextEnd < finalEnd ? nextEnd : finalEnd;
    windows.push({ start: new Date(currentStart), end: new Date(windowEnd) });

    // Step slightly past the window end to avoid overlap
    currentStart = new Date(windowEnd.getTime() + 1000);
  }

  return windows.length > 0 ? windows : [{ start: startDate, end: endDate }];
}

export const defaultPayPalClient = new PayPalClient();
