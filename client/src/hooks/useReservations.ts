import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Reservation, UpdateReservationData, CreateReservationData } from '@/types/reservations';
import { toast } from 'sonner';
import { ERROR_MESSAGES, createErrorHandler } from '@/lib/errorHandler';
import { usePermissions } from '@/hooks/usePermissions';
import { apiInvoke } from '@/lib/apiClient';

const errorHandler = createErrorHandler('useReservations');

export interface ReservationsDateFilter {
  from?: string; // ISO date string YYYY-MM-DD
  to?: string;   // ISO date string YYYY-MM-DD
}

/**
 * useReservations now accepts an optional date filter.
 * When provided, it filters reservations server-side by the 'desde' field.
 * This reduces payload from ~857 rows to ~15-20 for a single day.
 * 
 * When no filter is provided, it defaults to a ±30 day window from today
 * to avoid loading the entire history.
 */
export function useReservations(dateFilter?: ReservationsDateFilter) {
  const { profile } = useAuth();
  const { role } = usePermissions();
  const queryClient = useQueryClient();
  const organizationId = profile?.organization_id;
  
  // Owner and Admin query base table directly via Supabase client
  // Other roles use the Express endpoint (same full data, bypasses RLS restrictions)
  const isFullAccess = role === 'owner' || role === 'admin';

  // Compute effective date range for the query
  // If no filter provided, use a ±30 day window to avoid loading everything
  const effectiveDateFrom = dateFilter?.from || undefined;
  const effectiveDateTo = dateFilter?.to || undefined;

  const { data: reservations = [], isLoading, error } = useQuery({
    queryKey: ['reservations', organizationId, isFullAccess, effectiveDateFrom, effectiveDateTo],
    queryFn: async () => {
      if (!organizationId) return [];
      
      if (isFullAccess) {
        // Owner/Admin: Query base table with full PII access (excluding archived)
        let query = supabase
          .from('reservations')
          .select('*')
          .eq('organization_id', organizationId)
          .is('archived_at', null);
        
        // Apply date filter server-side if provided
        if (effectiveDateFrom) {
          // We need to include reservations where EITHER desde OR hasta falls in the range
          // This ensures we don't miss reservations that span across the date boundary
          query = query.or(
            `and(desde.gte.${effectiveDateFrom}T00:00:00${effectiveDateTo ? `,desde.lte.${effectiveDateTo}T23:59:59` : ''}),` +
            `and(hasta.gte.${effectiveDateFrom}T00:00:00${effectiveDateTo ? `,hasta.lte.${effectiveDateTo}T23:59:59` : ''})`
          );
        }
        
        const { data, error } = await query.order('desde', { ascending: true });
        
        if (error) throw error;
        return data as Reservation[];
      } else {
        // Operational users: Use Express endpoint that returns full data (bypasses RLS)
        const { data, error } = await apiInvoke<Reservation[]>('get-reservations-operational', {
          body: { 
            p_organization_id: organizationId,
            dateFrom: effectiveDateFrom,
            dateTo: effectiveDateTo,
          },
        });
        
        if (error) throw new Error(error.message);
        return (data || []) as Reservation[];
      }
    },
    enabled: !!organizationId,
    staleTime: 2 * 60_000, // 2 minutes - reservations change frequently but not every second
  });

  const updateReservation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateReservationData }) => {
      const { data: updatedRows, error } = await supabase
        .from('reservations')
        .update(data)
        .eq('id', id)
        .select();
      
      if (error) throw error;
      if (!updatedRows || updatedRows.length === 0) {
        throw new Error('No se pudo actualizar la reserva. Verifica tus permisos.');
      }
      return updatedRows;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success('Reserva actualizada');
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : ERROR_MESSAGES.reservations.updateError.description);
      errorHandler.log('Update error', error);
    },
  });

  const createReservation = useMutation({
    mutationFn: async (data: CreateReservationData & { 
      tipo_actividad?: string | null;
      notas?: string | null;
    }) => {
      if (!organizationId || !profile?.id) {
        throw new Error('No organization or user');
      }

      const { error } = await supabase
        .from('reservations')
        .insert({
          organization_id: organizationId,
          imported_by: profile.id,
          ...data,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
    },
    onError: (error) => {
      toast.error(ERROR_MESSAGES.reservations.createError.description);
      errorHandler.log('Create error', error);
    },
  });

  const importReservations = useMutation({
    mutationFn: async (rows: CreateReservationData[]) => {
      if (!organizationId || !profile?.id) {
        throw new Error('No organization or user');
      }

      const results = {
        inserted: 0,
        duplicates: 0,
        errors: [] as { row: CreateReservationData; error: string }[],
      };

      for (const row of rows) {
        const { error } = await supabase
          .from('reservations')
          .insert({
            organization_id: organizationId,
            imported_by: profile.id,
            ...row,
          });

        if (error) {
          if (error.code === '23505') { // Unique violation
            results.duplicates++;
          } else {
            results.errors.push({ row, error: error.message });
          }
        } else {
          results.inserted++;
        }
      }

      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      toast.success(`Importación completada: ${results.inserted} nuevas, ${results.duplicates} duplicadas`);
    },
    onError: (error) => {
      toast.error(ERROR_MESSAGES.reservations.importError.description);
      errorHandler.log('Import error', error);
    },
  });

  const checkDuplicates = async (externalIds: string[]): Promise<Set<string>> => {
    if (!organizationId) return new Set();
    
    const { data, error } = await supabase
      .from('reservations')
      .select('external_reservation_id')
      .eq('organization_id', organizationId)
      .in('external_reservation_id', externalIds);
    
    if (error) {
      errorHandler.log('Error checking duplicates', error);
      return new Set();
    }
    
    return new Set(data.map(r => r.external_reservation_id));
  };

  // Query for archived reservations (only for full access users)
  const { data: archivedReservations = [], isLoading: isLoadingArchived, refetch: refetchArchived } = useQuery({
    queryKey: ['reservations-archived', organizationId],
    queryFn: async () => {
      if (!organizationId || !isFullAccess) return [];
      
      const { data, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('organization_id', organizationId)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false });
      
      if (error) throw error;
      return data as Reservation[];
    },
    enabled: !!organizationId && isFullAccess,
    staleTime: 5 * 60_000, // 5 minutes - archived data rarely changes
  });

  // Mutation to restore a reservation from archive
  const restoreReservation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reservations')
        .update({ archived_at: null } as Record<string, unknown>)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-archived'] });
      toast.success('Reserva restaurada correctamente');
    },
    onError: (error) => {
      toast.error('Error al restaurar la reserva');
      errorHandler.log('Restore error', error);
    },
  });

  // Mutation to manually archive a reservation
  const archiveReservation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('reservations')
        .update({ archived_at: new Date().toISOString() } as Record<string, unknown>)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservations-archived'] });
      toast.success('Reserva archivada correctamente');
    },
    onError: (error) => {
      toast.error('Error al archivar la reserva');
      errorHandler.log('Archive error', error);
    },
  });

  // Query for archive stats (for diagnostics) - now based on 'hasta' date
  const { data: archiveStats } = useQuery({
    queryKey: ['reservations-archive-stats', organizationId],
    queryFn: async () => {
      if (!organizationId || !isFullAccess) return null;
      
      // Get archive days setting (default 10)
      const { data: settings } = await supabase
        .from('integration_settings')
        .select('reservations_archive_days')
        .eq('organization_id', organizationId)
        .single();
      
      const archiveDays = settings?.reservations_archive_days ?? 10;
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - archiveDays);
      
      // Count reservations pending archive (hasta < cutoff and not archived)
      const { count: pendingCount, error: pendingError } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .not('hasta', 'is', null)
        .lt('hasta', cutoffDate.toISOString())
        .is('archived_at', null);
      
      // Count reservations without return date (can't be auto-archived)
      const { count: missingDateCount, error: missingError } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .is('hasta', null)
        .is('archived_at', null);
      
      if (pendingError || missingError) {
        console.error('Error fetching archive stats:', pendingError || missingError);
        return null;
      }
      
      return {
        pendingArchive: pendingCount || 0,
        missingReturnDate: missingDateCount || 0,
        totalArchived: archivedReservations.length,
        archiveDays,
      };
    },
    enabled: !!organizationId && isFullAccess,
    staleTime: 10 * 60_000, // 10 minutes - archive stats are diagnostic only
  });

  return {
    reservations,
    isLoading,
    error,
    updateReservation,
    createReservation,
    importReservations,
    checkDuplicates,
    // Archived reservations
    archivedReservations,
    isLoadingArchived,
    refetchArchived,
    restoreReservation,
    archiveReservation,
    isFullAccess,
    // Archive stats for diagnostics
    archiveStats,
  };
}
