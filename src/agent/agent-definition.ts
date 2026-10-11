/**
 * SettleSight — Studio Agent Framework Integration
 *
 * Configures the Reconciliation Auditor agent and harness using
 * AG Studio's real exported AI APIs: createAiHarness, directLlmRunner.
 */

import { createAiHarness, directLlmRunner } from 'ag-studio';
import type { AgStudioApi, AgAiHarness, AgAiAgentDefinition } from 'ag-studio';
import { GeminiLlmAdapter } from './llm-adapter';

export const RECONCILIATION_AGENT_ID = 'reconciliation-auditor';

export function createReconciliationAgentDefinition(
  getState: () => any
): AgAiAgentDefinition {
  return {
    id: RECONCILIATION_AGENT_ID,
    name: 'Reconciliation Auditor',
    description:
      'Autonomous auditor for PayPal merchant transactions, fee discrepancies, and invoice allocations.',
    instructions: () => {
      const state = getState();
      const invCount = state?.invoices?.length || 0;
      const txnCount = state?.transactions?.length || 0;
      const matCount = state?.matches?.length || 0;

      return (
        `You are the SettleSight Reconciliation Auditor. You assist PayPal merchants ` +
        `in closing their books by matching invoices to transactions, auditing fee discrepancies, ` +
        `and resolving exceptions.\n\n` +
        `Current ledger state:\n` +
        `- Invoices: ${invCount}\n` +
        `- Transactions: ${txnCount}\n` +
        `- Proposed matches: ${matCount}\n\n` +
        `Guidelines:\n` +
        `1. Always explain why candidate matches were proposed (exact, fee_adjusted, partial, email).\n` +
        `2. When reviewing fee adjustments, verify that the transaction amount falls within fee tolerance of the open invoice balance.\n` +
        `3. Reminders for overdue invoices must only be drafted, never sent automatically.\n` +
        `4. Approving a match requires explicit seller validation.`
      );
    },
    tools: () => [
      {
        name: 'list_exceptions',
        description: 'Lists all suggested candidate matches and ambiguous exceptions requiring review.',
        kind: 'client',
        schema: () => ({
          name: 'list_exceptions',
          description: 'Lists all suggested candidate matches and ambiguous exceptions.',
          parameters: {
            type: 'object',
            properties: {
              minConfidence: { type: 'number', description: 'Minimum confidence threshold (0.0 to 1.0)' },
              overdueDays: { type: 'number', description: 'Filter by days overdue' },
            },
          },
        }),
      },
      {
        name: 'explain_match',
        description: 'Provides detailed audit explanation and fee breakdown for a candidate match.',
        kind: 'client',
        schema: () => ({
          name: 'explain_match',
          description: 'Explains allocation rules and discrepancy for a specific match ID.',
          parameters: {
            type: 'object',
            properties: {
              matchId: { type: 'string', description: 'The match ID (e.g. mat_1)' },
            },
            required: ['matchId'],
          },
        }),
      },
      {
        name: 'draft_reminder',
        description: 'Drafts a polite payment reminder email for an overdue invoice. Returns draft text only.',
        kind: 'client',
        schema: () => ({
          name: 'draft_reminder',
          description: 'Drafts reminder email text for an invoice.',
          parameters: {
            type: 'object',
            properties: {
              invoiceQuery: { type: 'string', description: 'Invoice ID, invoice number, or customer name' },
            },
            required: ['invoiceQuery'],
          },
        }),
      },
    ],
  };
}

/**
 * Builds the AG Studio AI Harness using createAiHarness and directLlmRunner.
 */
export function buildReconciliationHarness(
  api: AgStudioApi,
  getState: () => any,
  adapter?: GeminiLlmAdapter
): AgAiHarness {
  const activeAdapter = adapter || new GeminiLlmAdapter();
  const definition = createReconciliationAgentDefinition(getState);
  const runner = directLlmRunner({
    ...definition,
    adapter: activeAdapter,
  });

  return createAiHarness(api, () => ({
    agents: [runner],
    primary: RECONCILIATION_AGENT_ID,
    promptStarters: [
      {
        label: 'Unpaid >30 days',
        prompt: 'Show unpaid invoices over 30 days',
      },
      {
        label: 'Audit fees & partials',
        prompt: 'Audit partial payments & fee discrepancies',
      },
      {
        label: 'Draft Horizon reminder',
        prompt: 'Draft reminder for overdue Horizon invoice',
      },
    ],
  }));
}
