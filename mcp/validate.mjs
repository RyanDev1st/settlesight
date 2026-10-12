import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = new URL(process.argv[2] || 'http://127.0.0.1:8790/mcp');
const client = new Client({ name: 'settlesight-validation', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(url, {
  fetch: async (endpoint, options) => {
    const response = await fetch(endpoint, options);
    const request = JSON.parse(options.body || '{}');
    if (request.method === 'initialize') console.log('initialize:', JSON.stringify(await response.clone().json(), null, 2));
    return response;
  },
});
try {
  await client.connect(transport);
  console.log('tools/list:', JSON.stringify(await client.listTools(), null, 2));
  for (const [name, args] of [
    ['reconciliation_summary', {}],
    ['list_exceptions', { filter: { minConfidence: 0.9 } }],
    ['explain_match', { id: 'INV-2026-016' }],
    ['draft_payment_reminder', { invoice_id: 'INV-2026-016' }],
    ['approve_match', { id: 'mat_16' }],
    ['reconciliation_summary', {}],
    ['approve_match', { id: 'mat_16', confirm: true }],
    ['reconciliation_summary', {}],
  ]) {
    console.log(`tools/call ${name} ${JSON.stringify(args)}:`, JSON.stringify(await client.callTool({ name, arguments: args }), null, 2));
  }
} finally { await client.close(); }
