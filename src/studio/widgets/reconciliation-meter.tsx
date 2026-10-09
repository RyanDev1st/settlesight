import React from 'react';
import type { AgWidgetParams } from 'ag-studio';
import { useReconciliation } from '../../ui/reconciliation-context';
import { fromCents } from '../../match/normalize.js';

export const ReconciliationMeter: React.FC<AgWidgetParams> = () => {
  const { mode, summary, engineState } = useReconciliation();

  const totalInvoiced = summary?.total_invoiced ? fromCents(summary.total_invoiced) : 0;
  const autoMatched = summary?.matched_value ? fromCents(summary.matched_value) : 0;
  const openAmount = summary?.open_value ? fromCents(summary.open_value) : 0;

  // Suggested matches pending seller approval
  const suggestedCents = (engineState?.matches || [])
    .filter((m: any) => m.state === 'suggested')
    .reduce((sum: number, m: any) => sum + (m.allocated || 0), 0);
  const suggested = fromCents(suggestedCents);

  const matchedPercent = totalInvoiced > 0 ? (autoMatched / totalInvoiced) * 100 : 0;
  const suggestedPercent = totalInvoiced > 0 ? (suggested / totalInvoiced) * 100 : 0;
  const totalReconciledPercent = Math.min(100, matchedPercent + suggestedPercent);

  const isLive = mode === 'live';

  return (
    <div
      style={{
        padding: '16px',
        height: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: '#0A192F',
              margin: 0,
            }}
          >
            Reconciliation Meter
          </h3>
          <span
            style={{
              fontSize: '11px',
              padding: '2px 8px',
              borderRadius: '12px',
              backgroundColor: isLive ? '#E6F4EA' : '#E0F2FE',
              color: isLive ? '#137333' : '#0284C7',
              fontWeight: 600,
            }}
          >
            {isLive ? 'Live Sandbox' : 'Demo Mode'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0 12px' }}>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#0070BA' }}>
            {totalReconciledPercent.toFixed(1)}%
          </span>
          <span style={{ fontSize: '13px', color: '#546E7A' }}>
            reconciled (${(autoMatched + suggested).toLocaleString('en-US', { minimumFractionDigits: 2 })} of $
            {totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })})
          </span>
        </div>

        {/* Dual Progress Bar */}
        <div
          style={{
            height: '10px',
            borderRadius: '5px',
            backgroundColor: '#ECEFF1',
            overflow: 'hidden',
            display: 'flex',
            marginBottom: '14px',
          }}
        >
          <div
            title={`Auto-matched: ${matchedPercent.toFixed(1)}%`}
            style={{
              width: `${matchedPercent}%`,
              backgroundColor: '#10B981',
              transition: 'width 0.4s ease',
            }}
          />
          <div
            title={`Suggested: ${suggestedPercent.toFixed(1)}%`}
            style={{
              width: `${suggestedPercent}%`,
              backgroundColor: '#0070BA',
              transition: 'width 0.4s ease',
            }}
          />
        </div>
      </div>

      {/* Metric Breakdown Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          paddingTop: '8px',
          borderTop: '1px solid #EEF2F6',
        }}
      >
        <div style={{ padding: '6px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981' }} />
            Auto-Matched
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
            ${autoMatched.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '6px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0070BA' }} />
            Suggested (AI)
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
            ${suggested.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '6px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94A3B8' }} />
            Open Balance
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
            ${openAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReconciliationMeter;
