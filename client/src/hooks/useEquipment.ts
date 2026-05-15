import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type {
  EquipmentItem,
  EquipmentAssignment,
  EquipmentTipo,
  EquipmentEstado,
} from '@/types/equipment';

/* ── Inventory CRUD ── */

export function useEquipmentInventory() {
  const { profile, sessionReady } = useAuth();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  const { data: items = [], isLoading, error } = useQuery({
    queryKey: ['equipment-inventory', orgId],
    queryFn: async () => {
      const { data, error } = await (supabaseQuery as any)
        .from('equipment_inventory')
        .select('*')
        .eq('organization_id', orgId!)
        .order('codigo');
      if (error) throw error;
      return data as EquipmentItem[];
    },
    enabled: !!orgId && sessionReady,
  });

  const createItem = useMutation({
    mutationFn: async (
      item: Pick<EquipmentItem, 'tipo' | 'nombre' | 'codigo'> &
        Partial<Pick<EquipmentItem, 'notas' | 'fecha_compra' | 'fecha_ultima_revision'>>
    ) => {
      const { data, error } = await (supabaseQuery as any)
        .from('equipment_inventory')
        .insert({ ...item, organization_id: orgId!, estado: 'disponible' })
        .select()
        .single();
      if (error) throw error;
      return data as EquipmentItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-inventory'] });
      toast.success('Equipo creado correctamente');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<EquipmentItem> & { id: string }) => {
      const { data, error } = await (supabaseQuery as any)
        .from('equipment_inventory')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as EquipmentItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-inventory'] });
      toast.success('Equipo actualizado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabaseQuery as any)
        .from('equipment_inventory')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-inventory'] });
      toast.success('Equipo eliminado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ── Assign equipment to a reservation ── */
  const assignToReservation = useMutation({
    mutationFn: async ({
      equipmentId,
      reservationId,
      vehicleMatricula,
      conditionOut = 'bueno',
    }: {
      equipmentId: string;
      reservationId: string;
      vehicleMatricula?: string;
      conditionOut?: string;
    }) => {
      // Update equipment status
      const { error: updateErr } = await (supabaseQuery as any)
        .from('equipment_inventory')
        .update({
          estado: 'asignada',
          reservation_id: reservationId,
          vehicle_matricula: vehicleMatricula || null,
        })
        .eq('id', equipmentId);
      if (updateErr) throw updateErr;

      // Create assignment record
      const { error: assignErr } = await (supabaseQuery as any)
        .from('equipment_assignments')
        .insert({
          equipment_id: equipmentId,
          reservation_id: reservationId,
          vehicle_matricula: vehicleMatricula || null,
          condition_out: conditionOut,
          assigned_by: profile?.id || null,
        });
      if (assignErr) throw assignErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-assignments'] });
      toast.success('Equipo asignado a la reserva');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ── Return equipment from a reservation ── */
  const returnFromReservation = useMutation({
    mutationFn: async ({
      equipmentId,
      conditionIn = 'bueno',
      notes,
    }: {
      equipmentId: string;
      conditionIn?: string;
      notes?: string;
    }) => {
      // Find the active assignment
      const { data: activeAssignment, error: findErr } = await (supabaseQuery as any)
        .from('equipment_assignments')
        .select('id')
        .eq('equipment_id', equipmentId)
        .is('returned_at', null)
        .order('assigned_at', { ascending: false })
        .limit(1)
        .single();
      if (findErr) throw findErr;

      // Close the assignment
      const { error: closeErr } = await (supabaseQuery as any)
        .from('equipment_assignments')
        .update({
          returned_at: new Date().toISOString(),
          returned_by: profile?.id || null,
          condition_in: conditionIn,
          notes: notes || null,
        })
        .eq('id', activeAssignment.id);
      if (closeErr) throw closeErr;

      // Set equipment back to available (or maintenance if damaged)
      const newEstado = conditionIn === 'dañado' || conditionIn === 'reparar' ? 'mantenimiento' : 'disponible';
      const { error: updateErr } = await (supabaseQuery as any)
        .from('equipment_inventory')
        .update({
          estado: newEstado,
          reservation_id: null,
          vehicle_matricula: null,
        })
        .eq('id', equipmentId);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-inventory'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-assignments'] });
      toast.success('Equipo devuelto correctamente');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  /* ── Change status (e.g., to maintenance) ── */
  const changeStatus = useMutation({
    mutationFn: async ({ id, estado }: { id: string; estado: EquipmentEstado }) => {
      const updates: Record<string, unknown> = { estado };
      // If moving to disponible, clear reservation link
      if (estado === 'disponible') {
        updates.reservation_id = null;
        updates.vehicle_matricula = null;
      }
      const { error } = await (supabaseQuery as any)
        .from('equipment_inventory')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['equipment-inventory'] });
      toast.success('Estado actualizado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Computed stats
  const stats = {
    total: items.length,
    disponible: items.filter((i) => i.estado === 'disponible').length,
    asignada: items.filter((i) => i.estado === 'asignada').length,
    mantenimiento: items.filter((i) => i.estado === 'mantenimiento').length,
    baja: items.filter((i) => i.estado === 'baja').length,
    byTipo: (tipo: EquipmentTipo) => ({
      total: items.filter((i) => i.tipo === tipo).length,
      disponible: items.filter((i) => i.tipo === tipo && i.estado === 'disponible').length,
      asignada: items.filter((i) => i.tipo === tipo && i.estado === 'asignada').length,
    }),
  };

  return {
    items,
    isLoading,
    error,
    stats,
    createItem,
    updateItem,
    deleteItem,
    assignToReservation,
    returnFromReservation,
    changeStatus,
  };
}

/* ── Assignment history ── */

export function useEquipmentAssignments(equipmentId?: string) {
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['equipment-assignments', equipmentId],
    queryFn: async () => {
      let query = (supabaseQuery as any)
        .from('equipment_assignments')
        .select('*')
        .order('assigned_at', { ascending: false });
      if (equipmentId) {
        query = query.eq('equipment_id', equipmentId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as EquipmentAssignment[];
    },
    enabled: equipmentId ? !!equipmentId : true,
  });

  return { assignments, isLoading };
}

/* ── Equipment for a specific reservation ── */

export function useReservationEquipment(reservationId?: string) {
  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['equipment-inventory', 'reservation', reservationId],
    queryFn: async () => {
      const { data, error } = await (supabaseQuery as any)
        .from('equipment_inventory')
        .select('*')
        .eq('reservation_id', reservationId!);
      if (error) throw error;
      return data as EquipmentItem[];
    },
    enabled: !!reservationId,
  });

  return { equipment, isLoading };
}
