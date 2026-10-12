import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemo, callTool } from './tools.mjs';

test('MCP tools wrap the deterministic demo engine', () => {
  const demo = createDemo();
  const summary = callTool(demo, 'reconciliation_summary');
  assert.equal(summary.total_invoiced, 3699500);
  assert.equal(summary.matched_value, 1728500);
  assert.equal(summary.matched_percent, 46.72);
  assert.equal(summary.suggested_count, 20);
  assert.equal(summary.formatted_usd.total_invoiced, '$36,995.00');
  assert.equal(summary.formatted_usd.aging_buckets['90+'], '$5,500.00');
  assert.equal(callTool(demo, 'list_exceptions', {}).count, 23);
  assert.equal(callTool(demo, 'explain_match', { id: 'INV-2026-016' }).matchId, 'mat_16');
  assert.equal(callTool(demo, 'explain_match', { id: 'INV-2026-016' }).remainingAfterApprovalDollars, 29.3);
  assert.equal(callTool(demo, 'draft_payment_reminder', { invoice_id: 'INV-2026-016' }).status, 'draft_only');
  assert.throws(() => callTool(demo, 'draft_payment_reminder', { invoice_id: 'missing' }), /not found/);
});

test('approval requires literal confirm=true, is demo-only and is idempotent', () => {
  const demo = createDemo();
  const before = JSON.stringify(demo.state);
  for (const confirm of [undefined, false, 'true']) {
    assert.equal(callTool(demo, 'approve_match', { id: 'mat_16', confirm }).confirmation_required, true);
    assert.equal(JSON.stringify(demo.state), before);
  }
  const approved = callTool(demo, 'approve_match', { id: 'mat_16', confirm: true });
  assert.equal(approved.success, true);
  assert.equal(approved.summary.suggested_count, 19);
  assert.ok(approved.summary.matched_percent > 46.72);
  assert.equal(callTool(demo, 'list_exceptions').items.some(item => item.id === 'mat_16'), false);
  const after = JSON.stringify(demo.state);
  callTool(demo, 'approve_match', { id: 'mat_16', confirm: true });
  assert.equal(JSON.stringify(demo.state), after);
});
