import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Loader2, Plus, Pencil, Trash2, Car, Building } from 'lucide-react';
import { useTransferBrokers, TransferBroker } from '@/hooks/useTransferBrokers';
import { useTransferProviders, TransferProvider } from '@/hooks/useTransferProviders';
import { TransferInvoiceSettings } from './TransferInvoiceSettings';

export function TransferSettingsSection() {
  return (
    <div className="space-y-6">
      <TransferInvoiceSettings />
      <BrokersSection />
      <ProvidersSection />
    </div>
  );
}

function BrokersSection() {
  const { allBrokers, isLoadingAll, createBroker, updateBroker, deleteBroker, isCreating } = useTransferBrokers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBroker, setEditingBroker] = useState<TransferBroker | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState('');

  const handleOpenCreate = () => {
    setEditingBroker(null);
    setName('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (broker: TransferBroker) => {
    setEditingBroker(broker);
    setName(broker.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editingBroker) {
      updateBroker({ id: editingBroker.id, name: name.trim() });
    } else {
      await createBroker({ name: name.trim() });
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteBroker(deletingId);
      setDeletingId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Brokers de Yates</CardTitle>
            </div>
            <Button size="sm" onClick={handleOpenCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          </div>
          <CardDescription>Empresas que solicitan transfers</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAll ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allBrokers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay brokers configurados
            </p>
          ) : (
            <div className="space-y-2">
              {allBrokers.map((broker) => (
                <div
                  key={broker.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 group"
                >
                  <span className={broker.is_active ? '' : 'text-muted-foreground line-through'}>
                    {broker.name}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenEdit(broker)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(broker.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingBroker ? 'Editar Broker' : 'Añadir Broker'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="broker-name">Nombre</Label>
            <Input
              id="broker-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del broker"
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isCreating || !name.trim()}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingBroker ? 'Guardar' : 'Añadir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar broker?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El broker se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function ProvidersSection() {
  const { allProviders, isLoadingAll, createProvider, updateProvider, deleteProvider, isCreating } = useTransferProviders();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState<TransferProvider | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState('');

  const handleOpenCreate = () => {
    setEditingProvider(null);
    setName('');
    setDialogOpen(true);
  };

  const handleOpenEdit = (provider: TransferProvider) => {
    setEditingProvider(provider);
    setName(provider.name);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    if (editingProvider) {
      updateProvider({ id: editingProvider.id, name: name.trim() });
    } else {
      await createProvider(name.trim());
    }
    setDialogOpen(false);
  };

  const handleDelete = () => {
    if (deletingId) {
      deleteProvider(deletingId);
      setDeletingId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Proveedores Externos</CardTitle>
            </div>
            <Button size="sm" onClick={handleOpenCreate} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Añadir
            </Button>
          </div>
          <CardDescription>Empresas que realizan los transfers</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingAll ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : allProviders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No hay proveedores configurados
            </p>
          ) : (
            <div className="space-y-2">
              {allProviders.map((provider) => (
                <div
                  key={provider.id}
                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50 group"
                >
                  <span className={provider.is_active ? '' : 'text-muted-foreground line-through'}>
                    {provider.name}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenEdit(provider)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeletingId(provider.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>{editingProvider ? 'Editar Proveedor' : 'Añadir Proveedor'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="provider-name">Nombre</Label>
            <Input
              id="provider-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del proveedor"
              className="mt-2"
              onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isCreating || !name.trim()}>
              {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingProvider ? 'Guardar' : 'Añadir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar proveedor?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El proveedor se eliminará permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
