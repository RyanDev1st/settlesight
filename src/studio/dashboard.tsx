import React, { useCallback, useMemo, useRef, useEffect } from 'react';
import { AgStudio } from 'ag-studio-react';
import type { AgStudioApi, AgStudioApiReadyEvent, AgStudioStateUpdatedEvent } from 'ag-studio';
import { useReconciliation } from '../ui/reconciliation-context';
import { paypalTheme } from './theme';
import { customWidgets } from './widgets';
import { loadSavedState, saveStateToStorage } from './state';

interface DashboardProps {
  resetKey?: number;
  mode?: 'view' | 'edit';
  activePageId?: string;
  onPageChange?: (pageId: string) => void;
}

export const StudioDashboard: React.FC<DashboardProps> = ({
  resetKey = 0,
  mode = 'view',
  activePageId,
  onPageChange,
}) => {
  const { sources, setStudioApi } = useReconciliation();
  const initialState = useMemo(() => loadSavedState(), [resetKey]);
  const apiRef = useRef<AgStudioApi | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleApiReady = useCallback(
    (event: AgStudioApiReadyEvent) => {
      apiRef.current = event.api;
      setStudioApi?.(event.api);
    },
    [setStudioApi]
  );

  const handleStateUpdated = useCallback(
    (event: AgStudioStateUpdatedEvent) => {
      try {
        if (event?.state) {
          saveStateToStorage(event.state);
          if (event.state.selectedPageId && onPageChange) {
            onPageChange(event.state.selectedPageId);
          }
        }
      } catch (err) {
        console.warn('Could not persist studio layout state:', err);
      }
    },
    [onPageChange]
  );

  // Sync activePageId when changed externally (e.g. from header tabs)
  useEffect(() => {
    if (activePageId && apiRef.current) {
      const currentState = apiRef.current.getState();
      if (currentState.selectedPageId !== activePageId) {
        apiRef.current.setState({
          ...currentState,
          selectedPageId: activePageId,
        });
      }
    }
  }, [activePageId]);

  // Sync data updates directly to Studio API
  useEffect(() => {
    if (apiRef.current && sources) {
      try {
        apiRef.current.setProperty('data', sources);
      } catch (err) {
        console.warn('Could not update Studio data property:', err);
      }
    }
  }, [sources]);

  // Decorate the 4 KPI value tiles with explicit titles and fintech typography
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const KPI_CONFIGS = [
      { id: 'widget-kpi-invoiced', label: 'Invoiced', color: '#0F172A' },
      { id: 'widget-kpi-matched', label: 'Reconciled', color: '#10B981' },
      { id: 'widget-kpi-open', label: 'Open balance', color: '#0F172A' },
      { id: 'widget-kpi-exceptions', label: 'Needs review', color: '#0070BA' },
    ];

    const decorateKpis = () => {
      const valueWidgets = container.querySelectorAll<HTMLElement>('.ag-studio-value-widget');
      if (!valueWidgets || valueWidgets.length === 0) return;

      const sorted = Array.from(valueWidgets).sort((a, b) => {
        const layoutA = a.closest<HTMLElement>('.ag-studio-layout-widget');
        const layoutB = b.closest<HTMLElement>('.ag-studio-layout-widget');
        return (layoutA?.offsetLeft ?? 0) - (layoutB?.offsetLeft ?? 0);
      });

      sorted.forEach((widget, idx) => {
        const cfg = KPI_CONFIGS[idx];
        if (!cfg) return;

        // Hide any parent widget header (e.g. from AG Studio layout) to ensure only ONE label
        const layoutWidget = widget.closest<HTMLElement>('.ag-studio-layout-widget');
        const headerEl = layoutWidget?.querySelector<HTMLElement>(
          '.ag-studio-layout-widget-header, .ag-studio-widget-header, [class*="layout-widget-header"]'
        );
        if (headerEl) {
          headerEl.style.display = 'none';
        }

        widget.setAttribute('data-kpi-id', cfg.id);

        let labelEl = widget.querySelector<HTMLElement>('.settlesight-kpi-label');
        if (!labelEl) {
          labelEl = document.createElement('div');
          labelEl.className = 'settlesight-kpi-label';
          labelEl.style.cssText =
            'font-size: 11px; font-weight: 600; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px; line-height: 1; user-select: none; font-family: system-ui, -apple-system, sans-serif;';
          widget.prepend(labelEl);
        }
        if (labelEl.textContent !== cfg.label) {
          labelEl.textContent = cfg.label;
        }

        const contentEl = widget.querySelector<HTMLElement>('.ag-studio-value-widget-content');
        if (contentEl) {
          contentEl.style.color = cfg.color;
          contentEl.style.fontVariantNumeric = 'tabular-nums';
        }
      });
    };

    decorateKpis();
    const observer = new MutationObserver(decorateKpis);
    observer.observe(container, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [sources, resetKey]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#F8FAFC',
      }}
    >
      <style>{`
        .ag-studio-layout-widget:has(.ag-studio-value-widget) .ag-studio-layout-widget-header,
        .ag-studio-layout-widget:has(.ag-studio-value-widget) .ag-studio-widget-header,
        .ag-studio-layout-widget:has(.ag-studio-value-widget) [class*="layout-widget-header"] {
          display: none !important;
          height: 0 !important;
          max-height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          overflow: hidden !important;
        }
        .ag-studio-value-widget {
          display: flex !important;
          flex-direction: column !important;
          justify-content: center !important;
          align-items: flex-start !important;
          padding: 16px 20px !important;
          box-sizing: border-box !important;
          height: 100% !important;
          width: 100% !important;
          overflow: visible !important;
        }
        .ag-studio-value-widget-content-container {
          width: auto !important;
          height: auto !important;
          position: static !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
        }
        .ag-studio-value-widget-content {
          position: static !important;
          font-size: 24px !important;
          font-weight: 700 !important;
          line-height: 1.3 !important;
          font-variant-numeric: tabular-nums !important;
          font-family: system-ui, -apple-system, sans-serif !important;
          margin: 0 !important;
          padding: 0 !important;
          overflow: visible !important;
        }
      `}</style>
      <AgStudio
        key={`studio-${resetKey}`}
        data={sources}
        theme={paypalTheme}
        widgets={customWidgets}
        initialState={initialState}
        mode={mode}
        panels={{
          view: {
            left: [],
            right: [], // Removes unused 210px "No filters available" panel in view mode
          },
        }}
        onApiReady={handleApiReady}
        onStateUpdated={handleStateUpdated}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default StudioDashboard;

