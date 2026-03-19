import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Pencil, Trash2, Plus, ChevronDown, ChevronRight, Calendar, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Milestone, MilestoneStatus, MILESTONE_STATUS_OPTIONS } from '@/types/milestones';
import { cn } from '@/lib/utils';

interface MilestoneItemProps {
  milestone: Milestone;
  canEdit: boolean;
  canChangeStatus?: boolean;
  onStatusChange: (id: string, status: MilestoneStatus) => void;
  onEdit: (milestone: Milestone) => void;
  onDelete: (id: string) => void;
  onAddSubMilestone: (parentId: string, title: string) => void;
  isTopLevel?: boolean;
}

const getStatusIcon = (status: MilestoneStatus) => {
  switch (status) {
    case 'done':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'in_progress':
      return <Clock className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
};

export function MilestoneItem({
  milestone,
  canEdit,
  canChangeStatus = false,
  onStatusChange,
  onEdit,
  onDelete,
  onAddSubMilestone,
  isTopLevel = true,
}: MilestoneItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddSub, setShowAddSub] = useState(false);
  const [newSubTitle, setNewSubTitle] = useState('');

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: milestone.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasChildren = milestone.children && milestone.children.length > 0;

  const canChangeThisStatus = canEdit || canChangeStatus;

  const cycleStatus = () => {
    if (!canChangeThisStatus) return;
    const currentIndex = MILESTONE_STATUS_OPTIONS.findIndex(o => o.value === milestone.status);
    const nextIndex = (currentIndex + 1) % MILESTONE_STATUS_OPTIONS.length;
    onStatusChange(milestone.id, MILESTONE_STATUS_OPTIONS[nextIndex].value);
  };

  const statusOption = MILESTONE_STATUS_OPTIONS.find(o => o.value === milestone.status);

  const handleAddSubMilestone = () => {
    if (newSubTitle.trim()) {
      onAddSubMilestone(milestone.id, newSubTitle.trim());
      setNewSubTitle('');
      setShowAddSub(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group',
        isDragging && 'opacity-50'
      )}
    >
      <div className={cn(
        'flex items-center gap-2.5 p-2.5 rounded-lg transition-all duration-200',
        'hover:bg-muted/50 border border-transparent hover:border-border/50',
        !isTopLevel && 'ml-6 border-l-2 border-muted pl-4 rounded-l-none',
        milestone.status === 'done' && 'bg-muted/30'
      )}>
        {canEdit && (
          <button
            {...attributes}
            {...listeners}
            className="touch-none text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing transition-colors"
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}

        {hasChildren && (
          <button 
            onClick={() => setIsExpanded(!isExpanded)} 
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}

        <button
          onClick={cycleStatus}
          disabled={!canChangeThisStatus}
          className={cn(
            "shrink-0 transition-all duration-200",
            canChangeThisStatus && "hover:scale-110"
          )}
        >
          <Badge 
            variant="secondary" 
            className={cn(
              'text-xs cursor-pointer transition-all duration-200 gap-1.5',
              statusOption?.color
            )}
          >
            {getStatusIcon(milestone.status)}
            {statusOption?.label}
          </Badge>
        </button>

        <span className={cn(
          'flex-1 text-sm font-medium transition-all duration-200',
          milestone.status === 'done' && 'line-through text-muted-foreground'
        )}>
          {milestone.title}
        </span>

        {milestone.due_date && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            {format(new Date(milestone.due_date), 'dd MMM', { locale: es })}
          </span>
        )}

        {canEdit && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {isTopLevel && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setShowAddSub(!showAddSub)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onEdit(milestone)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Add sub-milestone form */}
      {showAddSub && canEdit && (
        <div className="ml-12 mt-2 flex items-center gap-2">
          <Input
            value={newSubTitle}
            onChange={(e) => setNewSubTitle(e.target.value)}
            placeholder="Nombre del sub-hito..."
            className="h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddSubMilestone();
              if (e.key === 'Escape') {
                setShowAddSub(false);
                setNewSubTitle('');
              }
            }}
            autoFocus
          />
          <Button size="sm" className="h-9" onClick={handleAddSubMilestone}>
            Añadir
          </Button>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-9" 
            onClick={() => {
              setShowAddSub(false);
              setNewSubTitle('');
            }}
          >
            Cancelar
          </Button>
        </div>
      )}

      {/* Render children */}
      {hasChildren && isExpanded && (
        <div className="mt-1.5 space-y-1">
          {milestone.children!.map((child) => (
            <MilestoneItem
              key={child.id}
              milestone={child}
              canEdit={canEdit}
              canChangeStatus={canChangeStatus}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSubMilestone={onAddSubMilestone}
              isTopLevel={false}
            />
          ))}
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar hito?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El hito "{milestone.title}" 
              {hasChildren && ' y todos sus sub-hitos'} será(n) eliminado(s) permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onDelete(milestone.id);
                setShowDeleteDialog(false);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
