import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { apiInvoke } from '@/lib/apiClient';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import {
  Plus, Check, Trash2, Clock, AlertTriangle, Car, CheckCircle2, Undo2, Pencil,
} from 'lucide-react';

interface PreparationItem {
  id: string;
  organization_id: string;
  matricula: string;
  modelo: string | null;
  deadline_at: string;
  notes: string | null;
  status: 'pending' | 'ready';
  added_by: string;
  completed_by: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface FleetVehicleOption {
  matricula: string;
  modelo: string | null;
  marca: string | null;
  vehicle_status: 'sucio' | 'incompleto';
}

function formatDeadlineTime(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
}

function formatDeadlineLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    const diffMin = Math.round(diffMs / 60000);

    if (diffMin < 0) return 'Pasado';
    if (diffMin < 60) return `${diffMin}min`;
    if (diffMin < 1440) return `${Math.round(diffMin / 60)}h`;
    return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function getUrgencyFromDeadline(dateStr: string): 'critical' | 'high' | 'medium' | 'low' {
  const diffMs = new Date(dateStr).getTime() - Date.now();
  const diffHours = diffMs / (1000 * 60 * 60);
  if (diffHours < 0) return 'critical';
  if (diffHours < 1) return 'critical';
  if (diffHours < 4) return 'high';
  if (diffHours < 12) return 'medium';
  return 'low';
}

const URGENCY_STYLES = {
  critical: { bg: 'bg-red-500/10', text: 'text-red-600', border: 'border-red-500/30' },
  high: { bg: 'bg-orange-500/10', text: 'text-orange-600', border: 'border-orange-500/30' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-600', border: 'border-amber-500/30' },
  low: { bg: 'bg-muted/30', text: 'text-muted-foreground', border: 'border-border/50' },
};

// ─── Plate Autocomplete Component ───────────────────────────────────────
function PlateAutocomplete({
  value,
  onChange,
  onSelectVehicle,
  vehicles,
  placeholder = '1234ABC',
  autoFocus = false,
}: {
  value: string;
  onChange: (val: string) => void;
  onSelectVehicle: (v: FleetVehicleOption) => void;
  vehicles: FleetVehicleOption[];
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!value.trim()) return vehicles.slice(0, 8);
    const q = value.toUpperCase().replace(/\s/g, '');
    return vehicles
      .filter(v => v.matricula.replace(/\s/g, '').includes(q) ||
        (v.modelo && v.modelo.toUpperCase().includes(q)) ||
        (v.marca && v.marca.toUpperCase().includes(q)))
      .slice(0, 8);
  }, [value, vehicles]);

