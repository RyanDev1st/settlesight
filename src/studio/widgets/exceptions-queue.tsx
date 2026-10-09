import React, { useState } from 'react';
import type { AgWidgetParams } from 'ag-studio';
import { useReconciliation } from '../../ui/reconciliation-context';
import { listExceptions } from '../../agent/tools.js';
import type { ExceptionItem } from '../../agent/types';

export const ExceptionsQueue: React.FC<AgWidgetParams> = () => {
  const { engineState, approveCandidate } = useReconciliation();
  const [activeTab, setActiveTab] = useState<'all' | 'suggested' | 'review'>('all');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Compute live exceptions list directly from engine state
  const items: ExceptionItem[] = listExceptions(engineState);

  const filteredItems = items.filter((item) => {
    if (activeTab === 'suggested') return item.state === 'suggested';
    if (activeTab === 'review') return item.confidence < 0.8;
    return true;
  });

  const suggestedCount = items.filter((i) => i.state === 'suggested').length;
  const reviewCount = items.filter((i) => i.confidence < 0.8).length;

  const handleApprove = (id: string) => {
    setErrorMessage(null);
    const result = approveCandidate(id);
    if (!result.success) {
      setErrorMessage(`Cannot approve match ${id}: ${result.error || 'Validation failed'}`);
    }
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
      case 'ambiguity':
        return { backgroundColor: '#FCE7F3', color: '#9D174D' };
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
      {/* Header & Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
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
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
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
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '4px',
              border: '1px solid #CBD5E1',
              backgroundColor: activeTab === 'suggested' ? '#0070BA' : '#FFFFFF',
              color: activeTab === 'suggested' ? '#FFFFFF' : '#475569',
              cursor: 'pointer',
            }}
          >
            Suggested ({suggestedCount})
          </button>
          <button
            onClick={() => setActiveTab('review')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: '4px',
              border: '1px solid #CBD5E1',
              backgroundColor: activeTab === 'review' ? '#0070BA' : '#FFFFFF',
              color: activeTab === 'review' ? '#FFFFFF' : '#475569',
              cursor: 'pointer',
            }}
          >
            Review &lt;80% ({reviewCount})
          </button>
        </div>
      </div>

      {/* Validation Error Banner */}
      {errorMessage && (
        <div
          style={{
            marginBottom: '8px',
            padding: '8px 12px',
            backgroundColor: '#FEF2F2',
            border: '1px solid #F87171',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#B91C1C',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>⚠️ {errorMessage}</span>
          <button
            onClick={() => setErrorMessage(null)}
            style={{ background: 'none', border: 'none', color: '#B91C1C', cursor: 'pointer', fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Scrollable Table View */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid #E2E8F0', borderRadius: '6px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
          <thead style={{ position: 'sticky', top: 0, backgroundColor: '#F8FAFC', zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid #E2E8F0', color: '#475569' }}>
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
                  ${item.allocated.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
                  ) : item.state === 'exception' ? (
                    <span style={{ fontSize: '11px', color: '#9D174D', fontWeight: 600 }}>Needs Review</span>
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
