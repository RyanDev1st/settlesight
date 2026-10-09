import React, { useState, useEffect } from 'react';
import type { AgWidgetParams } from 'ag-studio';
import { DEMO_INVOICES, DEMO_MATCHES } from '../../ui/placeholder-data';

interface MeterMetrics {
  totalInvoiced: number;
  autoMatched: number;
  suggested: number;
  openAmount: number;
  matchedPercent: number;
  suggestedPercent: number;
}

export const ReconciliationMeter: React.FC<AgWidgetParams> = ({ widgetApi }) => {
  const [metrics, setMetrics] = useState<MeterMetrics>(() => {
    const total = DEMO_INVOICES.reduce((sum, inv) => sum + inv.amount, 0);
    const auto = DEMO_MATCHES.filter((m) => m.state === 'auto' || m.state === 'approved').reduce(
      (sum, m) => sum + Math.max(0, m.allocated),
      0
    );
    const suggested = DEMO_MATCHES.filter((m) => m.state === 'suggested').reduce(
      (sum, m) => sum + Math.max(0, m.allocated),
      0
    );
    const open = Math.max(0, total - (auto + suggested));
    const matchedPct = total > 0 ? (auto / total) * 100 : 0;
    const suggPct = total > 0 ? (suggested / total) * 100 : 0;

    return {
      totalInvoiced: total,
      autoMatched: auto,
      suggested,
      openAmount: open,
      matchedPercent: matchedPct,
      suggestedPercent: suggPct,
    };
  });

  useEffect(() => {
    let cancelled = false;
    if (widgetApi?.getData && widgetApi?.getSchema) {
      try {
        const schema = widgetApi.getSchema();
        const invTable = schema.find((t) => t.id === 'invoices');
        if (invTable && invTable.fields && invTable.fields.length > 0) {
          const fields = invTable.fields.filter(
            (f) => f.key === 'amount' || f.key === 'paid_amount' || f.key === 'open_amount'
          );
          if (fields.length > 0) {
            widgetApi
              .getData({ fields })
              .then((res) => {
                if (!cancelled && res?.results?.rows?.[0]) {
                  const row = res.results.rows[0];
                  const total = Number(row['invoices.amount'] ?? metrics.totalInvoiced);
                  const paid = Number(row['invoices.paid_amount'] ?? metrics.autoMatched);
                  const open = Number(row['invoices.open_amount'] ?? metrics.openAmount);
                  const pct = total > 0 ? (paid / total) * 100 : 0;
                  setMetrics((prev) => ({
                    ...prev,
                    totalInvoiced: total,
                    autoMatched: paid,
                    openAmount: open,
                    matchedPercent: pct,
                  }));
                }
              })
              .catch(() => {
                // Fallback to seeded demo metrics
              });
          }
        }
      } catch (err) {
        console.warn('Error querying schema in ReconciliationMeter:', err);
      }
    }
    return () => {
      cancelled = true;
    };
  }, [widgetApi]);

  const totalReconciledPercent = Math.min(
    100,
    metrics.matchedPercent + metrics.suggestedPercent
  );

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
              backgroundColor: '#E6F4EA',
              color: '#137333',
              fontWeight: 500,
            }}
          >
            Live Demo
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '8px 0 12px' }}>
          <span style={{ fontSize: '28px', fontWeight: 700, color: '#0070BA' }}>
            {totalReconciledPercent.toFixed(1)}%
          </span>
          <span style={{ fontSize: '13px', color: '#546E7A' }}>
            reconciled (${(metrics.autoMatched + metrics.suggested).toLocaleString('en-US', { minimumFractionDigits: 2 })} of ${metrics.totalInvoiced.toLocaleString('en-US', { minimumFractionDigits: 2 })})
          </span>
        </div>

        {/* Progress Bar */}
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
            title={`Auto-matched: ${metrics.matchedPercent.toFixed(1)}%`}
            style={{
              width: `${metrics.matchedPercent}%`,
              backgroundColor: '#10B981',
              transition: 'width 0.4s ease',
            }}
          />
          <div
            title={`Suggested: ${metrics.suggestedPercent.toFixed(1)}%`}
            style={{
              width: `${metrics.suggestedPercent}%`,
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
            ${metrics.autoMatched.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '6px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0070BA' }} />
            Suggested (AI)
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
            ${metrics.suggested.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        <div style={{ padding: '6px', backgroundColor: '#F8FAFC', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94A3B8' }} />
            Open Balance
          </div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: '#0F172A', marginTop: '2px' }}>
            ${metrics.openAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReconciliationMeter;
