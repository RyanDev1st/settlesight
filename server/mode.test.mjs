import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from './index.mjs';
import { modeBadge, usesPaypalData } from '../src/ui/mode.js';

test('explicit demo source retains live inference and bypasses PayPal loading', async () => {
  const previous = process.env.DATA_SOURCE;
  process.env.DATA_SOURCE = 'demo';
  const server = createServer({
    paypalClient: { hasCredentials: () => true },
    llmClient: { hasApiKey: () => true, getProvider: () => 'nebius', resolveModel: async () => 'nvidia/nemotron-3-super-120b-a12b' },
  });
  if (previous === undefined) delete process.env.DATA_SOURCE;
  else process.env.DATA_SOURCE = previous;
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const health = await (await fetch(`http://127.0.0.1:${server.address().port}/api/health`)).json();
    assert.equal(health.mode, 'demo');
    assert.equal(health.dataSource, 'demo');
    assert.equal(health.hasLlm, true);
    assert.equal(usesPaypalData(health), false);
    assert.equal(modeBadge(health), 'Demo data · Nemotron Live');
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('badges distinguish offline demo, sandbox and restricted reporting', () => {
  assert.equal(modeBadge({ mode: 'demo', hasLlm: false, llmProvider: 'nebius' }), 'Demo Mode');
  assert.equal(modeBadge({ mode: 'live', hasLlm: true, llmProvider: 'nebius' }), 'Live Sandbox');
  assert.equal(modeBadge({ mode: 'live', dataNotice: 'restricted' }), 'Live invoices + demo transactions');
  assert.equal(usesPaypalData({ hasPaypal: true }), true);
});
