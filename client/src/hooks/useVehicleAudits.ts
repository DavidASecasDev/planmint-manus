import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { compressImage } from '@/lib/imageCompression';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';
import {
  VehicleQualityAudit,
  VehicleAuditPhoto,
  ChecklistResult,
  AUDIT_CHECKLIST,
  calculateAuditScore,
  isChecklistComplete,
  hasDefects,
} from '@/types/audits';

const AUDIT_PHOTOS_BUCKET = 'audit-photos';

export function useVehicleAudits(vehicleId?: string) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;
  const queryClient = useQueryClient();

  // ── Fetch latest audit for a specific vehicle ──
  const latestAuditQuery = useQuery({
    queryKey: ['vehicle-audit-latest', vehicleId, orgId],
    queryFn: async () => {
      if (!orgId || !vehicleId) return null;

      const { data, error } = await (supabase as any)
        .from('vehicle_quality_audits')
        .select('*, auditor_profile:profiles!vehicle_quality_audits_auditor_id_fkey(name)')
        .eq('organization_id', orgId)
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as VehicleQualityAudit | null;
    },
    enabled: !!orgId && !!vehicleId,
  });

  // ── Fetch audit history for a specific vehicle ──
  const auditHistoryQuery = useQuery({
    queryKey: ['vehicle-audit-history', vehicleId, orgId],
    queryFn: async () => {
      if (!orgId || !vehicleId) return [];

      const { data, error } = await (supabase as any)
        .from('vehicle_quality_audits')
        .select('*, auditor_profile:profiles!vehicle_quality_audits_auditor_id_fkey(name)')
        .eq('organization_id', orgId)
        .eq('vehicle_id', vehicleId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return (data || []) as VehicleQualityAudit[];
    },
    enabled: !!orgId && !!vehicleId,
  });

  // ── Fetch all pending audits (vehicles limpio without approved audit) ──
  const pendingAuditsCountQuery = useQuery({
    queryKey: ['vehicle-audits-pending-count', orgId],
    queryFn: async () => {
      if (!orgId) return 0;

      // Get vehicles in 'limpio' status
      const { data: cleanVehicles, error: vError } = await supabase
        .from('vehicles')
        .select('id')
        .eq('organization_id', orgId)
        .eq('status', 'limpio')
        .eq('is_archived', false);

      if (vError) throw vError;
      if (!cleanVehicles || cleanVehicles.length === 0) return 0;

      const vehicleIds = cleanVehicles.map(v => v.id);

      // Get the latest audit for each of these vehicles
      const { data: audits, error: aError } = await (supabase as any)
        .from('vehicle_quality_audits')
        .select('vehicle_id, status, created_at')
        .eq('organization_id', orgId)
        .in('vehicle_id', vehicleIds)
        .order('created_at', { ascending: false });

      if (aError) throw aError;

      // Find vehicles whose latest audit is NOT 'approved'
      const latestAuditByVehicle = new Map<string, string>();
      for (const audit of (audits || [])) {
        if (!latestAuditByVehicle.has(audit.vehicle_id)) {
          latestAuditByVehicle.set(audit.vehicle_id, audit.status);
        }
      }

      // Count vehicles without approved audit
      let pendingCount = 0;
      for (const vId of vehicleIds) {
        const latestStatus = latestAuditByVehicle.get(vId);
        if (!latestStatus || latestStatus !== 'approved') {
          pendingCount++;
        }
      }

      return pendingCount;
    },
    enabled: !!orgId,
  });

  // ── Create a new audit ──
  const createAuditMutation = useMutation({
    mutationFn: async ({ vehicleId: vId }: { vehicleId: string }) => {
      if (!orgId || !profile?.id) throw new Error('No autenticado');

      // Initialize checklist with all items as not_checked
      const initialResults: Record<string, ChecklistResult> = {};
      for (const item of AUDIT_CHECKLIST) {
        initialResults[item.key] = { key: item.key, result: 'not_checked' };
      }

      const { data, error } = await (supabase as any)
        .from('vehicle_quality_audits')
        .insert({
          organization_id: orgId,
          vehicle_id: vId,
          auditor_id: profile.id,
          status: 'in_progress',
          checklist_results: initialResults,
          overall_score: 0,
        })
        .select('*, auditor_profile:profiles!vehicle_quality_audits_auditor_id_fkey(name)')
        .single();

      if (error) throw error;
      return data as VehicleQualityAudit;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-audit-latest', data.vehicle_id] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-audit-history', data.vehicle_id] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-audits-pending-count'] });
      toast({ title: 'Auditoría iniciada', description: 'Completa el checklist de calidad.' });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo crear la auditoría.', variant: 'destructive' });
    },
  });

  // ── Update checklist item ──
  const updateChecklistItemMutation = useMutation({
    mutationFn: async ({
      auditId,
      checklistResults,
    }: {
      auditId: string;
      checklistResults: Record<string, ChecklistResult>;
    }) => {
      const score = calculateAuditScore(checklistResults);

      const { data, error } = await (supabase as any)
        .from('vehicle_quality_audits')
        .update({
          checklist_results: checklistResults,
          overall_score: score,
        })
        .eq('id', auditId)
        .select('*, auditor_profile:profiles!vehicle_quality_audits_auditor_id_fkey(name)')
        .single();

      if (error) throw error;
      return data as VehicleQualityAudit;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-audit-latest', data.vehicle_id] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-audit-history', data.vehicle_id] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo actualizar el checklist.', variant: 'destructive' });
    },
  });

  // ── Fetch photos for an audit ──
  const auditPhotosQuery = useQuery({
    queryKey: ['vehicle-audit-photos', latestAuditQuery.data?.id, orgId],
    queryFn: async () => {
      const auditId = latestAuditQuery.data?.id;
      if (!orgId || !auditId) return [];

      const { data, error } = await (supabase as any)
        .from('vehicle_audit_photos')
        .select('*')
        .eq('organization_id', orgId)
        .eq('audit_id', auditId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []) as VehicleAuditPhoto[];
    },
    enabled: !!orgId && !!latestAuditQuery.data?.id,
  });

  // ── Upload a photo for an audit ──
  const uploadPhotoMutation = useMutation({
    mutationFn: async ({
      auditId,
      file,
      checklistItemKey,
      caption,
    }: {
      auditId: string;
      file: File;
      checklistItemKey: string | null;
      caption?: string;
    }) => {
      if (!orgId || !vehicleId) throw new Error('No autenticado');

      // Compress image before upload
      const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
      const uploadFile = compressed.file;

      // Upload to Supabase Storage
      const ext = uploadFile.name.split('.').pop() || 'jpg';
      const path = `${orgId}/${vehicleId}/${auditId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from(AUDIT_PHOTOS_BUCKET)
        .upload(path, uploadFile, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from(AUDIT_PHOTOS_BUCKET)
        .getPublicUrl(path);

      // Insert record in vehicle_audit_photos table
      const { data, error } = await (supabase as any)
        .from('vehicle_audit_photos')
        .insert({
          audit_id: auditId,
          organization_id: orgId,
          photo_url: urlData.publicUrl,
          checklist_item_key: checklistItemKey,
          caption: caption || null,
        })
        .select('*')
        .single();

      if (error) throw error;
      return data as VehicleAuditPhoto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-audit-photos'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo subir la foto.', variant: 'destructive' });
    },
  });

  // ── Delete a photo ──
  const deletePhotoMutation = useMutation({
    mutationFn: async ({ photoId, photoUrl }: { photoId: string; photoUrl: string }) => {
      // Extract storage path from URL
      const bucketPath = photoUrl.split(`/storage/v1/object/public/${AUDIT_PHOTOS_BUCKET}/`)[1];

      // Delete from storage
      if (bucketPath) {
        await supabase.storage.from(AUDIT_PHOTOS_BUCKET).remove([bucketPath]);
      }

      // Delete from database
      const { error } = await (supabase as any)
        .from('vehicle_audit_photos')
        .delete()
        .eq('id', photoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-audit-photos'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo eliminar la foto.', variant: 'destructive' });
    },
  });

  // ── Update photo caption ──
  const updatePhotoCaptionMutation = useMutation({
    mutationFn: async ({ photoId, caption }: { photoId: string; caption: string }) => {
      const { data, error } = await (supabase as any)
        .from('vehicle_audit_photos')
        .update({ caption: caption || null })
        .eq('id', photoId)
        .select('*')
        .single();

      if (error) throw error;
      return data as VehicleAuditPhoto;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-audit-photos'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo actualizar la descripción.', variant: 'destructive' });
    },
  });

  // ── Complete audit (approve or reject) ──
  const completeAuditMutation = useMutation({
    mutationFn: async ({
      auditId,
      status,
      rejectionReason,
      notes,
      checklistResults,
    }: {
      auditId: string;
      status: 'approved' | 'rejected';
      rejectionReason?: string;
      notes?: string;
      checklistResults: Record<string, ChecklistResult>;
    }) => {
      const score = calculateAuditScore(checklistResults);

      const { data, error } = await (supabase as any)
        .from('vehicle_quality_audits')
        .update({
          status,
          rejection_reason: rejectionReason || null,
          notes: notes || null,
          checklist_results: checklistResults,
          overall_score: score,
          completed_at: new Date().toISOString(),
        })
        .eq('id', auditId)
        .select('*, auditor_profile:profiles!vehicle_quality_audits_auditor_id_fkey(name)')
        .single();

      if (error) throw error;

      // If rejected, move vehicle back to 'sucio'
      if (status === 'rejected') {
        const { error: vError } = await supabase
          .from('vehicles')
          .update({
            status: 'sucio' as any,
            last_status_change: new Date().toISOString(),
          })
          .eq('id', data.vehicle_id);

        if (vError) throw vError;
      }

      return data as VehicleQualityAudit;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-audit-latest', data.vehicle_id] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-audit-history', data.vehicle_id] });
      queryClient.invalidateQueries({ queryKey: ['vehicle-audits-pending-count'] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });

      if (data.status === 'approved') {
        toast({
          title: 'Auditoría aprobada',
          description: `Puntuación: ${data.overall_score}%. Vehículo listo para alquilar.`,
        });
      } else {
        toast({
          title: 'Auditoría rechazada',
          description: 'El vehículo ha vuelto a estado Sucio para re-preparación.',
          variant: 'destructive',
        });
      }
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo completar la auditoría.', variant: 'destructive' });
    },
  });

  return {
    // Data
    latestAudit: latestAuditQuery.data,
    isLoadingLatestAudit: latestAuditQuery.isLoading,
    auditHistory: auditHistoryQuery.data || [],
    isLoadingHistory: auditHistoryQuery.isLoading,
    pendingAuditsCount: pendingAuditsCountQuery.data || 0,
    auditPhotos: auditPhotosQuery.data || [],
    isLoadingPhotos: auditPhotosQuery.isLoading,

    // Mutations
    createAudit: createAuditMutation.mutate,
    isCreatingAudit: createAuditMutation.isPending,
    updateChecklistItem: updateChecklistItemMutation.mutate,
    isUpdatingChecklist: updateChecklistItemMutation.isPending,
    completeAudit: completeAuditMutation.mutate,
    isCompletingAudit: completeAuditMutation.isPending,
    uploadPhoto: uploadPhotoMutation.mutateAsync,
    isUploadingPhoto: uploadPhotoMutation.isPending,
    deletePhoto: deletePhotoMutation.mutate,
    isDeletingPhoto: deletePhotoMutation.isPending,
    updatePhotoCaption: updatePhotoCaptionMutation.mutateAsync,
    isUpdatingCaption: updatePhotoCaptionMutation.isPending,

    // Helpers
    calculateAuditScore,
    isChecklistComplete,
    hasDefects,
  };
}

// ── Hook for batch audit status for multiple vehicles (Kanban optimization) ──
export function useVehicleAuditStatuses() {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['vehicle-audit-statuses', orgId],
    queryFn: async () => {
      if (!orgId) return new Map<string, { status: string; score: number | null }>();

      // Get the latest audit for each vehicle in the org
      const { data, error } = await (supabase as any)
        .from('vehicle_quality_audits')
        .select('vehicle_id, status, overall_score, created_at')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Build a map of vehicle_id -> latest audit status
      const statusMap = new Map<string, { status: string; score: number | null }>();
      for (const audit of (data || [])) {
        if (!statusMap.has(audit.vehicle_id)) {
          statusMap.set(audit.vehicle_id, {
            status: audit.status,
            score: audit.overall_score,
          });
        }
      }

      return statusMap;
    },
    enabled: !!orgId,
    staleTime: 30_000, // Cache for 30s to avoid excessive queries on Kanban
  });
}
