import React, { useState, useMemo, useCallback, useRef, createContext, useContext } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { AppLayout } from '@/components/layout/AppLayout';
import { apiInvoke } from '@/lib/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  Settings2,
  ArrowDown,
  ArrowUp,
  Minus,
  Users,
  Pencil,
  Trash2,
  X,
  Copy,
  Clock,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ArrowUpDown,
  GripVertical,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { WeeklyCapacityPanel } from '@/components/WeeklyCapacityPanel';
import { useScheduleNotes } from '@/hooks/useScheduleNotes';
import type { ScheduleNote } from '@/hooks/useScheduleNotes';
import { CellNoteIndicator } from '@/components/schedules/CellNoteIndicator';
import { TravelTimeEditor } from '@/components/TravelTimeEditor';
import { TimePicker } from '@/components/ui/time-picker';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ShiftTemplate {
  id: string;
  name: string;
  start_time: string | null;
  end_time: string | null;
  color: string;
  is_day_off: boolean;
  sort_order: number;
}

interface ScheduleEntry {
  id: string;
  user_id: string;
  date: string;
  shift_template_id: string | null;
  team_id: string | null;
  notes: string | null;
}

interface StaffMember {
  id: string;
  name: string;
  avatar_url: string | null;
}

interface TeamGroup {
  team_id: string;
  team_name: string;
  members: StaffMember[];
}

interface DayStats {
  deliveries: number;
  returns: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getWeekDates(weekOffset: number): Date[] {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1) + weekOffset * 7);
  monday.setHours(0, 0, 0, 0);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDayLabel(d: Date): string {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return days[d.getDay()];
}

