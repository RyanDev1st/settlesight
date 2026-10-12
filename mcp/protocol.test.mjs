import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startServer } from './server.mjs';

test('SDK client negotiates 2025-11-25 and calls every tool over stateless HTTP', async () => {
  const server = await startServer(0);
  const client = new Client({ name: 'settlesight-protocol-test', version: '1.0.0' });
  let protocolVersion;
  const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.address().port}/mcp`), {
    fetch: async (url, options) => {
      const response = await fetch(url, options);
      if (JSON.parse(options.body || '{}').method === 'initialize') {
        const body = await response.clone().json();
        protocolVersion = body.result.protocolVersion;
        assert.equal(response.headers.get('mcp-session-id'), null);
      }
      return response;
    },
  });
  try {
    await client.connect(transport);
    assert.equal(protocolVersion, '2025-11-25');
    const { tools } = await client.listTools();
    assert.equal(tools.length, 5);
    assert.ok(tools.find(t => t.name === 'approve_match').inputSchema.properties.confirm);
    const call = async (name, args = {}) => {
      const result = await client.callTool({ name, arguments: args });
      assert.ok(!result.isError, JSON.stringify(result));
      return JSON.parse(result.content[0].text);
    };
    const before = await call('reconciliation_summary');
    assert.equal(before.matched_percent, 46.72);
    assert.equal((await call('list_exceptions')).count, 23);
    assert.equal((await call('explain_match', { id: 'INV-2026-016' })).method, 'fee_adjusted');
    assert.equal((await call('draft_payment_reminder', { invoice_id: 'INV-2026-016' })).status, 'draft_only');
    assert.equal((await call('approve_match', { id: 'mat_16' })).confirmation_required, true);
    assert.deepEqual(await call('reconciliation_summary'), before);
    const invalid = await client.callTool({ name: 'approve_match', arguments: { id: 'mat_16', confirm: 'true' } });
    assert.equal(invalid.isError, true);
    assert.deepEqual(await call('reconciliation_summary'), before);
    const approved = await call('approve_match', { id: 'mat_16', confirm: true });
    assert.equal(approved.success, true);
    assert.equal(approved.summary.suggested_count, 19);
  } finally {
    await client.close();
    await new Promise(resolve => server.close(resolve));
  }
});