  useEffect(() => {
    setHighlightIndex(-1);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filtered.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      const selected = filtered[highlightIndex];
      onSelectVehicle(selected);
      setShowSuggestions(false);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value.toUpperCase());
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          // Delay to allow click on suggestion
          setTimeout(() => setShowSuggestions(false), 200);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="mt-1"
        autoFocus={autoFocus}
        autoComplete="off"
      />
      {showSuggestions && filtered.length > 0 && (
        <div
          ref={listRef}
          className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto"
        >
          {filtered.map((v, i) => (
            <button
              key={v.matricula}
              type="button"
              className={`w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors flex items-center gap-2 ${
                i === highlightIndex ? 'bg-accent' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectVehicle(v);
                setShowSuggestions(false);
              }}
            >
              <span className={`inline-flex items-center justify-center w-2 h-2 rounded-full flex-shrink-0 ${
                v.vehicle_status === 'sucio' ? 'bg-red-500' : 'bg-orange-400'
              }`} />
              <span className="font-semibold text-foreground">{v.matricula}</span>
              {(v.marca || v.modelo) && (
                <span className="text-muted-foreground text-xs truncate">
                  {[v.marca, v.modelo].filter(Boolean).join(' ')}
                </span>
              )}
              <span className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${
                v.vehicle_status === 'sucio'
                  ? 'bg-red-100 text-red-700'
                  : 'bg-orange-100 text-orange-700'
              }`}>
                {v.vehicle_status === 'sucio' ? 'Sucio' : 'Incompleto'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────
export function ManualPreparationList() {
  const { organization, profile } = useAuth();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const organizationId = organization?.id;
  const orgId = profile?.organization_id;

  const canManage = hasPermission('preparation.manage');

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<PreparationItem | null>(null);
  const [formMatricula, setFormMatricula] = useState('');
  const [formModelo, setFormModelo] = useState('');
  const [formDeadline, setFormDeadline] = useState('');
  const [formNotes, setFormNotes] = useState('');

  // Fetch vehicles that actually need preparation (sucio or incompleto only)
  const { data: fleetVehicles = [] } = useQuery<FleetVehicleOption[]>({
    queryKey: ['vehicles-for-preparation', orgId],
    queryFn: async () => {
      const { data, error } = await supabaseQuery
        .from('vehicles')
        .select('matricula, modelo, categoria, status')
        .eq('organization_id', orgId!)
        .eq('is_archived', false)
        .in('status', ['sucio', 'incompleto'])
        .order('matricula');
      if (error) throw error;
      return (data || []).map((v: any) => ({
        matricula: v.matricula,
        modelo: v.modelo,
        marca: v.categoria,
        vehicle_status: v.status as 'sucio' | 'incompleto',
      })) as FleetVehicleOption[];
    },
    enabled: !!orgId,
    staleTime: 30 * 1000, // 30s cache - status changes frequently
  });

  // Fetch preparation list
  const { data: items = [], isLoading } = useQuery({
    queryKey: ['preparation-list', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const result = await apiInvoke<{ ok: boolean; data: PreparationItem[] }>('get-preparation-list', {
        body: { organizationId },
      });
      if (result.error || !result.data?.ok) return [];
      return result.data.data;
    },
    enabled: !!organizationId,
    refetchInterval: 60000,
    staleTime: 30000,
  });

  // Add item mutation
  const addMutation = useMutation({
    mutationFn: async (params: { matricula: string; modelo: string; deadline_at: string; notes: string }) => {
      const result = await apiInvoke<{ ok: boolean; error?: string }>('add-preparation-item', {
        body: { organizationId, ...params },
      });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || result.error?.message || 'Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preparation-list'] });
      toast({ title: 'Añadido', description: 'Vehículo añadido a la lista de preparación' });
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Complete item mutation
  const completeMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const result = await apiInvoke<{ ok: boolean; error?: string }>('complete-preparation-item', {
        body: { itemId },
      });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || result.error?.message || 'Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preparation-list'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Uncomplete item mutation
  const uncompleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const result = await apiInvoke<{ ok: boolean; error?: string }>('uncomplete-preparation-item', {
        body: { itemId },
      });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || result.error?.message || 'Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preparation-list'] });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Delete item mutation
  const deleteMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const result = await apiInvoke<{ ok: boolean; error?: string }>('delete-preparation-item', {
        body: { itemId },
      });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || result.error?.message || 'Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preparation-list'] });
      toast({ title: 'Eliminado', description: 'Vehículo eliminado de la lista' });
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  // Update item mutation
  const updateMutation = useMutation({
    mutationFn: async (params: { itemId: string; matricula?: string; modelo?: string; deadline_at?: string; notes?: string }) => {
      const result = await apiInvoke<{ ok: boolean; error?: string }>('update-preparation-item', {
        body: params,
      });
      if (result.error || !result.data?.ok) throw new Error(result.data?.error || result.error?.message || 'Error');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preparation-list'] });
      toast({ title: 'Actualizado', description: 'Vehículo actualizado' });
      setEditingItem(null);
      resetForm();
    },
    onError: (err: Error) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const resetForm = () => {
    setShowAddDialog(false);
    setFormMatricula('');
    setFormModelo('');
    setFormDeadline('');
    setFormNotes('');
  };

  const handleAdd = () => {
    if (!formMatricula.trim() || !formDeadline) return;
    addMutation.mutate({
      matricula: formMatricula.trim(),
      modelo: formModelo.trim(),
      deadline_at: new Date(formDeadline).toISOString(),
      notes: formNotes.trim(),
    });
  };

  const handleUpdate = () => {
    if (!editingItem || !formMatricula.trim() || !formDeadline) return;
    updateMutation.mutate({
      itemId: editingItem.id,
      matricula: formMatricula.trim(),
      modelo: formModelo.trim(),
      deadline_at: new Date(formDeadline).toISOString(),
      notes: formNotes.trim(),
    });
  };

  const openEditDialog = (item: PreparationItem) => {
    setEditingItem(item);
    setFormMatricula(item.matricula);
    setFormModelo(item.modelo || '');
    const d = new Date(item.deadline_at);
    const localDate = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setFormDeadline(localDate);
    setFormNotes(item.notes || '');
  };

  const handleSelectVehicle = (v: FleetVehicleOption) => {
    setFormMatricula(v.matricula);
    setFormModelo([v.marca, v.modelo].filter(Boolean).join(' '));
  };

  // Filter out vehicles already in the pending preparation list
  const availableVehicles = useMemo(() => {
    const pendingMatriculas = new Set(
      items.filter(i => i.status === 'pending').map(i => i.matricula.toUpperCase())
    );
    return fleetVehicles.filter(v => !pendingMatriculas.has(v.matricula.toUpperCase()));
  }, [fleetVehicles, items]);

  // Separate pending and completed
  const pendingItems = useMemo(() => items.filter(i => i.status === 'pending'), [items]);
  const completedItems = useMemo(() => items.filter(i => i.status === 'ready'), [items]);

  if (isLoading) {
    return (
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-48" />
            <div className="h-10 bg-muted rounded" />
            <div className="h-10 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!hasPermission('preparation.view')) return null;

  return (
    <>
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2 px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Car className="h-4 w-4 text-orange-500 flex-shrink-0" />
              <span className="truncate">
                Lista de preparación
                {pendingItems.length > 0 && (
                  <span className="text-orange-500 font-semibold"> · {pendingItems.length} pendientes</span>
                )}
              </span>
            </CardTitle>
            {canManage && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs h-7"
                onClick={() => {
                  resetForm();
                  const now = new Date();
                  now.setHours(now.getHours() + 1, 0, 0, 0);
                  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
                  setFormDeadline(localDate);
                  setShowAddDialog(true);
                }}
              >
                <Plus className="h-3 w-3" />
                <span className="hidden sm:inline">Añadir</span>
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-3 px-4 sm:px-6">
          {pendingItems.length === 0 && completedItems.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500/50" />
              <p className="text-sm">No hay vehículos pendientes de preparar</p>
              {canManage && (
                <p className="text-xs mt-1">Pulsa "Añadir" para agregar un vehículo</p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Pending items */}
              {pendingItems.map((item) => {
                const urgency = getUrgencyFromDeadline(item.deadline_at);
                const style = URGENCY_STYLES[urgency];
                const timeLabel = formatDeadlineLabel(item.deadline_at);
                const timeStr = formatDeadlineTime(item.deadline_at);

                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 sm:gap-3 py-2 sm:py-2.5 -mx-2 px-2 rounded transition-colors hover:bg-muted/30 group"
                  >
                    {/* Urgency indicator */}
                    <div className={`flex items-center justify-center h-6 w-6 sm:h-7 sm:w-7 rounded-full flex-shrink-0 ${style.bg}`}>
                      {urgency === 'critical' ? (
                        <AlertTriangle className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${style.text}`} />
                      ) : (
                        <Clock className={`h-3 w-3 sm:h-3.5 sm:w-3.5 ${style.text}`} />
                      )}
                    </div>

                    {/* Time label */}
                    <span className={`text-xs font-semibold w-14 sm:w-16 flex-shrink-0 ${style.text}`}>
                      {timeLabel}
                    </span>

                    {/* Plate + Model */}
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-foreground text-xs sm:text-sm">{item.matricula}</span>
                      </div>
                      {item.modelo && (
                        <span className="text-[11px] text-muted-foreground truncate">{item.modelo}</span>
                      )}
                      {item.notes && (
                        <span className="text-[10px] text-muted-foreground/70 truncate italic">{item.notes}</span>
                      )}
                    </div>

                    {/* Deadline time */}
                    <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block">
                      {timeStr}
                    </span>

                    {/* Actions */}
                    {canManage && (
                      <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                          onClick={() => completeMutation.mutate(item.id)}
                          title="Marcar como listo"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                          onClick={() => openEditDialog(item)}
                          title="Editar"
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => deleteMutation.mutate(item.id)}
                          title="Eliminar"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Completed items (collapsed) */}
              {completedItems.length > 0 && (
                <div className="pt-2 mt-2 border-t border-border/50">
                  <p className="text-[11px] text-muted-foreground mb-1 flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Completados hoy ({completedItems.length})
                  </p>
                  {completedItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 py-1.5 -mx-2 px-2 rounded opacity-60 hover:opacity-100 transition-opacity group"
                    >
                      <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="text-xs line-through text-muted-foreground flex-1">{item.matricula}</span>
                      {item.modelo && (
                        <span className="text-[10px] text-muted-foreground/60 truncate max-w-[100px]">{item.modelo}</span>
                      )}
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                          onClick={() => uncompleteMutation.mutate(item.id)}
                          title="Deshacer"
                        >
                          <Undo2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add / Edit Dialog */}
      <Dialog open={showAddDialog || !!editingItem} onOpenChange={(open) => {
        if (!open) {
          setShowAddDialog(false);
          setEditingItem(null);
          resetForm();
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar vehículo' : 'Añadir vehículo a preparar'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Matrícula *</label>
              <PlateAutocomplete
                value={formMatricula}
                onChange={setFormMatricula}
                onSelectVehicle={handleSelectVehicle}
                vehicles={availableVehicles}
                autoFocus={!editingItem}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Modelo</label>
              <Input
                value={formModelo}
                onChange={(e) => setFormModelo(e.target.value)}
                placeholder="GLA 200, Cayenne..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Hora límite *</label>
              <Input
                type="datetime-local"
                value={formDeadline}
                onChange={(e) => setFormDeadline(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Notas</label>
              <Input
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Ej: Lavar exterior, revisar presión..."
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowAddDialog(false); setEditingItem(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={editingItem ? handleUpdate : handleAdd}
              disabled={!formMatricula.trim() || !formDeadline || addMutation.isPending || updateMutation.isPending}
            >
              {editingItem ? 'Guardar' : 'Añadir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
