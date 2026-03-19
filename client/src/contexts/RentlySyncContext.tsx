import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useIntegrationSettings } from '@/hooks/useIntegrationSettings';
import { useIntegrationFlags } from '@/hooks/useIntegrationFlags';
import type { RentlySyncPageResponse, RentlySyncResult, RentlySyncStatus } from '@/types/rently';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface SyncProgress {
  page: number;
  totalFetched: number;
  totalInserted: number;
  totalDuplicates: number;
  isRunning: boolean;
  startTime: number | null;
}

export interface RentlySyncContextValue {
  syncing: boolean;
  testing: boolean;
  lastResult: RentlySyncResult | null;
  isConfigured: boolean;
  settingsLoading: boolean;
  progress: SyncProgress;
  syncRently: (reset?: boolean) => Promise<RentlySyncResult>;
  pauseSync: () => void;
  cancelSync: () => void;
  resumeSync: () => Promise<RentlySyncResult>;
  testConnection: () => Promise<{ success: boolean; error?: string }>;
  getSyncStatus: () => Promise<RentlySyncStatus | null>;
  getElapsedTime: () => number;
  rentlyHost: string;
  syncStartTime: number | null;
  // Dialog control for the floating indicator
  syncDialogOpen: boolean;
  setSyncDialogOpen: (open: boolean) => void;
}

const RentlySyncContext = createContext<RentlySyncContextValue | null>(null);

export function RentlySyncProvider({ children }: { children: ReactNode }) {
  const { settings, loading: settingsLoading } = useIntegrationSettings();
  const { hasRently, loading: flagsLoading } = useIntegrationFlags();

  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [lastResult, setLastResult] = useState<RentlySyncResult | null>(null);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [progress, setProgress] = useState<SyncProgress>({
    page: 0,
    totalFetched: 0,
    totalInserted: 0,
    totalDuplicates: 0,
    isRunning: false,
    startTime: null,
  });

  const pauseRequestedRef = useRef(false);
  const cancelRequestedRef = useRef(false);

  const isConfigured = settings
    ? !!(settings.rently_client_id && settings.rently_client_secret)
    : hasRently;

  const getSyncStatus = useCallback(async (): Promise<RentlySyncStatus | null> => {
    const { data } = await supabase
      .from('rently_sync_status')
      .select('*')
      .single();
    return data as RentlySyncStatus | null;
  }, []);

  const syncRently = useCallback(async (reset?: boolean): Promise<RentlySyncResult> => {
    setSyncing(true);
    pauseRequestedRef.current = false;
    cancelRequestedRef.current = false;

    const startTime = Date.now();
    setProgress({
      page: 0, totalFetched: 0, totalInserted: 0, totalDuplicates: 0,
      isRunning: true, startTime,
    });

    let hasMore = true;
    let totalInserted = 0, totalDuplicates = 0, totalFiltered = 0, totalFetched = 0, pageCount = 0, archived = 0;
    let dateRange: { oldest: string; newest: string } | null = null;
    const errors: Array<{ id: string; error: string }> = [];

    try {
      let isFirstCall = true;
      while (hasMore) {
        if (pauseRequestedRef.current) { console.log('Sync paused'); break; }
        if (cancelRequestedRef.current) { console.log('Sync cancelled'); break; }

        const { data, error } = await supabase.functions.invoke('sync-rently', {
          body: { continue_sync: !isFirstCall, reset: isFirstCall && reset },
        });
        isFirstCall = false;

        if (error) { errors.push({ id: 'function', error: error.message }); break; }

        const result = data as RentlySyncPageResponse;
        if (!result.success) { errors.push({ id: 'sync', error: result.error || 'Unknown error' }); break; }

        pageCount = result.page;
        hasMore = result.hasMore;
        totalFetched = result.progress.totalFetched;
        totalInserted = result.progress.totalInserted;
        totalDuplicates = result.progress.totalDuplicates;
        totalFiltered += result.progress.filtered;
        if (result.archived) archived = result.archived;
        if (result.date_range_in_data) dateRange = result.date_range_in_data;

        setProgress({
          page: pageCount, totalFetched, totalInserted, totalDuplicates,
          isRunning: hasMore, startTime,
        });

        if (hasMore) await sleep(300);
      }

      const finalResult: RentlySyncResult = {
        success: errors.length === 0, inserted: totalInserted, duplicates: totalDuplicates,
        filtered: totalFiltered, archived, errors, total_fetched: totalFetched,
        date_range_in_data: dateRange,
      };
      setLastResult(finalResult);
      return finalResult;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      const result: RentlySyncResult = {
        success: false, inserted: totalInserted, duplicates: totalDuplicates,
        filtered: totalFiltered, errors: [{ id: 'exception', error: errorMessage }],
        total_fetched: totalFetched,
      };
      setLastResult(result);
      return result;
    } finally {
      setProgress(prev => ({ ...prev, isRunning: false }));
      setSyncing(false);
    }
  }, []);

  const pauseSync = useCallback(() => { pauseRequestedRef.current = true; }, []);
  const cancelSync = useCallback(() => { cancelRequestedRef.current = true; }, []);
  const resumeSync = useCallback(async () => syncRently(false), [syncRently]);

  const testConnection = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-rently', {
        body: { test_only: true },
      });
      if (error) return { success: false, error: error.message };
      if (data?.error) return { success: false, error: data.error };
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Error desconocido' };
    } finally {
      setTesting(false);
    }
  }, []);

  const getElapsedTime = useCallback(() => {
    if (!progress.startTime) return 0;
    return Math.floor((Date.now() - progress.startTime) / 1000);
  }, [progress.startTime]);

  const value: RentlySyncContextValue = {
    syncing, testing, lastResult, isConfigured,
    settingsLoading: settingsLoading || flagsLoading,
    progress, syncRently, pauseSync, cancelSync, resumeSync,
    testConnection, getSyncStatus, getElapsedTime,
    rentlyHost: settings?.rently_api_host || 'azul.rently.com.ar',
    syncStartTime: progress.startTime,
    syncDialogOpen, setSyncDialogOpen,
  };

  return (
    <RentlySyncContext.Provider value={value}>
      {children}
    </RentlySyncContext.Provider>
  );
}

export function useRentlySyncContext() {
  const ctx = useContext(RentlySyncContext);
  if (!ctx) throw new Error('useRentlySyncContext must be used within RentlySyncProvider');
  return ctx;
}

export function useRentlySyncContextSafe() {
  return useContext(RentlySyncContext);
}
