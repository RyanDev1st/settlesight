import React from 'react';
import type { AgWidgetParams } from 'ag-studio';
import { useReconciliation } from '../../ui/reconciliation-context';
import { fromCents } from '../../match/normalize.js';

export const ReconciliationMeter: React.FC<AgWidgetParams> = () => {
  const { mode, summary, engineState } = useReconciliation();

  // Single source of numbers: summarize() from src/match
  const totalInvoiced = summary?.total_invoiced ? fromCents(summary.total_invoiced) : 0;
  const reconciledValue = summary?.matched_value ? fromCents(summary.matched_value) : 0;
  const reconciledPercent = summary?.matched_percent ?? (totalInvoiced > 0 ? (reconciledValue / totalInvoiced) * 100 : 0);
  const openAmount = summary?.open_value ? fromCents(summary.open_value) : 0;

  // Suggested matches pending seller review/approval shown separately
  const suggestedMatches = (engineState?.matches || []).filter((m: any) => m.state === 'suggested');
  const suggestedCents = suggestedMatches.reduce((sum: number, m: any) => sum + (m.allocated || 0), 0);
  const suggestedValue = fromCents(suggestedCents);
  const suggestedPercent = totalInvoiced > 0 ? (suggestedValue / totalInvoiced) * 100 : 0;

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

        {/* Primary Reconciled Metric */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0 2px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#10B981' }}>
            {reconciledPercent.toFixed(1)}%
          </span>
          <span style={{ fontSize: '13px', color: '#1E293B', fontWeight: 600 }}>
            reconciled (${reconciledValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} of $
            {totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })})
          </span>
        </div>

        {/* Suggested Candidates Awaiting Review */}
        <div style={{ fontSize: '12px', color: '#0070BA', marginBottom: '12px', fontWeight: 500 }}>
          + ${suggestedValue.toLocaleString('en-US', { minimumFractionDigits: 2 })} awaiting review ({suggestedPercent.toFixed(1)}%, {(summary as any)?.suggested_count ?? suggestedMatches.length} candidates)
        </div>

        {/* Dual Progress Bar: Green (Reconciled) + Blue (Awaiting Review) */}
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
            title={`Reconciled (auto + approved): ${reconciledPercent.toFixed(1)}%`}
            style={{
              width: `${Math.min(100, reconciledPercent)}%`,
              backgroundColor: '#10B981',
              transition: 'width 0.4s ease',
            }}
          />
          <div
            title={`Awaiting review (suggested): ${suggestedPercent.toFixed(1)}%`}
            style={{
              width: `${Math.min(100 - reconciledPercent, suggestedPercent)}%`,
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
            Reconciled
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
            ${reconciledValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '6px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0070BA' }} />
            Awaiting Review
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
            ${suggestedValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
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
