import { useState } from 'react';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RepairDetailHeader } from './repair-detail/RepairDetailHeader';
import { RepairGeneralTab } from './repair-detail/RepairGeneralTab';
import { RepairCommentsTab } from './repair-detail/RepairCommentsTab';
import { RepairHistoryTab } from './repair-detail/RepairHistoryTab';
import { RepairPhotosTab } from './repair-detail/RepairPhotosTab';
import { RepairInvoicesTab } from './repair-detail/RepairInvoicesTab';
import { RepairFormDialog } from './RepairFormDialog';
import type { Repair } from '@/types/garatech';

interface RepairDetailSheetProps {
  repair: Repair | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RepairDetailSheet({ repair, open, onOpenChange }: RepairDetailSheetProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  if (!repair) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          <VisuallyHidden><SheetTitle>Detalle de reparación</SheetTitle></VisuallyHidden>
          <RepairDetailHeader repair={repair} onEdit={() => setEditDialogOpen(true)} />

          <Tabs defaultValue="general" className="mt-6">
            <TabsList className="grid grid-cols-5 mb-4">
              <TabsTrigger value="general" className="text-xs sm:text-sm">General</TabsTrigger>
              <TabsTrigger value="comments" className="text-xs sm:text-sm">Comentarios</TabsTrigger>
              <TabsTrigger value="history" className="text-xs sm:text-sm">Historial</TabsTrigger>
              <TabsTrigger value="photos" className="text-xs sm:text-sm">Fotos</TabsTrigger>
              <TabsTrigger value="invoices" className="text-xs sm:text-sm">Facturas</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-0">
              <RepairGeneralTab repair={repair} />
            </TabsContent>

            <TabsContent value="comments" className="mt-0">
              <RepairCommentsTab repairId={repair.id} />
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <RepairHistoryTab repairId={repair.id} />
            </TabsContent>

            <TabsContent value="photos" className="mt-0">
              <RepairPhotosTab repairId={repair.id} />
            </TabsContent>

            <TabsContent value="invoices" className="mt-0">
              <RepairInvoicesTab repairId={repair.id} />
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      <RepairFormDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        repair={repair}
      />
    </>
  );
}
