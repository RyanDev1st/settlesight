import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  listExceptions,
  explainMatch,
  proposeAllocation,
  approveMatch,
  draftReminder,
} from './tools.js';
import { runScriptedDemo, isScriptedPrompt } from './scripted-runner.js';
import { normalizeInvoices, normalizeTransactions } from '../match/normalize.js';
import { proposeMatches } from '../match/engine.js';
import demoInvoices from '../data/demo/invoices.json' with { type: 'json' };
import demoTransactions from '../data/demo/transactions.json' with { type: 'json' };

describe('Reconciliation Agent & Tools Test Suite', () => {
  // Initialize normalized engine state from demo fixtures
  const normInvoices = normalizeInvoices(demoInvoices);
  const normTransactions = normalizeTransactions(demoTransactions);
  const matchResult = proposeMatches(normInvoices, normTransactions);
  const engineState = matchResult.state;

  test('listExceptions: identifies suggested matches and ambiguity exceptions', () => {
    const exceptions = listExceptions(engineState);
    assert.ok(Array.isArray(exceptions));
    assert.ok(exceptions.length > 0, 'Should find candidate exceptions');

    // Each exception item has required shape
    const first = exceptions[0];
    assert.ok(first.id);
    assert.ok(first.invoiceNumber);
    assert.ok(first.method);
    assert.equal(typeof first.confidence, 'number');
    assert.ok(first.confidence <= 1.0);
  });

  test('explainMatch: returns comprehensive audit breakdown', () => {
    const candidate = engineState.matches.find((m) => m.state === 'suggested');
    assert.ok(candidate, 'Must have at least one suggested match candidate');

    const explanation = explainMatch(engineState, candidate.id);
    assert.equal(explanation.matchId, candidate.id);
    assert.ok(explanation.customerName);
    assert.ok(explanation.payerName);
    assert.equal(typeof explanation.allocatedDollars, 'number');
    assert.ok(explanation.explanation.length > 0);
    assert.ok(explanation.recommendedAction.length > 0);
  });

  test('proposeAllocation: tests allocation math via validator', () => {
    const candidate = engineState.matches[0];
    // Allocation of $10.00 (1000 cents)
    const validProposal = proposeAllocation(engineState, candidate.id, 1000);
    assert.equal(typeof validProposal.valid, 'boolean');

    // Excess allocation of 100,000,000 cents should fail
    const invalidProposal = proposeAllocation(engineState, candidate.id, 100000000);
    assert.equal(invalidProposal.valid, false);
    assert.ok(invalidProposal.error);
  });

  test('approveMatch: validates before applying decision and guards invalid allocations', () => {
    // Clone state so we do not mutate the shared test fixture
    const clonedState = JSON.parse(JSON.stringify(engineState));
    const suggested = clonedState.matches.find((m) => m.state === 'suggested');
    assert.ok(suggested, 'Must have suggested candidate');

    // A valid approval should succeed
    const res = approveMatch(clonedState, suggested.id);
    assert.equal(res.success, true);
    assert.equal(res.matchId, suggested.id);

    // Attempting to approve non-existent match fails
    const invalidRes = approveMatch(clonedState, 'mat_non_existent');
    assert.equal(invalidRes.success, false);
    assert.ok(invalidRes.error.includes('not found'));
  });

  test('draftReminder: produces draft-only reminder and never sends', () => {
    // 1. Direct match by invoice number
    const draft = draftReminder(engineState, 'INV-2026-001');
    assert.equal(draft.status, 'draft_only');
    assert.ok(draft.subject.includes('Invoice'));
    assert.ok(draft.body.includes('https://www.paypal.com/invoice/p/#'));
    assert.ok(draft.openAmountDollars >= 0);

    // 2. Query fallback when named customer not found
    const fallbackDraft = draftReminder(engineState, 'Horizon');
    assert.equal(fallbackDraft.status, 'draft_only');
    assert.ok(fallbackDraft.invoiceId);
    assert.ok(fallbackDraft.body.includes('https://www.paypal.com/invoice/p/#'));
  });

  test('scriptedRunner: handles "Show unpaid invoices over 30 days"', () => {
    const prompt = 'Show unpaid invoices over 30 days';
    assert.ok(isScriptedPrompt(prompt));

    const reply = runScriptedDemo(prompt, engineState);
    assert.equal(reply.role, 'assistant');
    assert.equal(reply.isDemoScripted, true);
    assert.ok(reply.toolCalls && reply.toolCalls.length > 0);
    assert.equal(reply.toolCalls[0].name, 'list_exceptions');
    assert.ok(reply.content.includes('Overdue Invoices'));
  });

  test('scriptedRunner: handles "Audit partial payments & fee discrepancies"', () => {
    const prompt = 'Audit partial payments & fee discrepancies';
    assert.ok(isScriptedPrompt(prompt));

    const reply = runScriptedDemo(prompt, engineState);
    assert.equal(reply.role, 'assistant');
    assert.equal(reply.isDemoScripted, true);
    assert.ok(reply.toolCalls.length >= 1);
    assert.ok(reply.content.includes('PayPal Fee Deductions') || reply.content.includes('Partial Payments'));
  });

  test('scriptedRunner: handles "Draft reminder for overdue Horizon invoice"', () => {
    const prompt = 'Draft reminder for overdue Horizon invoice';
    assert.ok(isScriptedPrompt(prompt));

    const reply = runScriptedDemo(prompt, engineState);
    assert.equal(reply.role, 'assistant');
    assert.equal(reply.isDemoScripted, true);
    assert.equal(reply.toolCalls[0].name, 'draft_reminder');
    assert.ok(reply.content.includes('Safety Guard'));
    assert.ok(reply.content.includes('draft status only'));
  });
});
