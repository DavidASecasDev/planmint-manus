import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { AreaList } from '@/components/areas/AreaList';
import { AreaForm } from '@/components/areas/AreaForm';
import { AreaDetail } from '@/components/areas/AreaDetail';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { useAreas } from '@/hooks/useAreas';
import { usePlanLimits } from '@/hooks/usePlanLimits';
import { Area, CreateAreaData } from '@/types/areas';
import { toast } from 'sonner';

export default function Areas() {
  const {
    areas,
    loading,
    filter,
    setFilter,
    searchQuery,
    setSearchQuery,
    canCreate,
    canEdit,
    canDelete,
    createArea,
    updateArea,
    archiveArea,
    deleteArea,
  } = useAreas();

  const { canCreateArea, isLoading: planLimitsLoading } = usePlanLimits();

  const [formOpen, setFormOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [viewingArea, setViewingArea] = useState<Area | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [limitMessage, setLimitMessage] = useState('');

  const handleCreateClick = () => {
    // Guard: si los límites aún están cargando, mostrar toast y esperar
    if (planLimitsLoading) {
      toast.info('Cargando información de tu plan...');
      return;
    }
    
    const limitCheck = canCreateArea();
    if (!limitCheck.allowed) {
      // Si el mensaje es de "cargando", mostrar toast en lugar de modal
      if (limitCheck.message.includes('Cargando')) {
        toast.info(limitCheck.message);
        return;
      }
      setLimitMessage(limitCheck.message);
      setUpgradeModalOpen(true);
      return;
    }
    setEditingArea(null);
    setFormOpen(true);
  };

  const handleEdit = (area: Area) => {
    setEditingArea(area);
    setFormOpen(true);
  };

  const handleView = (area: Area) => {
    setViewingArea(area);
    setDetailOpen(true);
  };

  const handleFormSubmit = async (
    data: CreateAreaData & { is_archived?: boolean },
    accessSubjects?: Array<{ type: 'user' | 'role' | 'team'; id: string }>
  ) => {
    if (editingArea) {
      return await updateArea(editingArea.id, data, accessSubjects);
    } else {
      return await createArea(data, accessSubjects);
    }
  };

  return (
    <AppLayout title="Áreas">
      <AreaList
        areas={areas}
        loading={loading}
        filter={filter}
        searchQuery={searchQuery}
        canCreate={canCreate}
        canEdit={canEdit}
        canDelete={canDelete}
        onFilterChange={setFilter}
        onSearchChange={setSearchQuery}
        onCreateClick={handleCreateClick}
        onView={handleView}
        onEdit={handleEdit}
        onArchive={archiveArea}
        onDelete={deleteArea}
      />

      <AreaForm
        open={formOpen}
        onOpenChange={setFormOpen}
        area={editingArea}
        onSubmit={handleFormSubmit}
      />

      <AreaDetail
        area={viewingArea}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        canEdit={canEdit}
        onEdit={handleEdit}
        onArchive={archiveArea}
      />

      <UpgradeModal
        open={upgradeModalOpen}
        onOpenChange={setUpgradeModalOpen}
        limitMessage={limitMessage}
      />
    </AppLayout>
  );
}