function formatDateShort(d: Date): string {
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

/** Calculate hours from a shift template's start_time and end_time (HH:MM format) */
function calcShiftHours(shift: ShiftTemplate | null): number {
  if (!shift || shift.is_day_off || !shift.start_time || !shift.end_time) return 0;
  const [sh, sm] = shift.start_time.split(':').map(Number);
  const [eh, em] = shift.end_time.split(':').map(Number);
  let startMin = sh * 60 + sm;
  let endMin = eh * 60 + em;
  // Handle overnight shifts (e.g. 22:00 - 06:00)
  if (endMin <= startMin) endMin += 24 * 60;
  return (endMin - startMin) / 60;
}

/** Format hours nicely: 8h, 7.5h */
function formatHours(h: number): string {
  if (h === 0) return '0h';
  if (Number.isInteger(h)) return `${h}h`;
  return `${h.toFixed(1)}h`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Schedules() {
  const { profile, sessionReady } = useAuth();
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const queryClient = useQueryClient();
  const orgId = profile?.organization_id;

  // Permission flags
  const canView = hasPermission('schedules.view');
  const canAssign = hasPermission('schedules.assign');
  const canManageTemplates = hasPermission('schedules.manage_templates');
  const canManage = hasPermission('schedules.manage');
  const canManageNotes = hasPermission('schedules.manage_notes');
  const canPublish = hasPermission('schedules.publish');
  const canViewDirectiva = hasPermission('schedules.view_directiva');

  const capacityPanelRef = useRef<HTMLDivElement>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedCell, setSelectedCell] = useState<{ teamId: string; userId: string; date: string } | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ShiftTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    name: '',
    start_time: '',
    end_time: '',
    color: '#3B82F6',
    is_day_off: false,
  });

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekStart = formatDateISO(weekDates[0]);
  const weekEnd = formatDateISO(weekDates[6]);

  // Previous week dates (for copy feature)
  const prevWeekDates = useMemo(() => getWeekDates(weekOffset - 1), [weekOffset]);
  const prevWeekStart = formatDateISO(prevWeekDates[0]);
  const prevWeekEnd = formatDateISO(prevWeekDates[6]);

  // ─── Queries ─────────────────────────────────────────────────────────────

  const { data: shiftTemplates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['shift-templates', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const res = await apiInvoke<{ data: ShiftTemplate[] }>('get-shift-templates', {
        body: { organizationId: orgId },
      });
      return res.data?.data || [];
    },
    enabled: !!orgId && sessionReady,
    staleTime: 5 * 60 * 1000,
  });

  const { data: weeklyData, isLoading: scheduleLoading } = useQuery({
    queryKey: ['weekly-schedule', orgId, weekStart, weekEnd],
    queryFn: async () => {
      if (!orgId) return null;
      const res = await apiInvoke<{
        ok: boolean;
        data: {
          teamMembers: Array<{ user_id: string; team_id: string; teams: { id: string; name: string; color: string; organization_id: string } }>;
          profiles: Array<{ id: string; name: string; avatar_url: string | null }>;
          schedules: ScheduleEntry[];
          dailyCounts: Record<string, { entregas: number; devoluciones: number; transfers: number }>;
          teamsWithCustomOrder?: string[];
          weekPublished?: boolean;
        };
      }>('get-weekly-schedule', {
        body: { organizationId: orgId, start_date: weekStart, end_date: weekEnd },
      });

      if (res.error || !res.data) return null;
      const raw = res.data.data;
      if (!raw) return null;

      // Build profile lookup
      const profileMap = new Map<string, { id: string; name: string; avatar_url: string | null }>();
      for (const p of raw.profiles || []) {
        profileMap.set(p.id, p);
      }

      // Group teamMembers by team, preserving sort_order
      const teamMap = new Map<string, { team_id: string; team_name: string; color: string; members: { user_id: string; sort_order: number }[] }>();
      for (const tm of raw.teamMembers || []) {
        const teamInfo = tm.teams;
        if (!teamInfo) continue;
        if (!teamMap.has(teamInfo.id)) {
          teamMap.set(teamInfo.id, {
            team_id: teamInfo.id,
            team_name: teamInfo.name,
            color: teamInfo.color,
            members: [],
          });
        }
        // Avoid duplicates
        const existing = teamMap.get(teamInfo.id)!;
        if (!existing.members.some(m => m.user_id === tm.user_id)) {
          existing.members.push({ user_id: tm.user_id, sort_order: (tm as any).sort_order ?? 0 });
        }
      }

      // Convert to TeamGroup[], sorted by sort_order then name
      const teams: TeamGroup[] = Array.from(teamMap.values()).map(t => ({
        team_id: t.team_id,
        team_name: t.team_name,
        members: t.members
          .sort((a, b) => {
            if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
            const nameA = profileMap.get(a.user_id)?.name || '';
            const nameB = profileMap.get(b.user_id)?.name || '';
            return nameA.localeCompare(nameB);
          })
          .map(m => {
            const profile = profileMap.get(m.user_id);
            return {
              id: m.user_id,
              name: profile?.name || 'Sin nombre',
              avatar_url: profile?.avatar_url || null,
            };
          }),
      }));

      // Convert dailyCounts to dayStats
      const dayStats: Record<string, DayStats> = {};
      for (const [date, counts] of Object.entries(raw.dailyCounts || {})) {
        dayStats[date] = {
          deliveries: counts.entregas,
          returns: counts.devoluciones,
        };
      }

      return {
        teams,
        schedules: raw.schedules || [],
        dayStats,
        teamsWithCustomOrder: raw.teamsWithCustomOrder || [],
        weekPublished: raw.weekPublished ?? false,
      };
    },
    enabled: !!orgId && sessionReady,
    staleTime: 30 * 1000,
  });

  const allTeams = weeklyData?.teams || [];
  const teamsWithCustomOrder = new Set(weeklyData?.teamsWithCustomOrder || []);
  // Filter out Directiva team if user doesn't have view_directiva permission
  // Then sort by custom order: Directiva → Mostrador → Rentals → Preparación
  const TEAM_ORDER: Record<string, number> = {
    directiva: 1,
    mostrador: 2,
    rentals: 3,
    rental: 3,
    'preparación': 4,
    preparacion: 4,
  };
  const teams = allTeams
    .filter(t => {
      if (t.team_name.toLowerCase() === 'directiva' && !canViewDirectiva) return false;
      return true;
    })
    .sort((a, b) => {
      const orderA = TEAM_ORDER[a.team_name.toLowerCase()] ?? 99;
      const orderB = TEAM_ORDER[b.team_name.toLowerCase()] ?? 99;
      return orderA - orderB;
    });
  const schedules = weeklyData?.schedules || [];
  const dayStats = weeklyData?.dayStats || {};
  const weekPublished = weeklyData?.weekPublished ?? true;

  // ─── Schedule Notes (fetched once at parent, passed down) ───────────────
  const { noteLookup, upsertNote, deleteNote } = useScheduleNotes({
    weekStart,
    weekEnd,
    enabled: canManageNotes,
  });

  const handleSaveNote = useCallback((date: string, content: string, userId: string) => {
    upsertNote.mutate({ date, content, user_id: userId });
  }, [upsertNote]);

  const handleDeleteNote = useCallback((noteId: string) => {
    deleteNote.mutate({ noteId });
  }, [deleteNote]);

  const isNoteSaving = upsertNote.isPending || deleteNote.isPending;

  // Build schedule lookup: userId+date -> ScheduleEntry
  const scheduleLookup = useMemo(() => {
    const map = new Map<string, ScheduleEntry>();
    for (const s of schedules) {
      map.set(`${s.user_id}__${s.date}`, s);
    }
    return map;
  }, [schedules]);

  // ─── Mutations ───────────────────────────────────────────────────────────

  const upsertMutation = useMutation({
    mutationFn: async (params: { userId: string; date: string; shiftTemplateId: string | null }) => {
      const res = await apiInvoke('upsert-schedule', {
        body: {
          organizationId: orgId,
          user_id: params.userId,
          date: params.date,
          shift_template_id: params.shiftTemplateId,
        },
      });
      if (res.error) throw new Error(res.error.message || 'Error al guardar');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', orgId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async (params: { team_id: string; ordered_user_ids: string[]; week_start: string }) => {
      const res = await apiInvoke('reorder-team-members', {
        body: params,
      });
      if (res.error) throw new Error(res.error.message || 'Error al reordenar');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', orgId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleReorderMember = (teamId: string, members: StaffMember[], memberIndex: number, direction: 'up' | 'down') => {
    const newMembers = [...members];
    const targetIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;
    if (targetIndex < 0 || targetIndex >= newMembers.length) return;
    // Swap the two users' shifts so shifts stay in their original row position
    const userA = members[memberIndex];
    const userB = members[targetIndex];
    swapShiftsMutation.mutate({ user_a_id: userA.id, user_b_id: userB.id });
    // Also update the visual name order
    [newMembers[memberIndex], newMembers[targetIndex]] = [newMembers[targetIndex], newMembers[memberIndex]];
    const ordered_user_ids = newMembers.map(m => m.id);
    reorderMutation.mutate({ team_id: teamId, ordered_user_ids, week_start: weekStart });
  };

  // Mutation to rotate shifts among multiple users (for multi-position drag)
  const rotateShiftsMutation = useMutation({
    mutationFn: async (params: { user_ids: string[] }) => {
      const res = await apiInvoke('rotate-user-schedules', {
        body: {
          user_ids: params.user_ids,
          start_date: weekStart,
          end_date: weekEnd,
        },
      });
      if (res.error) throw new Error(res.error.message || 'Error al rotar horarios');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', orgId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleDragReorder = (teamId: string, orderedUserIds: string[], oldMembers: StaffMember[]) => {
    // Find which users changed position and rotate their shifts
    // so shifts stay in their original row positions
    const oldOrder = oldMembers.map(m => m.id);
    const newOrder = orderedUserIds;

    // Find the contiguous range of users that were affected by the drag
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < oldOrder.length; i++) {
      if (oldOrder[i] !== newOrder[i]) {
        if (startIdx === -1) startIdx = i;
        endIdx = i;
      }
    }

    if (startIdx !== -1 && endIdx !== -1) {
      // Get the affected users in their ORIGINAL order for the rotation
      const affectedOriginalOrder = oldOrder.slice(startIdx, endIdx + 1);
      if (affectedOriginalOrder.length >= 2) {
        rotateShiftsMutation.mutate({ user_ids: affectedOriginalOrder });
      }
    }

    // Update the visual name order
    reorderMutation.mutate({ team_id: teamId, ordered_user_ids: orderedUserIds, week_start: weekStart });
  };

  // Mutation to swap shifts between two users (independent of name reorder)
  const swapShiftsMutation = useMutation({
    mutationFn: async (params: { user_a_id: string; user_b_id: string }) => {
      const res = await apiInvoke('swap-user-schedules', {
        body: {
          user_a_id: params.user_a_id,
          user_b_id: params.user_b_id,
          start_date: weekStart,
          end_date: weekEnd,
        },
      });
      if (res.error) throw new Error(res.error.message || 'Error al intercambiar horarios');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', orgId] });
      toast.success('Horarios intercambiados');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const handleSwapShifts = (_teamId: string, members: StaffMember[], memberIndex: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? memberIndex - 1 : memberIndex + 1;
    if (targetIndex < 0 || targetIndex >= members.length) return;
    const userA = members[memberIndex];
    const userB = members[targetIndex];
    // Swap shifts between the two users — names are NOT touched
    swapShiftsMutation.mutate({ user_a_id: userA.id, user_b_id: userB.id });
  };

  const createTemplateMutation = useMutation({
    mutationFn: async (params: typeof templateForm) => {
      const res = await apiInvoke('create-shift-template', {
        body: { organizationId: orgId, ...params },
      });
      if (res.error) throw new Error(res.error.message || 'Error al crear turno');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-templates', orgId] });
      toast.success('Turno creado');
      setShowTemplateDialog(false);
      resetTemplateForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: async (params: typeof templateForm & { id: string }) => {
      const { id: template_id, ...rest } = params;
      const res = await apiInvoke('update-shift-template', {
        body: { organizationId: orgId, template_id, ...rest },
      });
      if (res.error) throw new Error(res.error.message || 'Error al actualizar turno');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-templates', orgId] });
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', orgId] });
      toast.success('Turno actualizado');
      setShowTemplateDialog(false);
      setEditingTemplate(null);
      resetTemplateForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiInvoke('delete-shift-template', {
        body: { organizationId: orgId, template_id: id },
      });
      if (res.error) throw new Error(res.error.message || 'Error al eliminar turno');
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shift-templates', orgId] });
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', orgId] });
      toast.success('Turno eliminado');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ─── Copy Previous Week Mutation ─────────────────────────────────────────

  const copyWeekMutation = useMutation({
    mutationFn: async () => {
      if (!orgId) throw new Error('No organization');

      // 1. Fetch previous week's schedules
      const prevRes = await apiInvoke<{
        ok: boolean;
        data: {
          schedules: ScheduleEntry[];
          teamMembers: any[];
          profiles: any[];
          dailyCounts: any;
        };
      }>('get-weekly-schedule', {
        body: { organizationId: orgId, start_date: prevWeekStart, end_date: prevWeekEnd },
      });

      if (prevRes.error || !prevRes.data?.data) {
        throw new Error('No se pudo obtener la semana anterior');
      }

      const prevSchedules = prevRes.data.data.schedules || [];
      if (prevSchedules.length === 0) {
        throw new Error('La semana anterior no tiene turnos asignados');
      }

      // 2. Map previous week entries to current week (same day-of-week offset)
      const entries = prevSchedules
        .filter(s => s.shift_template_id) // Only copy actual shifts
        .map(s => {
          // Find the day offset (0=Mon, 6=Sun) from prev week
          const prevDate = new Date(s.date + 'T00:00:00');
          const prevMonday = new Date(prevWeekDates[0]);
          const dayOffset = Math.round((prevDate.getTime() - prevMonday.getTime()) / (24 * 60 * 60 * 1000));

          if (dayOffset < 0 || dayOffset > 6) return null;

          const targetDate = formatDateISO(weekDates[dayOffset]);

          return {
            user_id: s.user_id,
            date: targetDate,
            shift_template_id: s.shift_template_id,
            team_id: s.team_id,
            notes: null,
          };
        })
        .filter(Boolean);

      if (entries.length === 0) {
        throw new Error('No hay turnos para copiar');
      }

      // 3. Bulk upsert to current week
      const res = await apiInvoke('bulk-upsert-schedules', {
        body: { organizationId: orgId, entries },
      });

      if (res.error) throw new Error(res.error.message || 'Error al copiar');
      return entries.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', orgId] });
      toast.success(`${count} turnos copiados de la semana anterior`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ─── Publish / Unpublish Week ────────────────────────────────────────────

  const publishWeekMutation = useMutation({
    mutationFn: async (params: { publish: boolean }) => {
      const res = await apiInvoke('publish-week', {
        body: { organizationId: orgId, week_start: weekStart, action: params.publish ? 'publish' : 'unpublish' },
      });
      if (res.error) throw new Error(res.error.message || 'Error al publicar');
      return res;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['weekly-schedule', orgId] });
      toast.success(variables.publish ? 'Semana publicada' : 'Semana despublicada (borrador)');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const [showUnpublishConfirm, setShowUnpublishConfirm] = useState(false);

  const handleTogglePublish = () => {
    if (weekPublished) {
      // Show confirmation dialog before unpublishing
      setShowUnpublishConfirm(true);
    } else {
      publishWeekMutation.mutate({ publish: true });
    }
  };

  const handleConfirmUnpublish = () => {
    setShowUnpublishConfirm(false);
    publishWeekMutation.mutate({ publish: false });
  };

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleAssignShift = useCallback((userId: string, date: string, shiftTemplateId: string | null) => {
    upsertMutation.mutate({ userId, date, shiftTemplateId });
    setSelectedCell(null);
  }, [upsertMutation]);

  const resetTemplateForm = () => {
    setTemplateForm({ name: '', start_time: '', end_time: '', color: '#3B82F6', is_day_off: false });
  };

  const openCreateTemplate = () => {
    setEditingTemplate(null);
    resetTemplateForm();
    setShowTemplateDialog(true);
  };

  const openEditTemplate = (t: ShiftTemplate) => {
    setEditingTemplate(t);
    setTemplateForm({
      name: t.name,
      start_time: t.start_time || '',
      end_time: t.end_time || '',
      color: t.color,
      is_day_off: t.is_day_off,
    });
    setShowTemplateDialog(true);
  };

  const handleSaveTemplate = () => {
    if (!templateForm.name.trim()) {
      toast.error('El nombre del turno es obligatorio');
      return;
    }
    if (editingTemplate) {
      updateTemplateMutation.mutate({ ...templateForm, id: editingTemplate.id });
    } else {
      createTemplateMutation.mutate(templateForm);
    }
  };

  const handleCopyPreviousWeek = () => {
    if (copyWeekMutation.isPending) return;
    copyWeekMutation.mutate();
  };

  // ─── Week label ──────────────────────────────────────────────────────────

  const weekLabel = useMemo(() => {
    const s = weekDates[0];
    const e = weekDates[6];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()} – ${e.getDate()} ${months[s.getMonth()]} ${s.getFullYear()}`;
    }
    return `${s.getDate()} ${months[s.getMonth()]} – ${e.getDate()} ${months[e.getMonth()]} ${e.getFullYear()}`;
  }, [weekDates]);

  const isCurrentWeek = weekOffset === 0;

  // ─── Staff summary for banner (today or first day of displayed week) ─────
  const staffSummary = useMemo(() => {
    if (teams.length === 0) return null;
    // If current week, use today; otherwise use first day of the week (Monday)
    const targetDate = isCurrentWeek
      ? weekDates.find(d => isToday(d)) || weekDates[0]
      : weekDates[0];
    const todayStr = formatDateISO(targetDate);
    const isTodayBanner = isToday(targetDate);

    // Count working staff per team (excluding day-off shifts and unassigned)
    const teamBreakdown: { name: string; working: number; total: number }[] = [];
    let totalWorking = 0;
    let totalMembers = 0;

    for (const team of teams) {
      // Skip Directiva from the operational count
      if (team.team_name.toLowerCase() === 'directiva') continue;

      let working = 0;
      for (const member of team.members) {
        const entry = scheduleLookup.get(`${member.id}__${todayStr}`);
        if (entry?.shift_template_id) {
          const shift = shiftTemplates.find(t => t.id === entry.shift_template_id);
          if (shift && !shift.is_day_off) {
            working++;
          }
        }
      }
      teamBreakdown.push({ name: team.team_name, working, total: team.members.length });
      totalWorking += working;
      totalMembers += team.members.length;
    }

    // Get today's operations
    const stats = dayStats[todayStr];
    const totalOps = stats ? stats.deliveries + stats.returns : 0;

    // Status
    const ratio = totalMembers > 0 ? totalWorking / totalMembers : 1;
    const status: 'good' | 'warning' | 'critical' = ratio >= 0.7 ? 'good' : ratio >= 0.5 ? 'warning' : 'critical';

    // Date label for the banner
    const dateLabel = isTodayBanner ? 'Hoy' : `${formatDayLabel(targetDate)} ${formatDateShort(targetDate)}`;

    return { todayStr, totalWorking, totalMembers, teamBreakdown, totalOps, stats, status, isTodayBanner, dateLabel };
  }, [weekDates, teams, scheduleLookup, shiftTemplates, dayStats, isCurrentWeek]);

  // ─── Render ──────────────────────────────────────────────────────────────

  if (!orgId) {
    return (
      <AppLayout title="Horarios" fullWidth>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Selecciona una organización</p>
        </div>
      </AppLayout>
    );
  }

  const isLoading = templatesLoading || scheduleLoading || permissionsLoading || !orgId || !sessionReady;

  return (
    <AppLayout title="Horarios" fullWidth>
    <TooltipProvider>
      <div className="flex flex-col h-full">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-2 py-3">
          {/* Left: publish status */}
          <div className="flex items-center gap-2">
            {!isLoading && (
              <Badge
                variant={weekPublished ? 'default' : 'secondary'}
                className={cn(
                  'text-xs font-medium',
                  weekPublished
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                )}
              >
                {weekPublished ? 'Publicado' : 'Borrador'}
              </Badge>
            )}
            {(canPublish || canManage) && !isLoading && (
              <Button
                variant={weekPublished ? 'outline' : 'default'}
                size="sm"
                className="gap-1.5"
                onClick={handleTogglePublish}
                disabled={publishWeekMutation.isPending}
              >
                {publishWeekMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : weekPublished ? (
                  <X className="h-4 w-4" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {weekPublished ? 'Despublicar' : 'Publicar'}
              </Button>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2">
            {/* Copy previous week — requires schedules.manage */}
            {canManage && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={handleCopyPreviousWeek}
                    disabled={copyWeekMutation.isPending || isLoading}
                  >
                    {copyWeekMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Copiar semana</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copiar turnos de la semana anterior</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Week navigation */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekOffset(w => w - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                onClick={() => setWeekOffset(0)}
                className={cn(
                  "px-3 py-1.5 text-sm font-medium rounded-md transition-colors min-w-[180px] text-center",
                  isCurrentWeek ? "bg-primary/10 text-primary" : "hover:bg-muted"
                )}
              >
                {weekLabel}
              </button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setWeekOffset(w => w + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Manage templates — requires schedules.manage_templates */}
            {canManageTemplates && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={openCreateTemplate}
              >
                <Settings2 className="h-4 w-4" />
                Turnos
              </Button>
            )}
          </div>
        </div>

        {/* ── Staff Banner (sticky, clickable → scrolls to Carga Semanal) ── */}
        {!isLoading && staffSummary && (
          <div className="sticky top-0 z-20 mx-4 mt-2 mb-0">
            <button
              onClick={() => {
                capacityPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className={cn(
                "w-full flex items-center gap-4 px-4 py-2.5 rounded-xl border shadow-sm transition-all cursor-pointer hover:shadow-md",
                staffSummary.status === 'good' && "bg-emerald-50/80 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50",
                staffSummary.status === 'warning' && "bg-amber-50/80 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/50",
                staffSummary.status === 'critical' && "bg-red-50/80 border-red-200 dark:bg-red-950/30 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/50",
              )}
            >
              {/* Status icon */}
              {staffSummary.status === 'good' ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className={cn(
                  "h-5 w-5 shrink-0",
                  staffSummary.status === 'warning' ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400 animate-pulse"
                )} />
              )}

              {/* Main count */}
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold tabular-nums">{staffSummary.totalWorking}</span>
                <span className="text-sm text-muted-foreground">de {staffSummary.totalMembers}</span>
              </div>

              {/* Separator */}
              <div className="h-6 w-px bg-border/60" />

              {/* Team breakdown */}
              <div className="flex items-center gap-3 flex-wrap">
                {staffSummary.teamBreakdown.map(tb => (
                  <div key={tb.name} className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">{tb.name}:</span>
                    <span className={cn(
                      "text-xs font-bold tabular-nums",
                      tb.working === tb.total ? "text-emerald-700 dark:text-emerald-300" :
                      tb.working >= tb.total * 0.5 ? "text-amber-700 dark:text-amber-300" :
                      "text-red-700 dark:text-red-300"
                    )}>
                      {tb.working}/{tb.total}
                    </span>
                  </div>
                ))}
              </div>

              {/* Operations */}
              {staffSummary.totalOps > 0 && (
                <>
                  <div className="h-6 w-px bg-border/60" />
                  <div className="flex items-center gap-2 text-xs">
                    {staffSummary.stats?.deliveries ? (
                      <span className="flex items-center gap-0.5 text-emerald-700 dark:text-emerald-300 font-medium">
                        <ArrowUp className="h-3 w-3" />
                        {staffSummary.stats.deliveries}
                      </span>
                    ) : null}
                    {staffSummary.stats?.returns ? (
                      <span className="flex items-center gap-0.5 text-blue-700 dark:text-blue-300 font-medium">
                        <ArrowDown className="h-3 w-3" />
                        {staffSummary.stats.returns}
                      </span>
                    ) : null}
                  </div>
                </>
              )}

              {/* Spacer + label + scroll hint */}
              <div className="ml-auto flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">{staffSummary.dateLabel}</span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/40" />
              </div>
            </button>
          </div>
        )}

        {/* ── Grid (main content — shown first) ── */}
        <div className="flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 w-full rounded-xl" />
              ))}
            </div>
          ) : !weekPublished && !canManage && !canPublish ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <CalendarClock className="h-12 w-12 text-amber-400/60 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Horarios no publicados</h3>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Los horarios de esta semana aún no han sido publicados por el administrador.
              </p>
            </div>
          ) : teams.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Users className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">No hay equipos configurados</h3>
              <p className="text-sm text-muted-foreground/60 mt-1">
                Crea equipos y asigna miembros desde la sección Teams
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {teams.map(team => (
                <TeamScheduleGrid
                  key={team.team_id}
                  team={team}
                  weekDates={weekDates}
                  scheduleLookup={scheduleLookup}
                  shiftTemplates={shiftTemplates}
                  dayStats={dayStats}
                  selectedCell={selectedCell}
                  onSelectCell={setSelectedCell}
                  onAssignShift={handleAssignShift}
                  canAssign={canAssign}
                  onReorderMember={(canAssign || canManage) ? handleReorderMember : undefined}
                  onDragReorder={(canAssign || canManage) ? handleDragReorder : undefined}
                  onSwapShifts={(canAssign || canManage) ? handleSwapShifts : undefined}
                  canManageNotes={canManageNotes}
                  noteLookup={noteLookup}
                  onSaveNote={handleSaveNote}
                  onDeleteNote={handleDeleteNote}
                  isNoteSaving={isNoteSaving}
                  hasCustomOrder={teamsWithCustomOrder.has(team.team_id)}
                />
              ))}

              {/* ── Carga Semanal & Tiempos (after all team grids) ── */}
              <div ref={capacityPanelRef} className="space-y-3 pt-2">
                <WeeklyCapacityPanel weekStartDate={weekStart} />
                <TravelTimeEditor />
              </div>
            </div>
          )}
        </div>

        {/* ── Shift Template Dialog ── */}
        <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Editar turno' : 'Nuevo turno'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={templateForm.name}
                  onChange={e => setTemplateForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ej: 7:00 - 15:00"
                />
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={templateForm.is_day_off}
                    onChange={e => setTemplateForm(f => ({ ...f, is_day_off: e.target.checked, start_time: '', end_time: '' }))}
                    className="rounded border-border"
                  />
                  <span className="text-sm">Es día libre / descanso</span>
                </label>
              </div>
              {!templateForm.is_day_off && (
                <div className="grid grid-cols-2 gap-3">
                  <TimePicker
                    label="Hora inicio"
                    value={templateForm.start_time}
                    onChange={val => setTemplateForm(f => ({ ...f, start_time: val }))}
                  />
                  <TimePicker
                    label="Hora fin"
                    value={templateForm.end_time}
                    onChange={val => setTemplateForm(f => ({ ...f, end_time: val }))}
                  />
                </div>
              )}
              <div>
                <Label>Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="color"
                    value={templateForm.color}
                    onChange={e => setTemplateForm(f => ({ ...f, color: e.target.value }))}
                    className="w-10 h-10 rounded cursor-pointer border border-border"
                  />
                  <span className="text-sm text-muted-foreground">{templateForm.color}</span>
                </div>
              </div>

              {/* Show existing templates for reference */}
              {!editingTemplate && shiftTemplates.length > 0 && (
                <div className="border-t pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Turnos existentes:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {shiftTemplates.map(t => (
                      <div key={t.id} className="flex items-center gap-1.5 group">
                        <Badge
                          variant="outline"
                          className="text-xs cursor-pointer hover:opacity-80"
                          style={{ borderColor: t.color, color: t.color }}
                          onClick={() => openEditTemplate(t)}
                        >
                          <Pencil className="h-3 w-3 mr-1 opacity-0 group-hover:opacity-100 transition-opacity" />
                          {t.name}
                        </Badge>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar turno "${t.name}"?`)) {
                              deleteTemplateMutation.mutate(t.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveTemplate}>
                {editingTemplate ? 'Guardar cambios' : 'Crear turno'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>

    {/* Confirmation dialog for unpublishing */}
    <AlertDialog open={showUnpublishConfirm} onOpenChange={setShowUnpublishConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Despublicar esta semana?</AlertDialogTitle>
          <AlertDialogDescription>
            Los empleados dejarán de ver los horarios de esta semana hasta que la vuelvas a publicar. ¿Estás seguro?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirmUnpublish} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Despublicar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </AppLayout>
  );
}

// ─── Sortable Row Helpers ────────────────────────────────────────────────────

const SortableRowContext = createContext<{
  listeners?: Record<string, Function>;
  attributes?: Record<string, any>;
}>({});

function SortableMemberRow({ memberId, canDrag, children }: { memberId: string; canDrag: boolean; children: React.ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: memberId, disabled: !canDrag });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <SortableRowContext.Provider value={{ listeners, attributes }}>
      <tr ref={setNodeRef} style={style} className={cn("group hover:bg-muted/20 transition-colors", isDragging && "bg-muted/30")}>
        {children}
      </tr>
    </SortableRowContext.Provider>
  );
}

function DragHandle() {
  const { listeners, attributes } = useContext(SortableRowContext);
  return (
    <div
      className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted/60"
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
    </div>
  );
}

// ─── Team Schedule Grid ──────────────────────────────────────────────────────

interface TeamScheduleGridProps {
  team: TeamGroup;
  weekDates: Date[];
  scheduleLookup: Map<string, ScheduleEntry>;
  shiftTemplates: ShiftTemplate[];
  dayStats: Record<string, DayStats>;
  selectedCell: { teamId: string; userId: string; date: string } | null;
  onSelectCell: (cell: { teamId: string; userId: string; date: string } | null) => void;
  onAssignShift: (userId: string, date: string, shiftTemplateId: string | null) => void;
  canAssign: boolean;
  onReorderMember?: (teamId: string, members: StaffMember[], memberIndex: number, direction: 'up' | 'down') => void;
  onDragReorder?: (teamId: string, orderedUserIds: string[], oldMembers: StaffMember[]) => void;
  onSwapShifts?: (teamId: string, members: StaffMember[], memberIndex: number, direction: 'up' | 'down') => void;
  canManageNotes: boolean;
  noteLookup: Map<string, ScheduleNote>;
  onSaveNote: (date: string, content: string, userId: string) => void;
  onDeleteNote: (noteId: string) => void;
  isNoteSaving: boolean;
  hasCustomOrder?: boolean;
}

function TeamScheduleGrid({
  team,
  weekDates,
  scheduleLookup,
  shiftTemplates,
  dayStats,
  selectedCell,
  onSelectCell,
  onAssignShift,
  canAssign,
  onReorderMember,
  onDragReorder,
  onSwapShifts,
  canManageNotes,
  noteLookup,
  onSaveNote,
  onDeleteNote,
  isNoteSaving,
  hasCustomOrder,
}: TeamScheduleGridProps) {
  // Calculate weekly hours per member
  const memberWeeklyHours = useMemo(() => {
    const result = new Map<string, number>();
    for (const member of team.members) {
      let totalHours = 0;
      for (const d of weekDates) {
        const dateStr = formatDateISO(d);
        const entry = scheduleLookup.get(`${member.id}__${dateStr}`);
        if (entry?.shift_template_id) {
          const shift = shiftTemplates.find(t => t.id === entry.shift_template_id);
          totalHours += calcShiftHours(shift || null);
        }
      }
      result.set(member.id, totalHours);
    }
    return result;
  }, [team.members, weekDates, scheduleLookup, shiftTemplates]);

  // Team total hours
  const teamTotalHours = useMemo(() => {
    let total = 0;
    memberWeeklyHours.forEach(h => { total += h; });
    return total;
  }, [memberWeeklyHours]);

  // DnD sensors for drag-and-drop reordering
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const [activeMember, setActiveMember] = useState<StaffMember | null>(null);
  const handleDragStart = (event: DragStartEvent) => {
    const member = team.members.find(m => m.id === event.active.id);
    setActiveMember(member || null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveMember(null);
    const { active, over } = event;
    if (!over || active.id === over.id || !onDragReorder) return;
    const oldIndex = team.members.findIndex(m => m.id === active.id);
    const newIndex = team.members.findIndex(m => m.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(team.members, oldIndex, newIndex);
    onDragReorder(team.team_id, reordered.map(m => m.id), team.members);
  };

  const memberIds = useMemo(() => team.members.map(m => m.id), [team.members]);

  return (
    <Card className="overflow-hidden border-border/40">
      {/* Team header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold tracking-tight">{team.team_name}</h3>
          <Badge variant="secondary" className="text-xs ml-1">
            {team.members.length}
          </Badge>
          {hasCustomOrder && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                  <ArrowUpDown className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Orden personalizado</span>
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                <p className="text-xs">El orden de los miembros ha sido personalizado para esta semana</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {teamTotalHours > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-medium">{formatHours(teamTotalHours)}</span>
            <span>total</span>
          </div>
        )}
      </div>

      <CardContent className="p-0">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[900px]">
            <thead>
              <tr>
                {/* Name column */}
                <th className="sticky left-0 z-10 bg-background w-[180px] min-w-[180px] px-3 py-2 text-left text-xs font-medium text-muted-foreground border-b border-r border-border/30">
                  Empleado
                </th>
                {/* Day columns */}
                {weekDates.map(d => {
                  const dateStr = formatDateISO(d);
                  const stats = dayStats[dateStr];
                  const today = isToday(d);
                  const isWeekend = d.getDay() === 0 || d.getDay() === 6;

                  return (
                    <th
                      key={dateStr}
                      className={cn(
                        "px-1 py-2 text-center border-b border-border/30 min-w-[110px]",
                        today && "bg-primary/5",
                        isWeekend && "bg-muted/20"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-semibold",
                        today ? "text-primary" : "text-foreground"
                      )}>
                        {formatDayLabel(d)}
                      </div>
                      <div className={cn(
                        "text-[11px]",
                        today ? "text-primary/80" : "text-muted-foreground"
                      )}>
                        {formatDateShort(d)}
                      </div>
                      {stats && (stats.deliveries > 0 || stats.returns > 0) && (
                        <div className="flex items-center justify-center gap-2 mt-1">
                          {stats.deliveries > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium">
                              <ArrowUp className="h-3 w-3" />
                              {stats.deliveries}
                            </span>
                          )}
                          {stats.returns > 0 && (
                            <span className="flex items-center gap-0.5 text-[10px] text-blue-600 font-medium">
                              <ArrowDown className="h-3 w-3" />
                              {stats.returns}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
                {/* Hours column */}
                <th className="px-3 py-2 text-center border-b border-l border-border/30 min-w-[70px] bg-muted/10">
                  <div className="flex items-center justify-center gap-1 text-xs font-medium text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    Horas
                  </div>
                </th>
              </tr>
            </thead>
            <SortableContext items={memberIds} strategy={verticalListSortingStrategy}>
            <tbody>
              {team.members.map((member, memberIndex) => {
                const weeklyHours = memberWeeklyHours.get(member.id) || 0;
                const isFirst = memberIndex === 0;
                const isLast = memberIndex === team.members.length - 1;

                return (
                  <SortableMemberRow key={member.id} memberId={member.id} canDrag={!!onDragReorder}>
                    {/* Name cell with drag handle and reorder buttons */}
                    <td className="sticky left-0 z-10 bg-background group-hover:bg-muted/20 transition-colors px-2 py-1.5 border-r border-border/30">
                      <div className="flex items-center gap-1.5">
                        {/* Drag handle — visible on hover when DnD is enabled */}
                        {onDragReorder && team.members.length > 1 && (
                          <DragHandle />
                        )}
                        {/* Reorder buttons — visible on hover (fallback for non-DnD) */}
                        {onReorderMember && !onDragReorder && team.members.length > 1 && (
                          <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => onReorderMember(team.team_id, team.members, memberIndex, 'up')}
                              disabled={isFirst}
                              className={cn(
                                "p-0 h-3.5 w-3.5 flex items-center justify-center rounded-sm transition-colors",
                                isFirst ? "text-muted-foreground/20 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                              )}
                            >
                              <ChevronLeft className="h-3 w-3 rotate-90" />
                            </button>
                            <button
                              onClick={() => onReorderMember(team.team_id, team.members, memberIndex, 'down')}
                              disabled={isLast}
                              className={cn(
                                "p-0 h-3.5 w-3.5 flex items-center justify-center rounded-sm transition-colors",
                                isLast ? "text-muted-foreground/20 cursor-default" : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                              )}
                            >
                              <ChevronRight className="h-3 w-3 rotate-90" />
                            </button>
                          </div>
                        )}
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium truncate max-w-[110px]">
                          {member.name}
                        </span>
                      </div>
                    </td>
                    {/* Schedule cells */}
                    {weekDates.map(d => {
                      const dateStr = formatDateISO(d);
                      const entry = scheduleLookup.get(`${member.id}__${dateStr}`);
                      const shift = entry?.shift_template_id
                        ? shiftTemplates.find(t => t.id === entry.shift_template_id)
                        : null;
                      const today = isToday(d);
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      const isSelected = selectedCell?.teamId === team.team_id && selectedCell?.userId === member.id && selectedCell?.date === dateStr;

                      const cellNote = noteLookup.get(`${member.id}:${dateStr}`) || null;

                      return (
                        <td
                          key={dateStr}
                          className={cn(
                            "px-1 py-1 text-center border-border/20",
                            today && "bg-primary/5",
                            isWeekend && !today && "bg-muted/20"
                          )}
                        >
                          <div className="relative group/cell">
                            {/* Excel-style note triangle */}
                            <CellNoteIndicator
                              date={dateStr}
                              userId={member.id}
                              note={cellNote}
                              canManageNotes={canManageNotes}
                              onSave={onSaveNote}
                              onDelete={onDeleteNote}
                              isSaving={isNoteSaving}
                            />
                          {canAssign ? (
                          <Popover
                            open={isSelected}
                            onOpenChange={open => {
                              if (!open) onSelectCell(null);
                            }}
                          >
                            <PopoverTrigger asChild>
                              <button
                                onClick={() => onSelectCell({ teamId: team.team_id, userId: member.id, date: dateStr })}
                                className={cn(
                                  "w-full min-h-[36px] rounded-md text-xs font-medium transition-all",
                                  "border border-transparent hover:border-primary/30 hover:shadow-sm",
                                  shift
                                    ? "text-white shadow-sm"
                                    : "text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/40"
                                )}
                                style={shift ? {
                                  backgroundColor: shift.color,
                                  opacity: shift.is_day_off ? 0.6 : 1,
                                } : undefined}
                              >
                                {shift ? (
                                  <span className="px-1">
                                    {shift.is_day_off ? shift.name : (
                                      shift.start_time && shift.end_time
                                        ? `${shift.start_time.slice(0, 5)}–${shift.end_time.slice(0, 5)}`
                                        : shift.name
                                    )}
                                  </span>
                                ) : (
                                  <Minus className="h-3 w-3 mx-auto" />
                                )}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto max-w-[320px] p-3" align="center" side="bottom">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Asignar turno
                                </p>
                                <div className="grid grid-cols-3 gap-1.5">
                                  {shiftTemplates.map(t => (
                                    <button
                                      key={t.id}
                                      onClick={() => onAssignShift(member.id, dateStr, t.id)}
                                      className={cn(
                                        "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-xs transition-colors hover:bg-muted/60 border border-transparent",
                                        entry?.shift_template_id === t.id && "bg-muted border-primary/30 ring-1 ring-primary/20"
                                      )}
                                    >
                                      <div
                                        className="w-4 h-4 rounded-full flex-shrink-0"
                                        style={{ backgroundColor: t.color }}
                                      />
                                      <span className="truncate max-w-[80px] text-center leading-tight">{t.name}</span>
                                    </button>
                                  ))}
                                  {entry?.shift_template_id && (
                                    <button
                                      onClick={() => onAssignShift(member.id, dateStr, null)}
                                      className="flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-md text-xs text-destructive hover:bg-destructive/10 transition-colors border border-transparent"
                                    >
                                      <X className="h-4 w-4" />
                                      <span>Quitar</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                          ) : (
                            <div
                              className={cn(
                                "w-full min-h-[36px] rounded-md text-xs font-medium flex items-center justify-center",
                                shift
                                  ? "text-white shadow-sm"
                                  : "text-muted-foreground/40"
                              )}
                              style={shift ? {
                                backgroundColor: shift.color,
                                opacity: shift.is_day_off ? 0.6 : 1,
                              } : undefined}
                            >
                              {shift ? (
                                <span className="px-1">
                                  {shift.is_day_off ? shift.name : (
                                    shift.start_time && shift.end_time
                                      ? `${shift.start_time.slice(0, 5)}\u2013${shift.end_time.slice(0, 5)}`
                                      : shift.name
                                  )}
                                </span>
                              ) : (
                                <Minus className="h-3 w-3 mx-auto" />
                              )}
                            </div>
                          )}
                          </div>
                        </td>
                      );
                    })}
                    {/* Weekly hours cell with shift swap arrows */}
                    <td className="px-2 py-1.5 text-center border-l border-border/30 bg-muted/10">
                      <div className="flex items-center justify-center gap-1">
                        <span className={cn(
                          "text-sm font-semibold tabular-nums",
                          weeklyHours > 0 ? "text-foreground" : "text-muted-foreground/30"
                        )}>
                          {weeklyHours > 0 ? formatHours(weeklyHours) : '—'}
                        </span>
                        {onSwapShifts && team.members.length > 1 && (
                          <div className="flex flex-col gap-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                            <button
                              onClick={() => onSwapShifts(team.team_id, team.members, memberIndex, 'up')}
                              disabled={isFirst}
                              title="Mover miembro arriba (turnos se quedan fijos)"
                              className={cn(
                                "p-0 h-3.5 w-3.5 flex items-center justify-center rounded-sm transition-colors",
                                isFirst ? "text-muted-foreground/20 cursor-default" : "text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                              )}
                            >
                              <ChevronLeft className="h-3 w-3 rotate-90" />
                            </button>
                            <button
                              onClick={() => onSwapShifts(team.team_id, team.members, memberIndex, 'down')}
                              disabled={isLast}
                              title="Mover miembro abajo (turnos se quedan fijos)"
                              className={cn(
                                "p-0 h-3.5 w-3.5 flex items-center justify-center rounded-sm transition-colors",
                                isLast ? "text-muted-foreground/20 cursor-default" : "text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                              )}
                            >
                              <ChevronRight className="h-3 w-3 rotate-90" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>
                  </SortableMemberRow>
                );
              })}
              {team.members.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                    No hay miembros en este equipo
                  </td>
                </tr>
              )}

            </tbody>
            </SortableContext>
            {/* Staff count summary row with tooltips */}
            <tfoot>
              <tr className="bg-muted/30 border-t border-border/40">
                <td className="sticky left-0 z-10 bg-muted/30 px-3 py-1.5 border-r border-border/30">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Staff</span>
                </td>
                {weekDates.map(d => {
                  const dateStr = formatDateISO(d);
                  const today = isToday(d);
                  // Count members working and collect off names
                  let working = 0;
                  const offNames: string[] = [];
                  for (const member of team.members) {
                    const entry = scheduleLookup.get(`${member.id}__${dateStr}`);
                    if (entry?.shift_template_id) {
                      const shift = shiftTemplates.find(t => t.id === entry.shift_template_id);
                      if (shift && !shift.is_day_off) {
                        working++;
                      } else if (shift?.is_day_off) {
                        offNames.push(member.name.split(' ')[0]); // First name only
                      }
                    } else {
                      // No shift assigned — count as not working
                      offNames.push(member.name.split(' ')[0]);
                    }
                  }
                  const total = team.members.length;
                  const ratio = total > 0 ? working / total : 1;

                  const badge = (
                    <span className={cn(
                      "inline-flex items-center justify-center text-[11px] font-bold tabular-nums rounded-md px-1.5 py-0.5",
                      ratio >= 0.7 ? "text-emerald-700 dark:text-emerald-300 bg-emerald-100/60 dark:bg-emerald-900/30" :
                      ratio >= 0.5 ? "text-amber-700 dark:text-amber-300 bg-amber-100/60 dark:bg-amber-900/30" :
                      "text-red-700 dark:text-red-300 bg-red-100/60 dark:bg-red-900/30"
                    )}>
                      {working}/{total}
                    </span>
                  );

                  return (
                    <td
                      key={dateStr}
                      className={cn(
                        "px-1 py-1.5 text-center",
                        today && "bg-primary/5"
                      )}
                    >
                      {offNames.length > 0 ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            {badge}
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px]">
                            <p className="text-xs font-medium mb-0.5">Descansan:</p>
                            <p className="text-xs text-muted-foreground">{offNames.join(', ')}</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : badge}
                    </td>
                  );
                })}
                {/* Empty hours cell */}
                <td className="px-3 py-1.5 border-l border-border/30 bg-muted/10" />
              </tr>
            </tfoot>
          </table>
        </div>
        <DragOverlay dropAnimation={null}>
          {activeMember && (
            <div className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg shadow-xl">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              <Avatar className="h-7 w-7">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
                  {getInitials(activeMember.name)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{activeMember.name}</span>
            </div>
          )}
        </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
}
