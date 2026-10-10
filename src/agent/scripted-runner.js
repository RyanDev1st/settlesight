/**
 * SettleSight — Scripted Demo Agent Runner
 *
 * Provides deterministic tool executions and structured chat outputs
 * for the 3 suggested reconciliation prompts, showing visible tool-call steps.
 */

import { listExceptions, explainMatch, draftReminder } from './tools.js';
import { fromCents } from '../match/normalize.js';

export const SCRIPTED_DEMO_NOTICE =
  'Demo agent (scripted) — add GEMINI_API_KEY for live AI';

/**
 * Checks if a user prompt corresponds to one of the scripted demo prompts.
 */
export function isScriptedPrompt(prompt) {
  const p = String(prompt).toLowerCase();
  return (
    p.includes('unpaid') ||
    p.includes('over 30 days') ||
    p.includes('aging') ||
    p.includes('partial') ||
    p.includes('fee discrepancies') ||
    p.includes('discrepanc') ||
    p.includes('horizon') ||
    p.includes('draft reminder') ||
    p.includes('reminder')
  );
}

/**
 * Executes a scripted response with visible tool calls for the given prompt.
 * Optionally interacts with the real AG Studio API to dynamically mutate the dashboard.
 */
export function runScriptedDemo(prompt, state, studioApi = null) {
  const p = String(prompt).toLowerCase();
  const toolCalls = [];
  let content = '';

  if (p.includes('reminder') || p.includes('draft')) {
    // Prompt 3: Draft reminder for overdue Horizon invoice (or any customer)
    const targetQuery = p.includes('horizon') ? 'Horizon' : p;
    const draft = draftReminder(state, targetQuery);

    toolCalls.push({
      name: 'draft_reminder',
      args: { invoiceQuery: targetQuery },
      result: {
        invoiceId: draft.invoiceId,
        invoiceNumber: draft.invoiceNumber,
        recipient: draft.recipientEmail,
        status: draft.status,
      },
      summary: `Drafted payment reminder email for ${draft.invoiceNumber} (${draft.recipientName}) — DRAFT ONLY (never sent automatically).`,
    });

    content =
      `### Payment Reminder Draft (Review Required)\n\n` +
      `I have prepared the following draft email for **${draft.invoiceNumber}** (*${draft.daysOverdue} days overdue*):\n\n` +
      `**To:** \`${draft.recipientEmail}\`\n` +
      `**Subject:** ${draft.subject}\n\n` +
      `\`\`\`text\n${draft.body}\n\`\`\`\n\n` +
      `⚠️ **Safety Guard:** This reminder is in **draft status only**. Sending payment reminders or recording settlements requires explicit human review and confirmation.`;
  } else if (p.includes('30') || p.includes('overdue') || p.includes('unpaid') || p.includes('aging')) {
    // Prompt 1: Show unpaid invoices over 30 days
    const invoices = state.invoices || [];
    const overdue30 = invoices.filter((i) => (i.days_overdue || 0) > 30 && (i.open_amount || 0) > 0);
    const totalOverdueCents = overdue30.reduce((sum, i) => sum + (i.open_amount || 0), 0);
    const totalOverdueDollars = fromCents(totalOverdueCents);

    toolCalls.push({
      name: 'list_exceptions',
      args: { filter: { overdueDays: 31, openBalanceOnly: true } },
      result: overdue30.map((i) => ({
        id: i.id,
        number: i.number,
        customer: i.customer_name,
        days_overdue: i.days_overdue,
        open_amount: fromCents(i.open_amount),
      })),
      summary: `Found ${overdue30.length} unpaid invoices overdue by >30 days ($${totalOverdueDollars.toFixed(2)} total).`,
    });

    let widgetAdded = false;
    if (studioApi && typeof studioApi.getState === 'function' && typeof studioApi.setState === 'function') {
      try {
        const currentState = studioApi.getState();
        const pageId = currentState.selectedPageId || 'Close the month';
        const page = (currentState.pages || []).find((p) => p.id === pageId) || currentState.pages?.[0];
        if (page) {
          const widgetId = 'widget-grid-unpaid-30';
          const newWidget = {
            type: 'grid',
            dataMapping: {
              cols: [
                { id: 'invoices.number' },
                { id: 'invoices.customer_name' },
                { id: 'invoices.amount' },
                { id: 'invoices.open_amount' },
                { id: 'invoices.days_overdue' },
                { id: 'invoices.due_date' },
                { id: 'invoices.match_status' },
              ],
            },
            format: {
              title: { text: 'Overdue Invoices (>30 Days)' },
            },
          };

          const newWidgetLayout = {
            xTrack: 0,
            yTrack: 31,
            xSpan: 24,
            ySpan: 12,
          };

          const filterConditions = [
            {
              field: { id: 'invoices.days_overdue' },
              model: {
                operator: 'greaterThan',
                value: 30,
              },
            },
            {
              field: { id: 'invoices.open_amount' },
              model: {
                operator: 'greaterThan',
                value: 0,
              },
            },
          ];

          const nextPages = currentState.pages.map((p) => {
            if (p.id === page.id) {
              return {
                ...p,
                widgets: {
                  ...(p.widgets || {}),
                  [widgetId]: newWidget,
                },
                widgetLayout: {
                  ...(p.widgetLayout || {}),
                  [widgetId]: newWidgetLayout,
                },
                filter: {
                  ...(p.filter || {}),
                  widget: {
                    ...(p.filter?.widget || {}),
                    [widgetId]: filterConditions,
                  },
                },
              };
            }
            return p;
          });

          const nextState = {
            ...currentState,
            pages: nextPages,
          };

          studioApi.setState(nextState);
          try {
            if (typeof window !== 'undefined' && window.localStorage) {
              window.localStorage.setItem('settlesight_studio_layout_v2', JSON.stringify(nextState));
            }
          } catch {}
          widgetAdded = true;
        }
      } catch (err) {
        console.warn('Failed to dynamically add Studio widget:', err);
      }
    }

    if (widgetAdded) {
      toolCalls.push({
        name: 'add_studio_widget',
        args: {
          widgetId: 'widget-grid-unpaid-30',
          type: 'grid',
          title: 'Overdue Invoices (>30 Days)',
          filter: 'days_overdue > 30 && open_amount > 0',
        },
        result: { status: 'created', position: { xTrack: 0, yTrack: 31, xSpan: 24, ySpan: 12 } },
        summary: 'Added Studio grid widget "Overdue Invoices (>30 Days)" filtered to unpaid accounts >30 days.',
      });
    }

    content =
      `### Overdue Invoices (>30 Days)\n\n` +
      `I identified **${overdue30.length} invoices** overdue past 30 days, totaling **$${totalOverdueDollars.toLocaleString('en-US', { minimumFractionDigits: 2 })}**:\n\n` +
      overdue30
        .map(
          (inv) =>
            `- **${inv.number}** (${inv.customer_name}): **$${fromCents(inv.open_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}** open — *${inv.days_overdue} days overdue* (Due: ${inv.due_date || 'N/A'})`
        )
        .join('\n') +
      `\n\n💡 *Action item:* Consider drafting payment reminders for these accounts or escalating 90+ day balances.`;

    if (widgetAdded) {
      content += `\n\n📊 **Dashboard Updated:** Added a real-time filtered AG Grid widget below showing all ${overdue30.length} overdue invoices.`;
    }
  } else if (p.includes('partial') || p.includes('fee') || p.includes('discrepanc') || p.includes('audit')) {
    // Prompt 2: Audit partial payments & fee discrepancies
    const exceptions = listExceptions(state);
    const feeMatches = (state.matches || []).filter((m) => m.method === 'fee_adjusted');
    const partialMatches = (state.matches || []).filter((m) => m.method === 'partial');

    toolCalls.push({
      name: 'list_exceptions',
      args: { methods: ['fee_adjusted', 'partial'] },
      result: { fee_adjusted_count: feeMatches.length, partial_count: partialMatches.length },
      summary: `Queried reconciliation exceptions: ${feeMatches.length} fee-adjusted matches and ${partialMatches.length} partial settlements detected.`,
    });

    const sampleMatch = feeMatches[0] || partialMatches[0] || state.matches?.[0];
    let sampleExplanation = null;
    if (sampleMatch) {
      sampleExplanation = explainMatch(state, sampleMatch.id);
      toolCalls.push({
        name: 'explain_match',
        args: { matchId: sampleMatch.id },
        result: sampleExplanation,
        summary: `Analyzed match ${sampleMatch.id}: ${sampleExplanation.method} with ${(sampleExplanation.confidence * 100).toFixed(0)}% confidence.`,
      });
    }

    content =
      `### Audit: Partial Payments & Fee Discrepancies\n\n` +
      `Reconciliation analysis identified **${feeMatches.length} fee-adjusted** items and **${partialMatches.length} partial payments**:\n\n` +
      `1. **PayPal Fee Deductions:** Invoices where transaction net amounts reflect merchant standard processing fees (~2.9% + $0.30).\n` +
      `2. **Partial Settlements:** Transactions matching invoice references but leaving remaining open balances.\n\n` +
      (sampleExplanation
        ? `**Detailed Example (${sampleExplanation.invoiceNumber}):**\n` +
          `- **Payer:** ${sampleExplanation.payerName} → **Invoice:** ${sampleExplanation.invoiceNumber}\n` +
          `- **Gross Deposit:** $${sampleExplanation.transactionGrossDollars.toFixed(2)} | **PayPal Fee:** $${sampleExplanation.feeDollars.toFixed(2)} | **Net:** $${sampleExplanation.netDollars.toFixed(2)}\n` +
          `- **Rule Reason:** ${sampleExplanation.explanation}\n` +
          `- **Recommendation:** ${sampleExplanation.recommendedAction}\n\n`
        : '') +
      `All ${exceptions.length} items are queued in your **Exceptions Queue** for one-click confirmation.`;
  }

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'assistant',
    content,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    toolCalls,
    isDemoScripted: true,
  };
}
