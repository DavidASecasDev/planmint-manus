import { useState } from 'react';
import { GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { KanbanColumn } from '@/types/kanban';

const PRESET_COLORS = [
  '#6b7280', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#14b8a6', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

interface KanbanConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  columns: KanbanColumn[];
  onUpdateColumn: (id: string, updates: Partial<Pick<KanbanColumn, 'label' | 'color' | 'is_visible'>>) => Promise<boolean>;
  onReorderColumns: (columns: KanbanColumn[]) => Promise<boolean>;
}

export function KanbanConfigDialog({
  open,
  onOpenChange,
  columns,
  onUpdateColumn,
  onReorderColumns,
}: KanbanConfigDialogProps) {
  const [localColumns, setLocalColumns] = useState<KanbanColumn[]>(columns);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Sync with parent columns when dialog opens
  useState(() => {
    setLocalColumns(columns);
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localColumns.findIndex((col) => col.id === active.id);
      const newIndex = localColumns.findIndex((col) => col.id === over.id);

      const newColumns = arrayMove(localColumns, oldIndex, newIndex);
      setLocalColumns(newColumns);
    }
  };

  const handleLabelChange = (id: string, label: string) => {
    setLocalColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, label } : col))
    );
  };

  const handleColorChange = (id: string, color: string) => {
    setLocalColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, color } : col))
    );
  };

  const handleVisibilityChange = (id: string, is_visible: boolean) => {
    // Ensure at least one column stays visible
    const visibleCount = localColumns.filter((c) => c.is_visible).length;
    if (!is_visible && visibleCount <= 1) {
      return;
    }

    setLocalColumns((prev) =>
      prev.map((col) => (col.id === id ? { ...col, is_visible } : col))
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save reorder first
      await onReorderColumns(localColumns);

      // Save individual column updates
      for (const col of localColumns) {
        const original = columns.find((c) => c.id === col.id);
        if (original) {
          const updates: Partial<Pick<KanbanColumn, 'label' | 'color' | 'is_visible'>> = {};
          if (original.label !== col.label) updates.label = col.label;
          if (original.color !== col.color) updates.color = col.color;
          if (original.is_visible !== col.is_visible) updates.is_visible = col.is_visible;

          if (Object.keys(updates).length > 0) {
            await onUpdateColumn(col.id, updates);
          }
        }
      }

      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Configurar columnas del tablero</DialogTitle>
          <DialogDescription>
            Personaliza la visibilidad, nombres y colores de las columnas del tablero Kanban.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={localColumns.map((col) => col.id)}
              strategy={verticalListSortingStrategy}
            >
              {localColumns.map((column) => (
                <SortableColumnItem
                  key={column.id}
                  column={column}
                  onLabelChange={handleLabelChange}
                  onColorChange={handleColorChange}
                  onVisibilityChange={handleVisibilityChange}
                  canHide={localColumns.filter((c) => c.is_visible).length > 1}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar cambios'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface SortableColumnItemProps {
  column: KanbanColumn;
  onLabelChange: (id: string, label: string) => void;
  onColorChange: (id: string, color: string) => void;
  onVisibilityChange: (id: string, is_visible: boolean) => void;
  canHide: boolean;
}

function SortableColumnItem({
  column,
  onLabelChange,
  onColorChange,
  onVisibilityChange,
  canHide,
}: SortableColumnItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const statusLabels: Record<string, string> = {
    pending: 'Pendiente',
    in_progress: 'En progreso',
    blocked: 'Bloqueado',
    completed: 'Completada',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 p-3 border rounded-lg bg-card"
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
      >
        <GripVertical className="h-5 w-5" />
      </div>

      <div
        className="w-4 h-4 rounded-full shrink-0"
        style={{ backgroundColor: column.color }}
      />

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            {statusLabels[column.status] || column.status}
          </Badge>
        </div>

        <div className="space-y-2">
          <div>
            <Label className="text-xs text-muted-foreground">Nombre visible</Label>
            <Input
              value={column.label}
              onChange={(e) => onLabelChange(column.id, e.target.value)}
              className="h-8"
            />
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Color</Label>
            <div className="flex flex-wrap gap-1 mt-1">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => onColorChange(column.id, color)}
                  className={`w-6 h-6 rounded-full border-2 transition-all ${
                    column.color === color
                      ? 'border-foreground scale-110'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Visible</Label>
        <Switch
          checked={column.is_visible}
          onCheckedChange={(checked) => onVisibilityChange(column.id, checked)}
          disabled={!canHide && column.is_visible}
        />
      </div>
    </div>
  );
}
