/**
 * SettleSight — Reconciliation Agent Chat Panel
 *
 * Provides interactive chat with the AI Reconciliation Auditor,
 * displaying dynamic ledger summaries, visible tool execution steps,
 * and LLM-Ranked Exception Triage via NVIDIA Nemotron on Nebius Token Factory.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useReconciliation } from './reconciliation-context';
import { fromCents } from '../match/normalize.js';
import { runScriptedDemo, SCRIPTED_DEMO_NOTICE } from '../agent/scripted-runner.js';
import { runNemotronAgentTurn } from '../agent/nemotron-runner.js';
import { triageExceptionsWithNemotron } from '../agent/triage.js';
import type { TriageRankedItem, TriageResult } from '../agent/triage';
import type { ChatMessage, ToolCallStep } from '../agent/types';

const SUGGESTED_PROMPTS = [
  'Show unpaid invoices over 30 days',
  'Audit partial payments & fee discrepancies',
  'Draft reminder for overdue Horizon invoice',
];

export const AgentChatPanel: React.FC = () => {
  const { engineState, summary, hasLlm, llmProvider, studioApi, approveCandidate } = useReconciliation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);
  const [showTriageView, setShowTriageView] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, triageResult]);

  // Client LLM proxy helper calling /api/llm (keeps keys server-side)
  const callLlmProxy = async (payload: any) => {
    const res = await fetch('/api/llm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(`LLM proxy failed (${res.status}): ${txt}`);
    }
    return await res.json();
  };

  const handleSendPrompt = async (promptText: string) => {
    const text = promptText.trim();
    if (!text || isProcessing) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsProcessing(true);

    try {
      let reply: ChatMessage;
      if (llmProvider === 'nebius') {
        reply = await runNemotronAgentTurn({
          prompt: text,
          state: engineState,
          callLlm: hasLlm ? callLlmProxy : undefined,
          studioApi,
        });
      } else {
        reply = runScriptedDemo(text, engineState, studioApi);
      }
      setMessages((prev) => [...prev, reply]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Error executing agent task: ${err.message}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRunTriage = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    setShowTriageView(true);

    try {
      const result = await triageExceptionsWithNemotron({
        state: engineState,
        callLlm: hasLlm ? callLlmProxy : undefined,
      });
      setTriageResult(result);

      // Add a summary message to chat stream
      const triageMsg: ChatMessage = {
        id: `triage-${Date.now()}`,
        role: 'assistant',
        content:
          `### 🤖 Nemotron AI Exception Triage Complete\n\n` +
          `${result.summaryText}\n\n` +
          `• **Total Items Evaluated:** ${result.totalItems}\n` +
          `• **Deterministic Math Verified:** ${result.verifiedCount}\n` +
          (result.rejectedCount > 0
            ? `• ⚠️ **Invariant Rejections:** ${result.rejectedCount} (violations flagged below)\n`
            : `• **Invariant Rejections:** 0\n`) +
          `\n*Review individual candidates in the triage view above. Deterministic engine maintains final approval authority.*`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, triageMsg]);
    } catch (err: any) {
      alert(`AI triage failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveTriageItem = (item: TriageRankedItem) => {
    if (!item.matchId || !item.invariantPassed) return;
    const res = approveCandidate(item.matchId);
    if (res.success) {
      // Remove approved item from current triage result view
      setTriageResult((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          rankedItems: prev.rankedItems.filter((i) => i.matchId !== item.matchId),
          verifiedCount: Math.max(0, prev.verifiedCount - 1),
        };
      });
    } else {
      alert(`Approval rejected: ${res.error}`);
    }
  };

  const invCount = engineState?.invoices?.length || 0;
  const txnCount = engineState?.transactions?.length || 0;
  const totalInv = summary?.total_invoiced ? fromCents(summary.total_invoiced) : 0;
  const matchedVal = summary?.matched_value ? fromCents(summary.matched_value) : 0;
  const autoCount = (engineState?.invoices || []).filter((i: any) => i.match_status === 'matched').length;
  const suggestedMatches = (engineState?.matches || []).filter((m: any) => m.state === 'suggested');
  const suggestedTotal = fromCents(
    suggestedMatches.reduce((s: number, m: any) => s + (m.allocated || 0), 0)
  );
  const pendingCount = (engineState?.invoices || []).filter((i: any) => (i.open_amount || 0) > 0).length;

  // Compute Badge
  let badgeLabel = 'Demo Agent';
  let badgeBg = '#EEF2FF';
  let badgeColor = '#4F46E5';
  if (hasLlm) {
    if (llmProvider === 'nebius') {
      badgeLabel = 'Nemotron Live';
      badgeBg = '#DCFCE7';
      badgeColor = '#15803D';
    } else {
      badgeLabel = 'Gemini Live';
      badgeBg = '#DCFCE7';
      badgeColor = '#15803D';
    }
  } else if (llmProvider === 'nebius') {
    badgeLabel = 'Nebius Demo';
    badgeBg = '#FEF3C7';
    badgeColor = '#92400E';
  }

  return (
    <aside style={{ width: '380px', flexShrink: 0, borderLeft: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>✨</span>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Reconciliation Agent</h2>
        </div>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', backgroundColor: badgeBg, color: badgeColor, fontWeight: 600 }}>
          {badgeLabel}
        </span>
      </div>

      {/* Messages Log & Triage Area */}
      <div ref={scrollRef} style={{ flex: 1, padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', backgroundColor: '#F8FAFC' }}>
        {/* Dynamic Summary */}
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#334155', lineHeight: 1.45 }}>
          <div style={{ fontWeight: 600, color: '#0070BA', marginBottom: '4px', fontSize: '12px' }}>SettleSight Auditor</div>
          I have loaded <strong>{invCount} PayPal Invoices</strong> (${totalInv.toLocaleString('en-US', { minimumFractionDigits: 2 })}) and <strong>{txnCount} Sandbox Transactions</strong>.
          <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
            <li>{autoCount} invoices (${matchedVal.toLocaleString('en-US', { minimumFractionDigits: 2 })}) auto-matched</li>
            <li>{suggestedMatches.length} candidate matches (${suggestedTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}) in Exceptions Queue</li>
            <li>{pendingCount} invoices pending settlement</li>
          </ul>
        </div>

        {/* AI Triage (Nemotron) Toggle Card - VISIBLE ONLY WHEN llmProvider === 'nebius' */}
        {llmProvider === 'nebius' && (
          <div style={{ backgroundColor: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '15px' }}>⚡</span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#166534' }}>AI triage (Nemotron)</span>
              </div>
              <button
                onClick={handleRunTriage}
                disabled={isProcessing}
                style={{
                  padding: '5px 12px',
                  backgroundColor: '#16A34A',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: isProcessing ? 'default' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                }}
              >
                {triageResult ? 'Refresh Triage' : 'Run AI Triage'}
              </button>
            </div>
            <div style={{ fontSize: '11px', color: '#15803D', lineHeight: 1.35 }}>
              NVIDIA Nemotron Super/Ultra evaluates exceptions and fee structures with deterministic math verification.
            </div>

            {/* Render Triage Queue if Active */}
            {showTriageView && triageResult && (
              <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#334155' }}>
                  Ranked Priority Queue ({triageResult.rankedItems.length} items):
                </div>
                {triageResult.rankedItems.map((item) => (
                  <div
                    key={item.matchId}
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: `1px solid ${item.invariantPassed ? '#CBD5E1' : '#FCA5A5'}`,
                      borderRadius: '6px',
                      padding: '8px 10px',
                      fontSize: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 700, color: '#0F172A' }}>
                        #{item.priorityRank} {item.invoiceNumber || item.matchId}
                      </span>
                      <span
                        style={{
                          fontSize: '10px',
                          padding: '1px 6px',
                          borderRadius: '8px',
                          backgroundColor: item.urgency === 'critical' ? '#FEE2E2' : item.urgency === 'high' ? '#FEF3C7' : '#F1F5F9',
                          color: item.urgency === 'critical' ? '#991B1B' : item.urgency === 'high' ? '#92400E' : '#334155',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}
                      >
                        {item.urgency}
                      </span>
                    </div>

                    <div style={{ color: '#475569', fontSize: '11px' }}>
                      Payer: <strong>{item.payerName}</strong> • ${Number(item.allocatedDollars).toFixed(2)}
                    </div>

                    <div style={{ fontSize: '11px', color: '#1E293B', fontStyle: 'italic' }}>
                      "{item.reasoning}"
                    </div>

                    {/* Deterministic Validation Status */}
                    {item.invariantPassed ? (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#16A34A', fontWeight: 600 }}>
                          ✅ Validated by Engine
                        </span>
                        <button
                          onClick={() => handleApproveTriageItem(item)}
                          style={{
                            padding: '3px 8px',
                            backgroundColor: '#0070BA',
                            color: '#FFFFFF',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          Approve
                        </button>
                      </div>
                    ) : (
                      <div style={{ backgroundColor: '#FEF2F2', padding: '4px 6px', borderRadius: '4px', marginTop: '4px' }}>
                        <span style={{ fontSize: '10px', color: '#DC2626', fontWeight: 600 }}>
                          ❌ Invariant Rejection: {item.rejectionReason}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Suggested Prompt Buttons */}
        <div style={{ backgroundColor: '#EFF6FF', border: '1px dashed #93C5FD', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#1E40AF' }}>
          <div style={{ fontWeight: 600, marginBottom: '6px' }}>Suggested Prompts:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => handleSendPrompt(p)}
                style={{ textAlign: 'left', background: 'none', border: 'none', padding: '2px 0', color: '#1D4ED8', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
              >
                • "{p}"
              </button>
            ))}
          </div>
        </div>

        {/* Message Entries */}
        {messages.map((m) => (
          <div key={m.id} style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
            <div style={{ backgroundColor: m.role === 'user' ? '#0070BA' : '#FFFFFF', color: m.role === 'user' ? '#FFFFFF' : '#1E293B', border: m.role === 'user' ? 'none' : '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
              {m.toolCalls && m.toolCalls.map((tc: ToolCallStep, idx: number) => (
                <div key={idx} style={{ padding: '6px 8px', backgroundColor: '#F1F5F9', borderLeft: '3px solid #0070BA', borderRadius: '3px', fontSize: '11px', color: '#334155', marginBottom: '6px' }}>
                  <div style={{ fontWeight: 600, color: '#0369A1' }}>🔧 Tool Call: <code style={{ color: '#0F172A' }}>{tc.name}()</code></div>
                  <div style={{ marginTop: '2px', color: '#475569' }}>↳ {tc.summary}</div>
                </div>
              ))}
              {m.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid #E2E8F0', backgroundColor: '#FFFFFF' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder={llmProvider === 'nebius' ? 'Ask Nemotron Auditor...' : 'Ask Reconciliation Agent...'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendPrompt(input)}
            style={{ flex: 1, padding: '8px 12px', borderRadius: '6px', border: '1px solid #CBD5E1', fontSize: '13px', outline: 'none' }}
          />
          <button
            onClick={() => handleSendPrompt(input)}
            disabled={isProcessing}
            style={{ padding: '8px 14px', backgroundColor: '#0070BA', color: '#FFFFFF', border: 'none', borderRadius: '6px', fontSize: '13px', fontWeight: 600, cursor: isProcessing ? 'default' : 'pointer' }}
          >
            Send
          </button>
        </div>
        <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', textAlign: 'center' }}>
          {hasLlm
            ? (llmProvider === 'nebius' ? 'NVIDIA Nemotron Super (Nebius Token Factory) connected' : 'Gemini 2.5 Flash connected')
            : (llmProvider === 'nebius' ? 'Nebius mode (demo fallback) — add NEBIUS_API_KEY for live AI' : SCRIPTED_DEMO_NOTICE)}
        </div>
      </div>
    </aside>
  );
};

export default AgentChatPanel;
