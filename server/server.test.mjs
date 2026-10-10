import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './index.mjs';
import { PayPalClient } from './paypal.mjs';

describe('Server & Endpoints Integration Tests', () => {
  let server;
  let serverPort;
  let baseUrl;
  let mockPaypalClient;
  let lastRecordedPayment = null;
  let lastSentReminder = null;

  before(async () => {
    // Mock PayPal Client for testing server endpoints
    mockPaypalClient = new PayPalClient({
      clientId: 'mock-client-id',
      clientSecret: 'mock-client-secret-123456789',
    });

    mockPaypalClient.hasCredentials = () => true;
    mockPaypalClient.listInvoices = async () => ({
      total_items: 2,
      total_pages: 1,
      items: [{ id: 'INV-1', status: 'SENT' }, { id: 'INV-2', status: 'PAID' }],
    });
    mockPaypalClient.listTransactions = async () => ({
      total_items: 2,
      total_pages: 1,
      transaction_details: [{ transaction_info: { transaction_id: 'TXN-1' } }],
    });
    mockPaypalClient.recordPayment = async (id, data) => {
      lastRecordedPayment = { id, data };
      return { success: true, payment_id: 'PAY-MOCK-999' };
    };
    mockPaypalClient.sendReminder = async (id, data) => {
      lastSentReminder = { id, data };
      return { success: true };
    };

    server = createServer({ paypalClient: mockPaypalClient, llmClient: { hasApiKey: () => false, getProvider: () => 'nebius', resolveModel: async () => 'nvidia/test-nemotron' } });
    await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        serverPort = server.address().port;
        baseUrl = `http://127.0.0.1:${serverPort}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  test('GET /api/health: returns booleans only and leaks zero secrets', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(typeof body.mode, 'string');
    assert.equal(typeof body.hasPaypal, 'boolean');
    assert.equal(typeof body.hasLlm, 'boolean');
    assert.equal(typeof body.llmProvider, 'string');
    assert.equal(body.llmModel, 'nvidia/test-nemotron');
    assert.equal(typeof body.hasLlmKey, 'boolean');

    const rawText = JSON.stringify(body);
    assert.equal(rawText.includes('mock-client-secret'), false, 'Must not leak client secrets');
    assert.equal(rawText.includes('mock-client-id'), false, 'Must not leak client id');
  });

  test('GET /api/invoices: returns raw PayPal REST shape', async () => {
    const res = await fetch(`${baseUrl}/api/invoices`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.total_items, 2);
    assert.ok(Array.isArray(body.items));
    assert.equal(body.items[0].id, 'INV-1');
  });

  test('GET /api/transactions: returns raw PayPal REST shape', async () => {
    const res = await fetch(`${baseUrl}/api/transactions`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.total_items, 2);
    assert.ok(Array.isArray(body.transaction_details));
    assert.equal(body.transaction_details[0].transaction_info.transaction_id, 'TXN-1');
  });

  test('POST /api/invoices/:id/record-payment: rejects when confirmedByUser is missing with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/invoices/INV-1/record-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 100 }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('confirmedByUser'));
  });

  test('Transaction Search 403 preserves invoice access and gives an explicit demo fallback reason', async () => {
    const localServer = createServer({ paypalClient: { ...mockPaypalClient,
      hasCredentials: () => true,
      listInvoices: mockPaypalClient.listInvoices,
      listTransactions: async () => { const err = new Error('Reporting scope missing'); err.status = 403; throw err; },
    }, llmClient: { hasApiKey: () => false } });
    await new Promise((resolve) => localServer.listen(0, '127.0.0.1', resolve));
    try {
      const url = `http://127.0.0.1:${localServer.address().port}`;
      const res = await fetch(`${url}/api/transactions`);
      assert.equal(res.status, 403);
      assert.deepEqual(await res.json(), { error: 'Live invoices + demo transactions (enable Transaction Search on your sandbox app)', code: 'TRANSACTION_SEARCH_DISABLED' });
      assert.equal((await fetch(`${url}/api/invoices`)).status, 200);
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('POST /api/invoices/:id/record-payment: succeeds when confirmedByUser is true', async () => {
    lastRecordedPayment = null;
    const res = await fetch(`${baseUrl}/api/invoices/INV-1/record-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 500, confirmedByUser: true, note: 'Approved match' }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.payment_id, 'PAY-MOCK-999');
    assert.ok(lastRecordedPayment);
    assert.equal(lastRecordedPayment.id, 'INV-1');
    assert.equal(lastRecordedPayment.data.amount, 500);
  });

  test('POST /api/invoices/:id/remind: rejects when confirmedByUser is false with HTTP 400', async () => {
    const res = await fetch(`${baseUrl}/api/invoices/INV-2/remind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Pay up', confirmedByUser: false }),
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.ok(body.error.includes('confirmedByUser'));
  });

  test('POST /api/invoices/:id/remind: succeeds when confirmedByUser is true', async () => {
    lastSentReminder = null;
    const res = await fetch(`${baseUrl}/api/invoices/INV-2/remind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: 'Friendly Reminder', note: 'Invoice overdue', confirmedByUser: true }),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(lastSentReminder);
    assert.equal(lastSentReminder.id, 'INV-2');
  });

  test('Unconfigured PayPal credentials: returns hasPaypal: false on health check and 503 on resources', async () => {
    const unconfiguredClient = new PayPalClient({ clientId: '', clientSecret: '' });
    const localServer = createServer({ paypalClient: unconfiguredClient, llmClient: { hasApiKey: () => false } });

    await new Promise((resolve) => localServer.listen(0, '127.0.0.1', resolve));
    const port = localServer.address().port;

    try {
      const healthRes = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(healthRes.status, 200);
      const healthBody = await healthRes.json();
      assert.equal(healthBody.hasPaypal, false);
      assert.equal(healthBody.mode, 'demo');

      const invRes = await fetch(`http://127.0.0.1:${port}/api/invoices`);
      assert.equal(invRes.status, 503);
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('POST /api/llm: returns 503 when GEMINI_API_KEY is not configured', async () => {
    const unconfiguredLlmClient = {
      hasApiKey: () => false,
      chatCompletion: async () => {},
    };
    const localServer = createServer({ llmClient: unconfiguredLlmClient });
    await new Promise((resolve) => localServer.listen(0, '127.0.0.1', resolve));
    const port = localServer.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/llm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'hello' }] }),
      });
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.ok(body.error.includes('GEMINI_API_KEY'));
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });

  test('POST /api/llm: succeeds and returns completion when configured', async () => {
    let capturedPayload = null;
    const mockLlmClient = {
      hasApiKey: () => true,
      chatCompletion: async (payload) => {
        capturedPayload = payload;
        return {
          id: 'chatcmpl-mock-123',
          choices: [{ message: { role: 'assistant', content: 'Reconciliation looks healthy.' } }],
        };
      },
    };
    const localServer = createServer({ llmClient: mockLlmClient });
    await new Promise((resolve) => localServer.listen(0, '127.0.0.1', resolve));
    const port = localServer.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/llm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Audit status' }] }),
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.id, 'chatcmpl-mock-123');
      assert.equal(body.choices[0].message.content, 'Reconciliation looks healthy.');
      assert.ok(capturedPayload);
      assert.equal(capturedPayload.messages[0].content, 'Audit status');
    } finally {
      await new Promise((resolve) => localServer.close(resolve));
    }
  });
});
