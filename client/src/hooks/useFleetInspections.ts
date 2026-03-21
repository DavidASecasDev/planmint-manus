import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { compressImage } from '@/lib/imageCompression';
import type { FleetVehicleInspection, FleetInspectionDamage } from '@/types/fleet';

export function useFleetInspections(vehicleId: string | undefined) {
  const { profile } = useAuth();
  const orgId = profile?.organization_id;

  return useQuery({
    queryKey: ['fleet-inspections', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_vehicle_inspections')
        .select(`
          *,
          inspector_profile:profiles!fleet_vehicle_inspections_inspector_id_fkey(name),
          photos:fleet_inspection_photos(*),
          damages:fleet_inspection_damages(*)
        `)
        .eq('fleet_vehicle_id', vehicleId!)
        .eq('organization_id', orgId!)
        .order('inspection_date', { ascending: false });
      if (error) throw error;
      return data as unknown as FleetVehicleInspection[];
    },
    enabled: !!vehicleId && !!orgId,
  });
}

export function useFleetInspection(inspectionId: string | undefined) {
  return useQuery({
    queryKey: ['fleet-inspection', inspectionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fleet_vehicle_inspections')
        .select(`
          *,
          inspector_profile:profiles!fleet_vehicle_inspections_inspector_id_fkey(name),
          photos:fleet_inspection_photos(*),
          damages:fleet_inspection_damages(*)
        `)
        .eq('id', inspectionId!)
        .single();
      if (error) throw error;
      return data as unknown as FleetVehicleInspection;
    },
    enabled: !!inspectionId,
  });
}

