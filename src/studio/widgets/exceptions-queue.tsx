import React, { useState } from 'react';
import type { AgWidgetParams } from 'ag-studio';
import { DEMO_MATCHES, DEMO_INVOICES, DEMO_TRANSACTIONS } from '../../ui/placeholder-data';

interface QueueItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  payerName: string;
  amount: number;
  method: string;
  confidence: number;
  reasons: string;
  state: 'auto' | 'suggested' | 'approved' | 'rejected';
}

export const ExceptionsQueue: React.FC<AgWidgetParams> = () => {
  const [items, setItems] = useState<QueueItem[]>(() => {
    return DEMO_MATCHES.filter((m) => m.state === 'suggested' || m.confidence < 1.0).map((m) => {
      const inv = DEMO_INVOICES.find((i) => i.id === m.invoice_id);
      const txn = DEMO_TRANSACTIONS.find((t) => t.id === m.transaction_id);
      return {
        id: m.id,
        invoiceNumber: inv?.number ?? m.invoice_id,
        customerName: inv?.customer_name ?? 'Unknown Customer',
        payerName: txn?.payer_name ?? 'Unknown Payer',
        amount: m.allocated,
        method: m.method,
        confidence: m.confidence,
        reasons: m.reasons,
        state: m.state,
      };
    });
  });

  const [activeTab, setActiveTab] = useState<'all' | 'suggested' | 'review'>('all');

  const filteredItems = items.filter((item) => {
    if (activeTab === 'suggested') return item.state === 'suggested';
    if (activeTab === 'review') return item.confidence < 0.8;
    return true;
  });

  const handleApprove = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, state: 'approved' } : item))
    );
  };

  const getMethodBadgeStyle = (method: string): React.CSSProperties => {
    switch (method) {
      case 'partial':
        return { backgroundColor: '#FEF3C7', color: '#92400E' };
      case 'email':
        return { backgroundColor: '#E0E7FF', color: '#3730A3' };
      case 'fee_adjusted':
        return { backgroundColor: '#E0F2FE', color: '#0369A1' };
      case 'refund':
        return { backgroundColor: '#FEE2E2', color: '#991B1B' };
      default:
        return { backgroundColor: '#F3F4F6', color: '#374151' };
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0A192F', margin: 0 }}>
            Exceptions Queue
          </h3>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            Flagged discrepancies requiring one-click seller confirmation
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setActiveTab('all')}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: '4px',
              border: '1px solid #CBD5E1',
              backgroundColor: activeTab === 'all' ? '#0070BA' : '#FFFFFF',
              color: activeTab === 'all' ? '#FFFFFF' : '#475569',
              cursor: 'pointer',
            }}
          >
            All ({items.length})
          </button>
          <button
            onClick={() => setActiveTab('suggested')}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: '4px',
              border: '1px solid #CBD5E1',
              backgroundColor: activeTab === 'suggested' ? '#0070BA' : '#FFFFFF',
              color: activeTab === 'suggested' ? '#FFFFFF' : '#475569',
              cursor: 'pointer',
            }}
          >
            Suggested
          </button>
          <button
            onClick={() => setActiveTab('review')}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 500,
              borderRadius: '4px',
              border: '1px solid #CBD5E1',
              backgroundColor: activeTab === 'review' ? '#0070BA' : '#FFFFFF',
              color: activeTab === 'review' ? '#FFFFFF' : '#475569',
              cursor: 'pointer',
            }}
          >
            Review (&lt;80%)
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead>
            <tr style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
              <th style={{ padding: '8px 10px', fontWeight: 600 }}>Invoice / Payer</th>
              <th style={{ padding: '8px 10px', fontWeight: 600 }}>Amount</th>
              <th style={{ padding: '8px 10px', fontWeight: 600 }}>Pattern</th>
              <th style={{ padding: '8px 10px', fontWeight: 600 }}>Confidence</th>
              <th style={{ padding: '8px 10px', fontWeight: 600 }}>AI Audit Explanation</th>
              <th style={{ padding: '8px 10px', fontWeight: 600, textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr
                key={item.id}
                style={{
                  borderBottom: '1px solid #F1F5F9',
                  backgroundColor: item.state === 'approved' ? '#F0FDF4' : 'transparent',
                }}
              >
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.invoiceNumber}</div>
                  <div style={{ fontSize: '11px', color: '#64748B' }}>{item.payerName}</div>
                </td>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: '#0F172A' }}>
                  ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <span
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      ...getMethodBadgeStyle(item.method),
                    }}
                  >
                    {item.method.replace('_', ' ')}
                  </span>
                </td>
                <td style={{ padding: '8px 10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor:
                          item.confidence >= 0.9 ? '#10B981' : item.confidence >= 0.7 ? '#F59E0B' : '#EF4444',
                      }}
                    />
                    <span style={{ fontWeight: 600 }}>{(item.confidence * 100).toFixed(0)}%</span>
                  </div>
                </td>
                <td style={{ padding: '8px 10px', color: '#334155', maxWidth: '240px', lineHeight: 1.3 }}>
                  {item.reasons}
                </td>
                <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                  {item.state === 'approved' ? (
                    <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: 600 }}>Approved</span>
                  ) : (
                    <button
                      onClick={() => handleApprove(item.id)}
                      style={{
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: 600,
                        backgroundColor: '#0070BA',
                        color: '#FFFFFF',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                      }}
                    >
                      Approve
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExceptionsQueue;
