import { useState } from 'react';
import { Upload, Table } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReservationsTable } from '@/components/reservations/ReservationsTable';
import { ImportReservations } from '@/components/reservations/ImportReservations';
import { SyncRentlyDialog } from '@/components/reservations/SyncRentlyDialog';
import { useRentlySyncContext } from '@/contexts/RentlySyncContext';

export default function Reservations() {
  const [activeTab, setActiveTab] = useState('table');
  const { syncDialogOpen, setSyncDialogOpen } = useRentlySyncContext();

  const handleSyncComplete = () => {
    // The table should refetch automatically via react-query
  };

  return (
    <AppLayout title="Programación" fullWidth>
      <div className="flex flex-col h-full">
        <div className="shrink-0">
          <PageHeader
            title="Programación"
            description="Gestiona las operaciones del día: entregas, devoluciones y transfers"
          />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0 mt-6">
          <TabsList className="shrink-0">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <Table className="h-4 w-4" />
              Vista tabla
            </TabsTrigger>
            <TabsTrigger value="import" className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Importar
            </TabsTrigger>
          </TabsList>

          <TabsContent value="table" className="mt-6 flex-1 min-h-0">
            <ReservationsTable />
          </TabsContent>

          <TabsContent value="import" className="mt-6 flex-1 min-h-0 overflow-auto">
            <ImportReservations />
          </TabsContent>
        </Tabs>
      </div>

      <SyncRentlyDialog
        open={syncDialogOpen}
        onOpenChange={setSyncDialogOpen}
        onSyncComplete={handleSyncComplete}
      />
    </AppLayout>
  );
}
