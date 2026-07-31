import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { TransferBroker, useTransferBrokers } from '@/hooks/useTransferBrokers';
import { usePermissions } from '@/hooks/usePermissions';
import { MoreHorizontal, Pencil, Trash2, KeyRound, Mail, Phone, Building2, UserMinus, RefreshCw, Copy, Check, Loader2, AlertTriangle } from 'lucide-react';
import { apiInvoke } from '@/lib/apiClient';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BrokerPortalDialog } from './BrokerPortalDialog';
import { Skeleton } from '@/components/ui/skeleton';

interface BrokerTableProps {
  brokers: TransferBroker[];
  isLoading: boolean;
  onEdit: (broker: TransferBroker) => void;
  profileHealth?: Record<string, { has_profile: boolean; has_org: boolean }>;
}

export function BrokerTable({ brokers, isLoading, onEdit, profileHealth = {} }: BrokerTableProps) {
  const { hasPermission } = usePermissions();
  const { toggleActive, deleteBroker } = useTransferBrokers();
  const queryClient = useQueryClient();
  const [unlinkDialogOpen, setUnlinkDialogOpen] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [portalDialogOpen, setPortalDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(true);
  const [passwordCopied, setPasswordCopied] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<TransferBroker | null>(null);

  const canDelete = hasPermission('transfers.delete') || hasPermission('transfers.manage_brokers') || hasPermission('transfers.manage');

  const handleToggleActive = (broker: TransferBroker) => {
    toggleActive({ id: broker.id, is_active: !broker.is_active });
  };

  const handleDeleteClick = (broker: TransferBroker) => {
    setSelectedBroker(broker);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedBroker) {
      deleteBroker(selectedBroker.id);
    }
    setDeleteDialogOpen(false);
    setSelectedBroker(null);
  };

  const handlePortalClick = (broker: TransferBroker) => {
    setSelectedBroker(broker);
    setPortalDialogOpen(true);
  };

  const generatePassword = (length = 12): string => {
    const uppercase = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lowercase = 'abcdefghjkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%&*';
    const all = uppercase + lowercase + numbers + symbols;
    let password = '';
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];
    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }
    return password.split('').sort(() => Math.random() - 0.5).join('');
  };

  const handleResetPasswordClick = (broker: TransferBroker) => {
    setSelectedBroker(broker);
    setNewPassword(generatePassword());
    setShowNewPassword(true);
    setPasswordCopied(false);
    setResetPasswordDialogOpen(true);
  };

  const handleCopyNewPassword = async () => {
    await navigator.clipboard.writeText(newPassword);
    setPasswordCopied(true);
    toast.success('Contraseña copiada al portapapeles');
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  const handleConfirmResetPassword = async () => {
    if (!selectedBroker || !newPassword) return;
    setIsResettingPassword(true);
    try {
      const result = await apiInvoke<{ success: boolean; error?: string }>('reset-broker-password', {
        body: { brokerId: selectedBroker.id, newPassword },
      });
      if (result.error) {
        toast.error(result.error.message || 'Error al resetear contraseña');
      } else {
        toast.success('Contraseña actualizada', {
          description: `La contraseña de ${selectedBroker.name} ha sido cambiada.`,
        });
      }
    } catch (err: any) {
      toast.error(err.message || 'Error al resetear contraseña');
    } finally {
      setIsResettingPassword(false);
      setResetPasswordDialogOpen(false);
      setSelectedBroker(null);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (brokers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No hay brokers registrados</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="hidden md:table-cell">Empresa</TableHead>
              <TableHead className="hidden sm:table-cell">Contacto</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Portal</TableHead>
              <TableHead className="w-[70px]">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brokers.map((broker) => (
              <TableRow key={broker.id}>
                <TableCell>
                  <div className="font-medium">{broker.name}</div>
                  <div className="text-sm text-muted-foreground md:hidden">
                    {broker.company}
                  </div>
                </TableCell>
                <TableCell className="hidden md:table-cell">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    {broker.company || '-'}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell">
                  <div className="space-y-1">
                    {broker.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3 w-3 text-muted-foreground" />
                        <span className="truncate max-w-[150px]">{broker.email}</span>
                      </div>
                    )}
                    {broker.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {broker.phone}
                      </div>
                    )}
                    {!broker.email && !broker.phone && (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={broker.is_active}
                      onCheckedChange={() => handleToggleActive(broker)}
                      aria-label="Toggle active"
                    />
                    <span className="text-sm text-muted-foreground">
                      {broker.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                {broker.user_id ? (
                    <div className="flex items-center gap-1.5">
                      <Badge variant="secondary">
                        <KeyRound className="h-3 w-3 mr-1" />
                        Configurado
                      </Badge>
                      {profileHealth[broker.id] && !profileHealth[broker.id].has_org && (
                        <span title="Perfil incompleto: falta vinculación a organización. El broker no podrá enviar solicitudes.">
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        </span>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePortalClick(broker)}
                      className="text-xs"
                    >
                      <KeyRound className="h-3 w-3 mr-1" />
                      Configurar
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Acciones</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(broker)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      {!broker.user_id && (
                        <DropdownMenuItem onClick={() => handlePortalClick(broker)}>
                          <KeyRound className="h-4 w-4 mr-2" />
                          Configurar Portal
                        </DropdownMenuItem>
                      )}
                      {broker.user_id && (
                        <DropdownMenuItem
                          onClick={() => handleResetPasswordClick(broker)}
                        >
                          <RefreshCw className="h-4 w-4 mr-2" />
                          Resetear Contraseña
                        </DropdownMenuItem>
                      )}
                      {broker.user_id && (
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedBroker(broker);
                            setUnlinkDialogOpen(true);
                          }}
                          className="text-amber-600 focus:text-amber-600"
                        >
                          <UserMinus className="h-4 w-4 mr-2" />
                          Desvincular Portal
                        </DropdownMenuItem>
                      )}
                      {canDelete && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(broker)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar broker?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará permanentemente el broker{' '}
              <strong>{selectedBroker?.name}</strong> y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unlink Broker Portal Confirmation */}
      <AlertDialog open={unlinkDialogOpen} onOpenChange={setUnlinkDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desvincular acceso al portal?</AlertDialogTitle>
            <AlertDialogDescription>
              Se revocará el acceso al portal de brokers para{' '}
              <strong>{selectedBroker?.name}</strong>. El empleado seguirá teniendo su cuenta de PlanMint intacta, pero ya no podrá acceder al portal de brokers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUnlinking}
              onClick={async () => {
                if (!selectedBroker?.user_id) return;
                setIsUnlinking(true);
                try {
                  const { apiInvoke } = await import('@/lib/apiClient');
                  await apiInvoke('unlink-employee-as-broker', {
                    body: { memberId: selectedBroker.user_id },
                  });
                  // Invalidate broker queries for seamless UI update
                  await queryClient.invalidateQueries({ queryKey: ['transfer-brokers'], refetchType: 'active' });
                  await queryClient.invalidateQueries({ queryKey: ['transfer-brokers-all'], refetchType: 'active' });
                  toast.success('Acceso al portal revocado', {
                    description: `${selectedBroker.name} ya no tiene acceso al portal de brokers`,
                  });
                } catch (err) {
                  console.error('Error unlinking broker:', err);
                  toast.error('Error al desvincular', {
                    description: 'No se pudo revocar el acceso. Inténtalo de nuevo.',
                  });
                } finally {
                  setIsUnlinking(false);
                }
                setUnlinkDialogOpen(false);
                setSelectedBroker(null);
              }}
              className="bg-amber-600 text-white hover:bg-amber-700"
            >
              {isUnlinking ? 'Desvinculando...' : 'Desvincular'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Resetear Contraseña</DialogTitle>
            <DialogDescription>
              Nueva contraseña para <strong>{selectedBroker?.name}</strong>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nueva contraseña</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="pr-24 font-mono"
                />
                <div className="absolute right-0 top-0 h-full flex items-center gap-0.5 pr-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-transparent"
                    onClick={handleCopyNewPassword}
                    title="Copiar"
                  >
                    {passwordCopied ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 hover:bg-transparent"
                    onClick={() => {
                      setNewPassword(generatePassword());
                      setPasswordCopied(false);
                    }}
                    title="Generar nueva"
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Copia la contraseña y compártela con el broker. No podrás verla después.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResetPasswordDialogOpen(false)}
              disabled={isResettingPassword}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmResetPassword}
              disabled={isResettingPassword || newPassword.length < 6}
            >
              {isResettingPassword ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Guardando...</>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Portal Configuration Dialog */}
      {selectedBroker && (
        <BrokerPortalDialog
          open={portalDialogOpen}
          onOpenChange={setPortalDialogOpen}
          broker={selectedBroker}
        />
      )}
    </>
  );
}
