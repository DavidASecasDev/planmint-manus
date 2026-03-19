import { useState } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ListTodo, Plus, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMilestones } from '@/hooks/useMilestones';
import { MilestoneItem } from './MilestoneItem';
import { MilestoneEditDialog } from './MilestoneEditDialog';
import { ResponsablesSection } from './ResponsablesSection';
import { Milestone, MilestoneStatus } from '@/types/milestones';

interface MilestonesSectionProps {
  taskId: string;
  canEdit: boolean;
  canChangeStatus?: boolean;
  onMilestoneChange?: () => void;
}

export function MilestonesSection({ taskId, canEdit, canChangeStatus = false, onMilestoneChange }: MilestonesSectionProps) {
  const {
    milestonesTree,
    totalMilestones,
    completedMilestones,
    progressPercentage,
    createMilestone,
    updateMilestone,
    updateMilestoneStatus,
    deleteMilestone,
    reorderMilestones,
    milestones,
  } = useMilestones(taskId);

  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('milestones');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleAddMilestone = () => {
    if (newMilestoneTitle.trim()) {
      createMilestone.mutate({
        task_id: taskId,
        title: newMilestoneTitle.trim(),
      });
      setNewMilestoneTitle('');
    }
  };

  const handleAddSubMilestone = (parentId: string, title: string) => {
    createMilestone.mutate({
      task_id: taskId,
      parent_milestone_id: parentId,
      title,
    });
  };

  const handleStatusChange = (id: string, status: MilestoneStatus) => {
    updateMilestoneStatus.mutate({ id, status }, {
      onSuccess: () => onMilestoneChange?.(),
    });
  };

  const handleEdit = (milestone: Milestone) => {
    setEditingMilestone(milestone);
    setShowEditDialog(true);
  };

  const handleSaveEdit = (data: { 
    title: string; 
    description?: string | null; 
    status: MilestoneStatus; 
    due_date: string | null;
    assignee_type?: 'user' | 'team' | null;
    assignee_id?: string | null;
  }) => {
    if (editingMilestone) {
      updateMilestone.mutate({
        id: editingMilestone.id,
        data: {
          title: data.title,
          description: data.description,
          status: data.status,
          due_date: data.due_date,
          assignee_type: data.assignee_type,
          assignee_id: data.assignee_id,
        },
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteMilestone.mutate(id);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const activeItem = milestones.find(m => m.id === active.id);
      const overItem = milestones.find(m => m.id === over.id);

      if (!activeItem || !overItem) return;

      // Only allow reordering within same parent level
      if (activeItem.parent_milestone_id !== overItem.parent_milestone_id) return;

      const parentId = activeItem.parent_milestone_id;
      const siblings = milestones
        .filter(m => m.parent_milestone_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order);

      const oldIndex = siblings.findIndex(m => m.id === active.id);
      const newIndex = siblings.findIndex(m => m.id === over.id);

      const newOrder = [...siblings];
      const [removed] = newOrder.splice(oldIndex, 1);
      newOrder.splice(newIndex, 0, removed);

      const updates = newOrder.map((m, index) => ({
        id: m.id,
        sort_order: index,
        parent_milestone_id: m.parent_milestone_id,
      }));

      reorderMilestones.mutate(updates);
    }
  };

  const handleMilestoneClick = (milestoneId: string) => {
    // Switch to milestones tab and scroll to milestone
    setActiveTab('milestones');
    // Could implement scrolling to specific milestone here
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListTodo className="h-5 w-5" />
            Hitos del proyecto
          </CardTitle>
        </div>
        {/* Progress Summary */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              {completedMilestones} de {totalMilestones} hitos completados
            </span>
            <span className="font-medium">{progressPercentage}%</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="milestones" className="flex items-center gap-2">
              <ListTodo className="h-4 w-4" />
              Hitos
            </TabsTrigger>
            <TabsTrigger value="responsables" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Responsables
            </TabsTrigger>
          </TabsList>

          <TabsContent value="milestones" className="mt-4 space-y-4">
            {/* Milestones List */}
            {totalMilestones === 0 ? (
              <div className="text-center py-6 text-muted-foreground">
                <ListTodo className="h-10 w-10 mx-auto mb-2 opacity-50" />
                <p>Aún no has creado hitos para este objetivo</p>
                {canEdit && <p className="text-sm">Añade el primer hito abajo</p>}
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={milestonesTree.map(m => m.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1">
                    {milestonesTree.map((milestone) => (
                      <MilestoneItem
                        key={milestone.id}
                        milestone={milestone}
                        canEdit={canEdit}
                        canChangeStatus={canChangeStatus}
                        onStatusChange={handleStatusChange}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onAddSubMilestone={handleAddSubMilestone}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Add New Milestone */}
            {canEdit && (
              <div className="flex items-center gap-2 pt-2 border-t">
                <Input
                  value={newMilestoneTitle}
                  onChange={(e) => setNewMilestoneTitle(e.target.value)}
                  placeholder="Añadir nuevo hito..."
                  className="flex-1"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddMilestone();
                  }}
                />
                <Button onClick={handleAddMilestone} disabled={!newMilestoneTitle.trim()}>
                  <Plus className="h-4 w-4 mr-1" />
                  Añadir
                </Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="responsables" className="mt-4">
            <ResponsablesSection 
              milestones={milestones} 
              onMilestoneClick={handleMilestoneClick}
            />
          </TabsContent>
        </Tabs>

        {/* Edit Dialog */}
        <MilestoneEditDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          milestone={editingMilestone}
          onSave={handleSaveEdit}
        />
      </CardContent>
    </Card>
  );
}
