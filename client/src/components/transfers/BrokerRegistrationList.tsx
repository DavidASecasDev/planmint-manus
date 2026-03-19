import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Check, X, Loader2, Clock, Building2, Mail, Phone, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { BrokerRegistrationRequest } from '@/hooks/useBrokerRegistrations';

interface BrokerRegistrationListProps {
  requests: BrokerRegistrationRequest[];
  isLoading: boolean;
  onApprove: (requestId: string) => void;
  onReject: (params: { requestId: string; reason?: string }) => void;
  isApproving: boolean;
  isRejecting: boolean;
}

export function BrokerRegistrationList({
  requests,
  isLoading,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: BrokerRegistrationListProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BrokerRegistrationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const handleApprove = (request: BrokerRegistrationRequest) => {
    setProcessingId(request.id);
    onApprove(request.id);
  };

  const handleRejectClick = (request: BrokerRegistrationRequest) => {
    setSelectedRequest(request);
    setRejectReason('');
    setRejectDialogOpen(true);
  };

  const handleRejectConfirm = () => {
    if (selectedRequest) {
      setProcessingId(selectedRequest.id);
      onReject({ requestId: selectedRequest.id, reason: rejectReason || undefined });
      setRejectDialogOpen(false);
      setSelectedRequest(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-center">
        <Clock className="h-12 w-12 text-muted-foreground/50 mb-3" />
        <p className="text-muted-foreground">No hay solicitudes pendientes</p>
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Solicitante</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request) => (
            <TableRow key={request.id}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{request.name}</span>
                </div>
              </TableCell>
              <TableCell>
                {request.company ? (
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span>{request.company}</span>
                  </div>
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </TableCell>
              <TableCell>
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <span>{request.email}</span>
                  </div>
                  {request.phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <span>{request.phone}</span>
                    </div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal">
                  {format(new Date(request.created_at), "d MMM yyyy", { locale: es })}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
                    onClick={() => handleApprove(request)}
                    disabled={isApproving || isRejecting}
                  >
                    {isApproving && processingId === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4 mr-1" />
                        Aprobar
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                    onClick={() => handleRejectClick(request)}
                    disabled={isApproving || isRejecting}
                  >
                    {isRejecting && processingId === request.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <X className="h-4 w-4 mr-1" />
                        Rechazar
                      </>
                    )}
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Reject Dialog */}
      <AlertDialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rechazar Solicitud</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas rechazar la solicitud de{' '}
              <strong>{selectedRequest?.name}</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="py-4">
            <Label htmlFor="reject-reason">Motivo del rechazo (opcional)</Label>
            <Textarea
              id="reject-reason"
              placeholder="Explica el motivo del rechazo..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRejectConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Rechazar Solicitud
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
