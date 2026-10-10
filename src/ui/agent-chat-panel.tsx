/**
 * SettleSight — Reconciliation Agent Chat Panel
 *
 * Provides interactive chat with the AI Reconciliation Auditor,
 * displaying dynamic ledger summaries and visible tool execution steps.
 */

import React, { useState, useRef, useEffect } from 'react';
import { useReconciliation } from './reconciliation-context';
import { fromCents } from '../match/normalize.js';
import { runScriptedDemo, SCRIPTED_DEMO_NOTICE } from '../agent/scripted-runner.js';
import type { ChatMessage, ToolCallStep } from '../agent/types';

const SUGGESTED_PROMPTS = [
  'Show unpaid invoices over 30 days',
  'Audit partial payments & fee discrepancies',
  'Draft reminder for overdue Horizon invoice',
];

export const AgentChatPanel: React.FC = () => {
  const { engineState, summary, hasLlm, studioApi } = useReconciliation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

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
      const reply = runScriptedDemo(text, engineState, studioApi);
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

  return (
    <aside style={{ width: '360px', flexShrink: 0, borderLeft: '1px solid #E2E8F0', backgroundColor: '#FFFFFF', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', backgroundColor: '#FAFAFA', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>✨</span>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', margin: 0 }}>Reconciliation Agent</h2>
        </div>
        <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', backgroundColor: hasLlm ? '#DCFCE7' : '#EEF2FF', color: hasLlm ? '#15803D' : '#4F46E5', fontWeight: 600 }}>
          {hasLlm ? 'Gemini Live' : 'Demo Agent'}
        </span>
      </div>

      {/* Messages Log */}
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
            placeholder="Ask Reconciliation Agent..."
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
          {hasLlm ? 'Gemini 2.5 Flash connected' : SCRIPTED_DEMO_NOTICE}
        </div>
      </div>
    </aside>
  );
};

export default AgentChatPanel;
