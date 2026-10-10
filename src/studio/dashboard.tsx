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

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: '#F8FAFC',
      }}
    >
      <AgStudio
        key={`studio-${resetKey}`}
        data={sources}
        theme={paypalTheme}
        widgets={customWidgets}
        initialState={initialState}
        mode={mode}
        onApiReady={handleApiReady}
        onStateUpdated={handleStateUpdated}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
};

export default StudioDashboard;
