import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiClient';
import { useIntegrationSettings } from '@/hooks/useIntegrationSettings';
import { useIntegrationFlags } from '@/hooks/useIntegrationFlags';
import { useVehiclePrepAlerts } from '@/hooks/useVehiclePrepAlerts';
import { useStaleTransferAlerts } from '@/hooks/useStaleTransferAlerts';
import { toast } from 'sonner';
import type { RentlySyncPageResponse, RentlySyncResult, RentlySyncStatus } from '@/types/rently';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const AUTO_SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

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
  // Auto-sync state
  autoSyncEnabled: boolean;
  setAutoSyncEnabled: (enabled: boolean) => void;
  lastAutoSyncAt: Date | null;
  nextAutoSyncAt: Date | null;
  autoSyncCountdown: number; // seconds until next auto-sync
}

const RentlySyncContext = createContext<RentlySyncContextValue | null>(null);

export function RentlySyncProvider({ children }: { children: ReactNode }) {
  const { settings, loading: settingsLoading } = useIntegrationSettings();
  const { hasRently, loading: flagsLoading } = useIntegrationFlags();
  const { checkAndAlert: checkAndAlertVehiclePrep } = useVehiclePrepAlerts();
  const { checkAndAlert: checkAndAlertStaleTransfers } = useStaleTransferAlerts();

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

  // Auto-sync state
  const [autoSyncEnabled, setAutoSyncEnabledState] = useState<boolean>(() => {
    const stored = localStorage.getItem('planmint_auto_sync_enabled');
    return stored !== null ? stored === 'true' : true; // enabled by default
  });
  const [lastAutoSyncAt, setLastAutoSyncAt] = useState<Date | null>(null);
  const [nextAutoSyncAt, setNextAutoSyncAt] = useState<Date | null>(null);
  const [autoSyncCountdown, setAutoSyncCountdown] = useState<number>(0);

  const pauseRequestedRef = useRef(false);
  const cancelRequestedRef = useRef(false);
  const autoSyncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncingRef = useRef(false);
  const nextAutoSyncAtRef = useRef<Date | null>(null);

  // isConfigured: for owner, check settings directly; for non-owner, use flags RPC
  // The key fix: don't require settings to be loaded for non-owner users
  const isConfigured = (() => {
    // If settings loaded (owner), use settings directly
    if (settings) {
      return !!(settings.rently_client_id && settings.rently_client_secret);
    }
    // If settings are still loading, don't block — check flags
    if (!settingsLoading && !flagsLoading) {
      return hasRently;
    }
    // If flags loaded but settings still loading (non-owner case), use flags
    if (!flagsLoading) {
      return hasRently;
    }
    return false;
  })();

  // Track whether initial loading is done (either settings or flags)
  const isReady = !flagsLoading || !settingsLoading;

  const setAutoSyncEnabled = useCallback((enabled: boolean) => {
    setAutoSyncEnabledState(enabled);
    localStorage.setItem('planmint_auto_sync_enabled', String(enabled));
  }, []);

  const getSyncStatus = useCallback(async (): Promise<RentlySyncStatus | null> => {
    const { data } = await supabase
      .from('rently_sync_status')
      .select('*')
      .single();
    return data as RentlySyncStatus | null;
  }, []);

  const syncVehiclesAfterReservations = useCallback(async () => {
    try {
      const { error } = await apiInvoke('sync-rently', {
        body: { action: 'sync_vehicles' },
      });
      if (error) {
        console.warn('[AutoSync] Vehicle sync failed:', error.message);
      } else {
        console.log('[AutoSync] Vehicle status synced from reservations');
      }
    } catch (err) {
      console.warn('[AutoSync] Vehicle sync error:', err);
    }
  }, []);

  // Reset the countdown timer to start fresh from now
  const resetCountdown = useCallback(() => {
    const next = new Date(Date.now() + AUTO_SYNC_INTERVAL_MS);
    setNextAutoSyncAt(next);
    nextAutoSyncAtRef.current = next;
    setAutoSyncCountdown(Math.floor(AUTO_SYNC_INTERVAL_MS / 1000));
  }, []);

  const syncRently = useCallback(async (reset?: boolean): Promise<RentlySyncResult> => {
    if (syncingRef.current) {
      return { success: false, inserted: 0, duplicates: 0, filtered: 0, errors: [{ id: 'busy', error: 'Sync already in progress' }], total_fetched: 0 };
    }

    setSyncing(true);
    syncingRef.current = true;
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
      // Proactively refresh session before syncing to avoid Invalid JWT errors.
      // We store the fresh access_token and pass it explicitly in the Authorization
      // header of every functions.invoke() call. This bypasses any caching/staleness
      // in the Supabase client's internal session state.
      let freshAccessToken: string | null = null;
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError || !refreshData.session) {
          console.warn('[Sync] Session refresh failed:', refreshError?.message || 'No session');
          toast.error('Sesión expirada. Por favor, inicia sesión de nuevo.');
          const result: RentlySyncResult = {
            success: false, inserted: 0, duplicates: 0, filtered: 0,
            errors: [{ id: 'auth', error: 'Sesión expirada' }], total_fetched: 0,
          };
          setLastResult(result);
          return result;
        }
        freshAccessToken = refreshData.session.access_token;
        console.log('[Sync] Session refreshed, token valid until:', new Date(refreshData.session.expires_at! * 1000).toISOString());
      } catch (authErr) {
        console.warn('[Sync] Auth check failed:', authErr);
      }

      // Build headers with fresh token if available
      const invokeHeaders: Record<string, string> = {};
      if (freshAccessToken) {
        invokeHeaders['Authorization'] = `Bearer ${freshAccessToken}`;
      }

      let isFirstCall = true;
      while (hasMore) {
        if (pauseRequestedRef.current) { console.log('Sync paused'); break; }
        if (cancelRequestedRef.current) { console.log('Sync cancelled'); break; }

        const { data, error } = await apiInvoke('sync-rently', {
          body: { continue_sync: !isFirstCall, reset: isFirstCall && reset },
        });
        isFirstCall = false;

        if (error) {
          // Check if it's an auth error
          const errMsg = error.message || '';
          if (errMsg.includes('Invalid JWT') || errMsg.includes('401') || errMsg.includes('Unauthorized')) {
            toast.error('Error de autenticación. Intenta recargar la página.');
          } else {
            toast.error(`Error de sincronización: ${errMsg}`);
          }
          errors.push({ id: 'function', error: error.message });
          break;
        }

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

      // Show success/error feedback
      if (finalResult.success) {
        if (totalInserted > 0) {
          toast.success(`Sync completado: ${totalInserted} nuevas, ${totalFetched} revisadas`);
        } else {
          toast.info(`Sync completado: ${totalFetched} reservas revisadas, sin cambios`);
        }
      } else if (errors.length > 0) {
        toast.error(`Sync falló: ${errors[0]?.error || 'Error desconocido'}`);
      }

      // After reservation sync, also sync vehicle statuses
      if (totalInserted > 0 || totalFetched > 0) {
        await syncVehiclesAfterReservations();
      }

      // Check for unprepared vehicles with imminent reservations and send alerts
      try {
        const alertsSent = await checkAndAlertVehiclePrep();
        if (alertsSent > 0) {
          console.log(`[AutoSync] Sent ${alertsSent} vehicle prep alert(s)`);
        }
      } catch (alertErr) {
        console.warn('[AutoSync] Vehicle prep alert check failed:', alertErr);
      }

      // Check for stale transfer requests (>48h pendiente) and send alerts
      try {
        const staleAlertsSent = await checkAndAlertStaleTransfers();
        if (staleAlertsSent > 0) {
          console.log(`[AutoSync] Sent ${staleAlertsSent} stale transfer alert(s)`);
        }
      } catch (staleErr) {
        console.warn('[AutoSync] Stale transfer alert check failed:', staleErr);
      }

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
      syncingRef.current = false;
      setLastAutoSyncAt(new Date());

      // Reset countdown after every sync (manual or auto) so the timer restarts
      if (autoSyncEnabled && isConfigured) {
        resetCountdown();
      }
    }
  }, [syncVehiclesAfterReservations, checkAndAlertVehiclePrep, checkAndAlertStaleTransfers, autoSyncEnabled, isConfigured, resetCountdown]);

  const pauseSync = useCallback(() => { pauseRequestedRef.current = true; }, []);
  const cancelSync = useCallback(() => { cancelRequestedRef.current = true; }, []);
  const resumeSync = useCallback(async () => syncRently(false), [syncRently]);

  const testConnection = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    setTesting(true);
    try {
      // Refresh session and pass fresh token explicitly
      const headers: Record<string, string> = {};
      try {
        const { data: refreshData } = await supabase.auth.refreshSession();
        if (refreshData.session?.access_token) {
          headers['Authorization'] = `Bearer ${refreshData.session.access_token}`;
        }
      } catch { /* use default token */ }

      const { data, error } = await apiInvoke<{ error?: string; success?: boolean }>('sync-rently', {
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

  // ─── Auto-sync timer logic ───
  useEffect(() => {
    // Clear existing timers
    if (autoSyncTimerRef.current) {
      clearInterval(autoSyncTimerRef.current);
      autoSyncTimerRef.current = null;
    }
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    if (!autoSyncEnabled || !isConfigured || !isReady) {
      setNextAutoSyncAt(null);
      nextAutoSyncAtRef.current = null;
      setAutoSyncCountdown(0);
      return;
    }

    // Set next sync time
    const nextSync = new Date(Date.now() + AUTO_SYNC_INTERVAL_MS);
    setNextAutoSyncAt(nextSync);
    nextAutoSyncAtRef.current = nextSync;
    setAutoSyncCountdown(Math.floor(AUTO_SYNC_INTERVAL_MS / 1000));

    // Countdown timer (updates every second) — uses ref for stable reads
    countdownTimerRef.current = setInterval(() => {
      const target = nextAutoSyncAtRef.current;
      if (!target) {
        setAutoSyncCountdown(0);
        return;
      }
      const remaining = Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000));
      setAutoSyncCountdown(remaining);
    }, 1000);

    // Auto-sync timer
    autoSyncTimerRef.current = setInterval(async () => {
      if (syncingRef.current) {
        console.log('[AutoSync] Skipping - sync already in progress');
        return;
      }

      console.log('[AutoSync] Starting automatic sync...');

      try {
        await syncRently(false);
        // resetCountdown is called in syncRently's finally block
      } catch (err) {
        console.error('[AutoSync] Error:', err);
      }
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      if (autoSyncTimerRef.current) clearInterval(autoSyncTimerRef.current);
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [autoSyncEnabled, isConfigured, isReady, syncRently]);

  const value: RentlySyncContextValue = {
    syncing, testing, lastResult, isConfigured,
    settingsLoading: settingsLoading || flagsLoading,
    progress, syncRently, pauseSync, cancelSync, resumeSync,
    testConnection, getSyncStatus, getElapsedTime,
    rentlyHost: settings?.rently_api_host || 'azul.rently.com.ar',
    syncStartTime: progress.startTime,
    syncDialogOpen, setSyncDialogOpen,
    autoSyncEnabled, setAutoSyncEnabled,
    lastAutoSyncAt, nextAutoSyncAt, autoSyncCountdown,
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