export function useUpdateInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inspectionId,
      data,
    }: {
      inspectionId: string;
      data: {
        km?: number | null;
        nivel_combustible?: string | null;
        notas?: string | null;
        inspection_date?: string;
        inspection_type?: string;
        receipt_url?: string | null;
      };
    }) => {
      const { data: updated, error } = await supabase
        .from('fleet_vehicle_inspections')
        .update(data as any)
        .eq('id', inspectionId)
        .select()
        .single();
      if (error) throw error;
      return updated;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['fleet-inspection', data.id] });
      queryClient.invalidateQueries({ queryKey: ['fleet-inspections', data.fleet_vehicle_id] });
      toast.success('Inspección actualizada');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteInspection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ inspectionId, vehicleId }: { inspectionId: string; vehicleId: string }) => {
      await supabase.from('fleet_inspection_damages').delete().eq('inspection_id', inspectionId);
      await supabase.from('fleet_inspection_photos').delete().eq('inspection_id', inspectionId);
      const { error } = await supabase.from('fleet_vehicle_inspections').delete().eq('id', inspectionId);
      if (error) throw error;
      return { vehicleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fleet-inspections', data.vehicleId] });
      toast.success('Inspección eliminada');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCreateInspection() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  return useMutation({
    mutationFn: async ({
      inspection,
      damages,
      photoFiles,
    }: {
      inspection: {
        fleet_vehicle_id: string;
        inspection_type: string;
        inspection_date: string;
        km?: number;
        nivel_combustible?: string;
        notas?: string;
      };
      damages: (Omit<FleetInspectionDamage, 'id' | 'inspection_id' | 'organization_id'> & { photos?: File[] })[];
      photoFiles: { file: File; category: string; description?: string }[];
    }) => {
      const { data: insp, error: inspErr } = await supabase
        .from('fleet_vehicle_inspections')
        .insert({
          fleet_vehicle_id: inspection.fleet_vehicle_id,
          inspection_type: inspection.inspection_type,
          inspection_date: inspection.inspection_date,
          km: inspection.km || null,
          nivel_combustible: inspection.nivel_combustible || null,
          notas: inspection.notas || null,
          organization_id: orgId!,
          inspector_id: profile?.id || null,
        } as any)
        .select()
        .single();
      if (inspErr) throw inspErr;

      let insertedDamages: any[] = [];
      if (damages.length > 0) {
        const damageRows = damages.map(d => ({
          zona: d.zona,
          pieza: d.pieza || null,
          descripcion: d.descripcion || null,
          severidad: d.severidad || 'leve',
          inspection_id: insp.id,
          organization_id: orgId!,
        }));
        const { data: dmgData, error: dmgErr } = await supabase.from('fleet_inspection_damages').insert(damageRows as any).select();
        if (dmgErr) throw dmgErr;
        insertedDamages = dmgData || [];
      }

      // Upload damage-specific photos
      for (let i = 0; i < damages.length; i++) {
        const damagePhotos = damages[i].photos || [];
        const damageId = insertedDamages[i]?.id;
        if (!damageId || damagePhotos.length === 0) continue;
        for (const rawFile of damagePhotos) {
          const compressed = await compressImage(rawFile, { maxDimension: 1200, quality: 0.82 });
          const file = compressed.file;
          const path = `${orgId}/fleet/${inspection.fleet_vehicle_id}/${inspection.inspection_type}/${Date.now()}_${file.name}`;
          const { error: upErr } = await supabase.storage.from('repair-files').upload(path, file);
          if (upErr) throw upErr;
          const { error: photoErr } = await supabase.from('fleet_inspection_photos').insert({
            inspection_id: insp.id,
            organization_id: orgId!,
            storage_path: path,
            file_name: file.name,
            photo_category: 'dano_detalle',
            description: null,
            uploaded_by: profile?.id || null,
            damage_id: damageId,
          } as any);
          if (photoErr) throw photoErr;
        }
      }

      for (const pf of photoFiles) {
        const compressedPf = await compressImage(pf.file, { maxDimension: 1200, quality: 0.82 });
        const pfFile = compressedPf.file;
        const path = `${orgId}/fleet/${inspection.fleet_vehicle_id}/${inspection.inspection_type}/${Date.now()}_${pfFile.name}`;
        const { error: upErr } = await supabase.storage.from('repair-files').upload(path, pfFile);
        if (upErr) throw upErr;

        const { error: photoErr } = await supabase.from('fleet_inspection_photos').insert({
          inspection_id: insp.id,
          organization_id: orgId!,
          storage_path: path,
          file_name: pf.file.name,
          photo_category: pf.category,
          description: pf.description || null,
          uploaded_by: profile?.id || null,
        } as any);
        if (photoErr) throw photoErr;
      }

      return insp;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['fleet-inspections', data.fleet_vehicle_id] });
      queryClient.invalidateQueries({ queryKey: ['fleet-vehicle', data.fleet_vehicle_id] });
      toast.success('Inspección creada correctamente');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAddInspectionPhoto() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  return useMutation({
    mutationFn: async ({
      inspectionId,
      vehicleId,
      file,
      category,
      description,
    }: {
      inspectionId: string;
      vehicleId: string;
      file: File;
      category: string;
      description?: string;
    }) => {
      const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
      const compressedFile = compressed.file;
      const path = `${orgId}/fleet/${vehicleId}/photos/${Date.now()}_${compressedFile.name}`;
      const { error: upErr } = await supabase.storage.from('repair-files').upload(path, compressedFile);
      if (upErr) throw upErr;

      const { error: photoErr } = await supabase.from('fleet_inspection_photos').insert({
        inspection_id: inspectionId,
        organization_id: orgId!,
        storage_path: path,
        file_name: file.name,
        photo_category: category,
        description: description || null,
        uploaded_by: profile?.id || null,
      } as any);
      if (photoErr) throw photoErr;
      return { inspectionId, vehicleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fleet-inspection', data.inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['fleet-inspections', data.vehicleId] });
      toast.success('Foto añadida');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteInspectionPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      photoId,
      storagePath,
      inspectionId,
      vehicleId,
    }: {
      photoId: string;
      storagePath: string;
      inspectionId: string;
      vehicleId: string;
    }) => {
      await supabase.storage.from('repair-files').remove([storagePath]);
      const { error } = await supabase.from('fleet_inspection_photos').delete().eq('id', photoId);
      if (error) throw error;
      return { inspectionId, vehicleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fleet-inspection', data.inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['fleet-inspections', data.vehicleId] });
      toast.success('Foto eliminada');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUploadInspectionReceipt() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  return useMutation({
    mutationFn: async ({
      inspectionId,
      vehicleId,
      file,
    }: {
      inspectionId: string;
      vehicleId: string;
      file: File;
    }) => {
      // Compress if image; skip PDFs/documents
      let uploadFile: File = file;
      if (file.type.startsWith('image/')) {
        const compressed = await compressImage(file, { maxDimension: 1200, quality: 0.82 });
        uploadFile = compressed.file;
      }
      const ext = uploadFile.name.split('.').pop() || 'jpg';
      const path = `${orgId}/fleet/${vehicleId}/receipts/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('repair-files')
        .upload(path, uploadFile, { contentType: uploadFile.type });
      if (upErr) throw upErr;

      const { data: signedData } = await supabase.storage
        .from('repair-files')
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      const { error } = await supabase
        .from('fleet_vehicle_inspections')
        .update({ receipt_url: path } as any)
        .eq('id', inspectionId);
      if (error) throw error;
      return { inspectionId, vehicleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fleet-inspection', data.inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['fleet-inspections', data.vehicleId] });
      toast.success('Justificante subido');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteInspectionReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      inspectionId,
      vehicleId,
      storagePath,
    }: {
      inspectionId: string;
      vehicleId: string;
      storagePath: string;
    }) => {
      await supabase.storage.from('repair-files').remove([storagePath]);
      const { error } = await supabase
        .from('fleet_vehicle_inspections')
        .update({ receipt_url: null } as any)
        .eq('id', inspectionId);
      if (error) throw error;
      return { inspectionId, vehicleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fleet-inspection', data.inspectionId] });
      queryClient.invalidateQueries({ queryKey: ['fleet-inspections', data.vehicleId] });
      toast.success('Justificante eliminado');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
