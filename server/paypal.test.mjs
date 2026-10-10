import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PayPalClient, splitDateRangeIntoWindows } from './paypal.mjs';

describe('PayPalClient Unit Tests', () => {
  test('Paid invoice summaries load payment records needed to prevent transaction double-counting', async () => {
    const record = { payment_id: 'PAY-1', payment_date: '2026-10-11', amount: { value: '25.00', currency_code: 'USD' } };
    const calls = [];
    const client = new PayPalClient({ clientId: 'stub', clientSecret: 'stub', fetchFn: async (url) => {
      calls.push(url);
      if (url.includes('oauth2')) return { ok: true, json: async () => ({ access_token: 'stub', expires_in: 3600 }) };
      if (url.endsWith('/INV-PAID')) return { ok: true, json: async () => ({ id: 'INV-PAID', payments: { paid_amount: { value: '25.00' }, transactions: [record] } }) };
      return { ok: true, json: async () => ({ items: [{ id: 'INV-PAID', payments: { paid_amount: { value: '25.00' } } }, { id: 'INV-OPEN' }], total_pages: 1 }) };
    } });
    const invoices = await client.listInvoices();
    assert.deepEqual(invoices.items[0].payments.transactions, [record]);
    assert.equal(calls.some(url => url.endsWith('/INV-OPEN')), false);
  });

  test('Token caching: reuses cached token within validity period without re-authenticating', async () => {
    let oauthCallCount = 0;

    const mockFetch = async (url) => {
      if (url.includes('/v1/oauth2/token')) {
        oauthCallCount++;
        return {
          ok: true,
          status: 200,
          json: async () => ({
            access_token: 'mock-token-xyz-123',
            expires_in: 3600,
          }),
        };
      }
      return { ok: true, status: 200, json: async () => ({}) };
    };

    const client = new PayPalClient({
      clientId: 'client-id-test',
      clientSecret: 'client-secret-test',
      fetchFn: mockFetch,
    });

    const token1 = await client.getAccessToken();
    const token2 = await client.getAccessToken();

    assert.equal(token1, 'mock-token-xyz-123');
    assert.equal(token2, 'mock-token-xyz-123');
    assert.equal(oauthCallCount, 1, 'OAuth endpoint should only be called once due to caching');
  });

  test('Pagination: listInvoices traverses all pages when total_pages > 1', async () => {
    const fetchedPages = [];

    const mockFetch = async (url) => {
      if (url.includes('/v1/oauth2/token')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'token-abc', expires_in: 3600 }) };
      }
      if (url.includes('/v2/invoicing/invoices')) {
        const u = new URL(url);
        const page = u.searchParams.get('page');
        fetchedPages.push(page);

        if (page === '1') {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              total_items: 3,
              total_pages: 2,
              items: [{ id: 'INV-1' }, { id: 'INV-2' }],
            }),
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            total_items: 3,
            total_pages: 2,
            items: [{ id: 'INV-3' }],
          }),
        };
      }
      return { ok: false, status: 404 };
    };

    const client = new PayPalClient({
      clientId: 'id',
      clientSecret: 'sec',
      fetchFn: mockFetch,
    });

    const res = await client.listInvoices({ pageSize: 2 });
    assert.deepEqual(fetchedPages, ['1', '2'], 'Should have requested both pages');
    assert.equal(res.items.length, 3);
    assert.equal(res.items[2].id, 'INV-3');
  });

  test('31-day chunking: splitDateRangeIntoWindows divides 65 days into <= 31 day segments', () => {
    const start = new Date('2026-08-01T00:00:00Z');
    const end = new Date('2026-10-05T00:00:00Z');
    const windows = splitDateRangeIntoWindows(start, end, 31);

    assert.ok(windows.length >= 3, 'A 65-day range should produce at least 3 windows');
    for (const win of windows) {
      const diffDays = (win.end.getTime() - win.start.getTime()) / (1000 * 60 * 60 * 24);
      assert.ok(diffDays <= 31, `Window span (${diffDays} days) must not exceed 31 days`);
    }
  });

  test('31-day chunking: listTransactions queries all chunked windows and aggregates transactions', async () => {
    const queriedWindows = [];

    const mockFetch = async (url) => {
      if (url.includes('/v1/oauth2/token')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'token', expires_in: 3600 }) };
      }
      if (url.includes('/v1/reporting/transactions')) {
        const u = new URL(url);
        queriedWindows.push({
          start: u.searchParams.get('start_date'),
          end: u.searchParams.get('end_date'),
        });
        return {
          ok: true,
          status: 200,
          json: async () => ({
            total_pages: 1,
            transaction_details: [{ transaction_info: { transaction_id: `TXN-${queriedWindows.length}` } }],
          }),
        };
      }
      return { ok: false, status: 404 };
    };

    const client = new PayPalClient({
      clientId: 'id',
      clientSecret: 'sec',
      fetchFn: mockFetch,
    });

    // 70 day range
    const startDate = '2026-07-01T00:00:00Z';
    const endDate = '2026-09-09T00:00:00Z';
    const result = await client.listTransactions(startDate, endDate);

    assert.ok(queriedWindows.length >= 3, 'Should chunk 70 days into at least 3 separate API queries');
    assert.equal(result.transaction_details.length, queriedWindows.length);
  });

  test('recordPayment: sends POST to /v2/invoicing/invoices/{id}/payments with formatted payload', async () => {
    let capturedBody = null;
    let capturedUrl = null;

    const mockFetch = async (url, options) => {
      if (url.includes('/v1/oauth2/token')) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'token', expires_in: 3600 }) };
      }
      capturedUrl = url;
      capturedBody = JSON.parse(options.body);
      return { ok: true, status: 200, json: async () => ({ payment_id: 'PAY-123' }) };
    };

    const client = new PayPalClient({
      clientId: 'id',
      clientSecret: 'sec',
      fetchFn: mockFetch,
    });

    const res = await client.recordPayment('INV-TEST-001', {
      amount: 150.50,
      currency: 'USD',
      method: 'PAYPAL',
      note: 'Verified payment',
    });

    assert.ok(capturedUrl.includes('/v2/invoicing/invoices/INV-TEST-001/payments'));
    assert.equal(capturedBody.amount.value, '150.50');
    assert.equal(capturedBody.amount.currency_code, 'USD');
    assert.equal(capturedBody.method, 'PAYPAL');
    assert.equal(res.payment_id, 'PAY-123');
  });
});
