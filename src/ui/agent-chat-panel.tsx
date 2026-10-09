import React, { useState } from 'react';

export const AgentChatPanel: React.FC = () => {
  const [agentInput, setAgentInput] = useState<string>('');

  return (
    <aside
      style={{
        width: '340px',
        flexShrink: 0,
        borderLeft: '1px solid #E2E8F0',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '-2px 0 8px rgba(0,0,0,0.02)',
      }}
    >
      {/* Agent Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #E2E8F0',
          backgroundColor: '#FAFAFA',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>✨</span>
          <h2 style={{ fontSize: '14px', fontWeight: 600, color: '#0F172A', margin: 0 }}>
            Reconciliation Agent
          </h2>
        </div>
        <span
          style={{
            fontSize: '11px',
            padding: '2px 8px',
            borderRadius: '10px',
            backgroundColor: '#EEF2FF',
            color: '#4F46E5',
            fontWeight: 600,
          }}
        >
          Wave B
        </span>
      </div>

      {/* Chat Messages Log */}
      <div
        style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          backgroundColor: '#F8FAFC',
        }}
      >
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '8px',
            padding: '12px',
            fontSize: '13px',
            color: '#334155',
            lineHeight: 1.45,
            boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ fontWeight: 600, color: '#0070BA', marginBottom: '4px', fontSize: '12px' }}>
            SettleSight Auditor
          </div>
          I have loaded <strong>15 PayPal Invoices</strong> ($20,490.00 total) and{' '}
          <strong>20 Sandbox Transactions</strong>.
          <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12px' }}>
            <li>6 invoices ($7,550.00) auto-matched</li>
            <li>6 candidate matches ($5,640.00) in Exceptions Queue</li>
            <li>3 invoices pending settlement</li>
          </ul>
        </div>

        <div
          style={{
            backgroundColor: '#EFF6FF',
            border: '1px dashed #93C5FD',
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '12px',
            color: '#1E40AF',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Suggested Prompts:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }}>
              • "Show unpaid invoices over 30 days"
            </span>
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }}>
              • "Audit partial payments & fee discrepancies"
            </span>
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }}>
              • "Draft reminder for overdue Horizon invoice"
            </span>
          </div>
        </div>
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: '12px 14px',
          borderTop: '1px solid #E2E8F0',
          backgroundColor: '#FFFFFF',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            placeholder="Ask Reconciliation Agent..."
            value={agentInput}
            onChange={(e) => setAgentInput(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: '1px solid #CBD5E1',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          <button
            style={{
              padding: '8px 14px',
              backgroundColor: '#0070BA',
              color: '#FFFFFF',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Send
          </button>
        </div>
        <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px', textAlign: 'center' }}>
          Studio Agent Framework harness connects in Wave B
        </div>
      </div>
    </aside>
  );
};
