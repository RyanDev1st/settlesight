/**
 * SettleSight — Reconciliation React Context
 *
 * Provides shared state between the AG Studio Dashboard, Reconciliation Meter,
 * Exceptions Queue, and Reconciliation Agent Panel.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { AgDataSourcesDefinition } from 'ag-studio';
import {
  loadReconciliationData,
  buildStudioSources,
  validateAllocation,
  applyDecision,
  summarize,
} from './data';

export interface ReconciliationContextValue {
  mode: 'demo' | 'live';
  hasLlm: boolean;
  engineState: {
    invoices: any[];
    transactions: any[];
    matches: any[];
    exceptions: any[];
  };
  summary: ReturnType<typeof summarize>;
  sources: AgDataSourcesDefinition;
  loading: boolean;
  error: string | null;
  approveCandidate: (matchId: string) => { success: boolean; error?: string };
  rejectCandidate: (matchId: string) => { success: boolean; error?: string };
  reload: () => Promise<void>;
}

const ReconciliationContext = createContext<ReconciliationContextValue | null>(null);

export const ReconciliationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<'demo' | 'live'>('demo');
  const [hasLlm, setHasLlm] = useState<boolean>(false);
  const [engineState, setEngineState] = useState<any>({
    invoices: [],
    transactions: [],
    matches: [],
    exceptions: [],
  });
  const [summary, setSummary] = useState<any>(null);
  const [sources, setSources] = useState<AgDataSourcesDefinition>(() =>
    buildStudioSources({ invoices: [], transactions: [], matches: [], exceptions: [] }, null)
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await loadReconciliationData();
      setMode(res.mode);
      setHasLlm(res.hasLlm);
      setEngineState(res.state);
      setSummary(res.summary);
      setSources(res.sources);
    } catch (err: any) {
      setError(err.message || 'Failed to initialize reconciliation data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const approveCandidate = useCallback(
    (matchId: string): { success: boolean; error?: string } => {
      const match = (engineState.matches || []).find((m: any) => m.id === matchId);
      if (!match) {
        return { success: false, error: `Match ${matchId} not found` };
      }

      // Check allocation validation invariant
      const check = validateAllocation(match, engineState);
      if (!check.valid) {
        return { success: false, error: check.error || 'Allocation invariant failed' };
      }

      try {
        const nextState = applyDecision(engineState, matchId, 'approve');
        const clonedState = {
          invoices: [...nextState.invoices],
          transactions: [...nextState.transactions],
          matches: [...nextState.matches],
          exceptions: [...nextState.exceptions],
        };
        const nextSummary = summarize(clonedState);
        const nextSources = buildStudioSources(clonedState, nextSummary);

        setEngineState(clonedState);
        setSummary(nextSummary);
        setSources(nextSources);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
    [engineState]
  );

  const rejectCandidate = useCallback(
    (matchId: string): { success: boolean; error?: string } => {
      try {
        const nextState = applyDecision(engineState, matchId, 'reject');
        const clonedState = {
          invoices: [...nextState.invoices],
          transactions: [...nextState.transactions],
          matches: [...nextState.matches],
          exceptions: [...nextState.exceptions],
        };
        const nextSummary = summarize(clonedState);
        const nextSources = buildStudioSources(clonedState, nextSummary);

        setEngineState(clonedState);
        setSummary(nextSummary);
        setSources(nextSources);
        return { success: true };
      } catch (err: any) {
        return { success: false, error: err.message };
      }
    },
    [engineState]
  );

  const value = useMemo<ReconciliationContextValue>(
    () => ({
      mode,
      hasLlm,
      engineState,
      summary: summary || summarize(engineState),
      sources,
      loading,
      error,
      approveCandidate,
      rejectCandidate,
      reload,
    }),
    [mode, hasLlm, engineState, summary, sources, loading, error, approveCandidate, rejectCandidate, reload]
  );

  return <ReconciliationContext.Provider value={value}>{children}</ReconciliationContext.Provider>;
};

export function useReconciliation(): ReconciliationContextValue {
  const ctx = useContext(ReconciliationContext);
  if (!ctx) {
    throw new Error('useReconciliation must be used within a ReconciliationProvider');
  }
  return ctx;
}
