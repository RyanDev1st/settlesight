/**
 * SettleSight — Nemotron Real Tool Calling Agent Runner
 *
 * Implements tool calling turn execution with NVIDIA Nemotron on Nebius Token Factory.
 * If no key is set or no LLM client is available, falls back to the deterministic
 * scripted runner (`runScriptedDemo`).
 */

import { listExceptions, explainMatch, draftReminder } from './tools.js';
import { runScriptedDemo } from './scripted-runner.js';
import { triageExceptionsWithNemotron } from './triage.js';

export const DEFAULT_NEMOTRON_MODEL = 'nvidia/nemotron-3-super-120b-a12b';

export const RECONCILIATION_TOOLS_SCHEMA = [
  {
    type: 'function',
    function: {
      name: 'list_exceptions',
      description: 'List exceptions and candidate matches in the reconciliation queue with optional filters',
      parameters: {
        type: 'object',
        properties: {
          minConfidence: { type: 'number', description: 'Minimum confidence score (0.0 to 1.0)' },
          overdueDays: { type: 'number', description: 'Filter by days overdue' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'explain_match',
      description: 'Audit and explain fee breakdown and match reasoning for a specific match ID',
      parameters: {
        type: 'object',
        properties: {
          matchId: { type: 'string', description: 'Candidate match identifier (e.g. mat_1)' },
        },
        required: ['matchId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'draft_reminder',
      description: 'Draft a polite payment reminder email for an overdue invoice. Returns draft only (never sends automatically).',
      parameters: {
        type: 'object',
        properties: {
          invoiceQuery: { type: 'string', description: 'Invoice number, ID, or customer name' },
        },
        required: ['invoiceQuery'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'triage_exceptions',
      description: 'Run deep reasoning triage across all pending reconciliation exceptions to prioritize review',
      parameters: {
        type: 'object',
        properties: {
          model: { type: 'string', description: 'Nemotron model ID' },
        },
      },
    },
  },
];

export const NEMOTRON_SYSTEM_PROMPT =
  'You are the SettleSight Reconciliation Auditor powered by NVIDIA Nemotron on Nebius Token Factory. ' +
  'You assist PayPal merchants by querying the ledger with tools, auditing fee discrepancies, ' +
  'explaining candidate matches, and drafting payment reminders. ' +
  'Safety Invariant: You cannot directly mutate the ledger; your proposals are validated by deterministic math ' +
  'and require explicit merchant confirmation.';

/**
 * Executes a turn using real Nemotron tool calling, or falls back to scripted demo.
 *
 * @param {object} options
 * @param {string} options.prompt User chat prompt
 * @param {object} options.state Current reconciliation state
 * @param {Function} [options.callLlm] Server proxy function (POST /api/llm)
 * @param {object} [options.studioApi] AG Studio API instance
 * @param {string} [options.model] Model identifier
 * @returns {Promise<object>} Chat message response conforming to ChatMessage shape
 */
export async function runNemotronAgentTurn({
  prompt,
  state,
  callLlm,
  studioApi = null,
  model = DEFAULT_NEMOTRON_MODEL,
}) {
  // Fall back to scripted demo if no live LLM client provided
  if (typeof callLlm !== 'function') {
    return runScriptedDemo(prompt, state, studioApi);
  }

  const toolSteps = [];

  try {
    const firstTurnPayload = {
      model,
      messages: [
        { role: 'system', content: NEMOTRON_SYSTEM_PROMPT },
        { role: 'user', content: prompt },
      ],
      tools: RECONCILIATION_TOOLS_SCHEMA,
      tool_choice: 'auto',
      temperature: 0.2,
    };

    const firstResponse = await callLlm(firstTurnPayload);
    const choice = firstResponse?.choices?.[0];
    const message = choice?.message || {};

    // Check if Nemotron called any tools
    if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      const toolMessages = [];

      for (const call of message.tool_calls) {
        const fnName = call.function?.name;
        let args = {};
        try {
          args = JSON.parse(call.function?.arguments || '{}');
        } catch {
          // ignore parse error
        }

        let result = null;
        let summary = '';

        if (fnName === 'list_exceptions') {
          result = listExceptions(state, args);
          summary = `Listed ${result.length} candidate exceptions via Nemotron tool call.`;
        } else if (fnName === 'explain_match') {
          result = explainMatch(state, args.matchId);
          summary = `Audited candidate ${args.matchId}: ${result.explanation}`;
        } else if (fnName === 'draft_reminder') {
          result = draftReminder(state, args.invoiceQuery);
          summary = `Drafted polite reminder email for ${result.invoiceNumber} (${result.recipientEmail}) — DRAFT ONLY.`;
        } else if (fnName === 'triage_exceptions') {
          result = await triageExceptionsWithNemotron({ state, model });
          summary = `Triaged ${result.totalItems} exceptions (${result.verifiedCount} verified, ${result.rejectedCount} rejected).`;
        }

        toolSteps.push({
          name: fnName,
          args,
          result,
          summary,
        });

        toolMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          name: fnName,
          content: JSON.stringify(result),
        });
      }

      // Second turn: send tool results back to Nemotron for final synthesis
      const secondTurnPayload = {
        model,
        messages: [
          { role: 'system', content: NEMOTRON_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
          message,
          ...toolMessages,
        ],
        temperature: 0.2,
      };

      const secondResponse = await callLlm(secondTurnPayload);
      const finalContent = secondResponse?.choices?.[0]?.message?.content ||
        'Tool execution complete. See audit breakdown above.';

      return {
        id: `nem-${Date.now()}`,
        role: 'assistant',
        content: finalContent,
        toolCalls: toolSteps,
        isNemotron: true,
        model,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    }

    // Direct content answer without tool calls
    return {
      id: `nem-${Date.now()}`,
      role: 'assistant',
      content: message.content || 'I have analyzed your ledger status.',
      toolCalls: toolSteps,
      isNemotron: true,
      model,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  } catch (err) {
    console.warn('Nemotron tool calling failed, falling back to scripted runner:', err.message);
    return runScriptedDemo(prompt, state, studioApi);
  }
}
