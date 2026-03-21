import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ArrowLeft, Save, ChevronDown, Plus, Trash2, Ship, Check } from 'lucide-react';
import { useTransferRequest, useTransferRequests } from '@/hooks/useTransferRequests';
import { useAuth } from '@/contexts/AuthContext';
import { useTransferItems } from '@/hooks/useTransferItems';
import { useTransferDocuments } from '@/hooks/useTransferDocuments';
import { TransferStatusBadge } from '@/components/transfers/TransferStatusBadge';
import { TransferItemBlock } from '@/components/transfers/TransferItemBlock';
import { TransferDocumentsSection } from '@/components/transfers/TransferDocumentsSection';
import { TransferFinancialSummary } from '@/components/transfers/TransferFinancialSummary';
import { TransferQuoteActions } from '@/components/transfers/TransferQuoteActions';
import { TransferNotesSection } from '@/components/transfers/TransferNotesSection';
import { StatusTimeline } from '@/components/transfers/StatusTimeline';
import { useTransferStatusHistory } from '@/hooks/useTransferStatusHistory';
import { BrokerSelect } from '@/components/transfers/BrokerSelect';
import { ProviderSelect } from '@/components/transfers/ProviderSelect';
import { useTransferBrokers } from '@/hooks/useTransferBrokers';
import { toast } from 'sonner';
import type { TransferRequest, TransferRequestStatus, TransferItem, TransferDocumentType } from '@/types/transfers';

const STATUS_OPTIONS: { value: TransferRequestStatus; label: string }[] = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'en_gestion', label: 'En gestión' },
  { value: 'presupuesto_enviado', label: 'Ppto. Enviado' },
  { value: 'confirmado', label: 'Confirmado' },
  { value: 'completado', label: 'Completado' },
  { value: 'cancelado', label: 'Cancelado' },
];

export default function TransferDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = id === 'new';

  const { data: existingRequest, isLoading, isError, error } = useTransferRequest(isNew ? undefined : id);
  const { createRequest, updateRequest, updateStatus, isCreating, isUpdating } = useTransferRequests();
  const { profile } = useAuth();
  
  // Hook at top level - always called with the current request ID
  const { createMultipleItems, isCreating: isCreatingItems } = useTransferItems(existingRequest?.id);
  const { logStatusChange } = useTransferStatusHistory(isNew ? undefined : id);
  const { applyProviderCost, isApplyingCost } = useTransferDocuments(existingRequest?.id);
  
  // Ref to track if initial items have been created (prevents double creation)
  const itemsInitialized = useRef(false);

  // Form state
  const [brokerName, setBrokerName] = useState('');
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [clientName, setClientName] = useState('');
  const [isExternalProvider, setIsExternalProvider] = useState(false);
  const [externalProviderName, setExternalProviderName] = useState('');
  const [notes, setNotes] = useState('');
  const [transferCount, setTransferCount] = useState(1);
  const [generalOpen, setGeneralOpen] = useState(true);
  const [documentsOpen, setDocumentsOpen] = useState(true);
  const [financialOpen, setFinancialOpen] = useState(true);

  const { brokers } = useTransferBrokers();

  // Load existing data and auto-resolve broker_id from broker_name
  useEffect(() => {
    if (existingRequest) {
      setBrokerName(existingRequest.broker_name);
      setClientName(existingRequest.client_name);
      setIsExternalProvider(existingRequest.is_external_provider);
      setExternalProviderName(existingRequest.external_provider_name || '');
      setNotes(existingRequest.notes || '');

      // Auto-resolve broker_id: if null or mismatched, find by name
      const existingBrokerId = existingRequest.broker_id || null;
      if (existingRequest.broker_name && brokers.length > 0) {
        const matched = brokers.find(b => b.name === existingRequest.broker_name);
        setBrokerId(matched ? matched.id : existingBrokerId);
      } else {
        setBrokerId(existingBrokerId);
      }
    }
  }, [existingRequest, brokers]);

  // Handle initial items creation from URL params (after navigation from new request)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const initItems = parseInt(params.get('initItems') || '0');
    
    if (initItems > 0 && existingRequest?.id && !itemsInitialized.current) {
      itemsInitialized.current = true;
      createMultipleItems(initItems).then(() => {
        toast.success(`${initItems} transfer${initItems !== 1 ? 's' : ''} creado${initItems !== 1 ? 's' : ''}`);
        // Clean URL params
        navigate(location.pathname, { replace: true });
      }).catch((err) => {
        console.error('Error creating initial items:', err);
        itemsInitialized.current = false; // Allow retry on error
      });
    }
  }, [existingRequest?.id, location.search, location.pathname, navigate, createMultipleItems]);

  const handleSave = async () => {
    if (!brokerName.trim() || !clientName.trim()) {
      toast.error('Broker y Cliente son requeridos');
      return;
    }

    try {
      if (isNew) {
        const newRequest = await createRequest({
          broker_name: brokerName.trim(),
          broker_id: brokerId,
          client_name: clientName.trim(),
          is_external_provider: isExternalProvider,
          external_provider_name: isExternalProvider ? externalProviderName.trim() : null,
          notes: notes.trim() || null,
        });

        // Navigate with initItems param - items will be created by useEffect in new page load
        if (transferCount > 0 && newRequest?.id) {
          navigate(`/transfers/${newRequest.id}?initItems=${transferCount}`);
        } else if (newRequest?.id) {
          navigate(`/transfers/${newRequest.id}`);
        } else {
          navigate('/transfers');
        }
      } else {
        updateRequest({
          id: id!,
          broker_name: brokerName.trim(),
          broker_id: brokerId,
          client_name: clientName.trim(),
          is_external_provider: isExternalProvider,
          external_provider_name: isExternalProvider ? externalProviderName.trim() : null,
          notes: notes.trim() || null,
        });
      }
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const handleStatusChange = async (status: TransferRequestStatus) => {
    if (id && !isNew) {
      const previousStatus = existingRequest?.status || null;
      updateStatus({ id, status });
      try {
        await logStatusChange({
          request_id: id,
          organization_id: profile?.organization_id || '',
          previous_status: previousStatus,
          new_status: status,
          changed_by_type: 'admin',
          changed_by_id: profile?.id,
          changed_by_name: profile?.name || 'Admin',
        });
      } catch (e) {
        console.error('Failed to log status change:', e);
      }
    }
  };

  const handleAddTransfer = async () => {
    if (existingRequest?.id) {
      await createMultipleItems(1);
      toast.success('Transfer añadido');
    }
  };

  if (isLoading && !isNew) {
    return (
      <AppLayout title="Transfer">
        <div className="container max-w-4xl py-6 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </AppLayout>
    );
  }

  // Show informative message when the transfer request was deleted or doesn't exist
  if (!isNew && !isLoading && (isError || !existingRequest)) {
    return (
      <AppLayout title="Solicitud no encontrada">
        <div className="container max-w-lg py-16">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Ship className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Solicitud no disponible</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Esta solicitud de transfer fue eliminada o ya no existe. Es posible que haya sido borrada por un administrador.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button onClick={() => navigate('/transfers')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver a Transfers
              </Button>
              <Button variant="outline" onClick={() => navigate('/notifications')} className="gap-2">
                Ver notificaciones
              </Button>
            </div>
            {id && (
              <p className="text-xs text-muted-foreground/60 font-mono">
                ID: {id}
              </p>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  const items = (existingRequest?.items || []) as TransferItem[];

  return (
    <AppLayout title={isNew ? 'Nuevo Transfer' : 'Transfer'}>
      <div className="container max-w-4xl py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/transfers')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">
                {isNew ? 'Nueva Solicitud de Transfer' : existingRequest?.request_number}
              </h1>
              {!isNew && existingRequest && (
                <div className="flex items-center gap-2 mt-1">
                  <TransferStatusBadge status={existingRequest.status} />
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isNew && (
              <Select value={existingRequest?.status} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button onClick={handleSave} disabled={isCreating || isUpdating} className="gap-2">
              <Save className="h-4 w-4" />
              Guardar
            </Button>
            {!isNew && existingRequest?.status !== 'confirmado' && (
              <Button 
                variant="outline" 
                onClick={() => handleStatusChange('confirmado')}
                className="gap-2"
              >
                <Check className="h-4 w-4" />
                Confirmar
              </Button>
            )}
          </div>
        </div>

        {/* General Information */}
        <Collapsible open={generalOpen} onOpenChange={setGeneralOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Información General</CardTitle>
                  <ChevronDown className={`h-5 w-5 transition-transform ${generalOpen ? 'rotate-180' : ''}`} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="broker">Broker *</Label>
                    <BrokerSelect
                      value={brokerName}
                      onChange={(name, id) => {
                        setBrokerName(name);
                        setBrokerId(id);
                      }}
                      placeholder="Seleccionar broker..."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client">Cliente *</Label>
                    <Input
                      id="client"
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      placeholder="Nombre del cliente"
                    />
                  </div>
                </div>

                {isNew && (
                  <div className="space-y-2">
                    <Label htmlFor="transferCount">Cantidad de transfers</Label>
                    <Input
                      id="transferCount"
                      type="number"
                      min={0}
                      max={20}
                      value={transferCount}
                      onChange={(e) => setTransferCount(parseInt(e.target.value) || 0)}
                      className="w-32"
                    />
                    <p className="text-sm text-muted-foreground">
                      Se crearán {transferCount} transfer{transferCount !== 1 ? 's' : ''} vacíos para rellenar
                    </p>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="external"
                      checked={isExternalProvider}
                      onCheckedChange={(checked) => setIsExternalProvider(!!checked)}
                    />
                    <Label htmlFor="external" className="cursor-pointer">
                      Empresa externa
                    </Label>
                  </div>
                  {isExternalProvider && (
                    <div className="space-y-2">
                      <Label>Proveedor externo</Label>
                      <ProviderSelect
                        value={externalProviderName}
                        onChange={setExternalProviderName}
                        placeholder="Seleccionar proveedor..."
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Notas adicionales..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Documents Section */}
        {!isNew && existingRequest && (
          <Collapsible open={documentsOpen} onOpenChange={setDocumentsOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Documentos</CardTitle>
                    <ChevronDown className={`h-5 w-5 transition-transform ${documentsOpen ? 'rotate-180' : ''}`} />
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <TransferDocumentsSection 
                    requestId={existingRequest.id}
                    documents={existingRequest.documents || []}
                    onApplyCost={(cost, docType, items) => applyProviderCost({ providerCost: cost, documentType: docType, items })}
                    isApplyingCost={isApplyingCost}
                  />
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Financial Summary - Internal only */}
        {!isNew && existingRequest && existingRequest.is_external_provider && (
          <TransferFinancialSummary
            providerCost={existingRequest.provider_cost}
            clientTotal={existingRequest.client_total}
            internalMargin={existingRequest.internal_margin}
            isExternalProvider={existingRequest.is_external_provider}
          />
        )}

        {/* Client Documents - Quotes & Invoices */}
        {!isNew && existingRequest && (
          <TransferQuoteActions 
            request={existingRequest} 
            items={items} 
          />
        )}

        {/* Transfer Items */}
        {!isNew && existingRequest && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Transfers ({items.length})
              </h2>
              <Button variant="outline" size="sm" onClick={handleAddTransfer} disabled={isCreatingItems} className="gap-2">
                <Plus className="h-4 w-4" />
                Añadir Transfer
              </Button>
            </div>

            {items.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                  <Ship className="h-10 w-10 text-muted-foreground/50 mb-3" />
                  <p className="text-muted-foreground">No hay transfers todavía</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleAddTransfer} 
                    disabled={isCreatingItems}
                    className="mt-3 gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Añadir Transfer
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {items
                  .sort((a, b) => {
                    // Items sin fecha van al final
                    if (!a.transfer_date && !b.transfer_date) return a.position - b.position;
                    if (!a.transfer_date) return 1;
                    if (!b.transfer_date) return -1;
                    
                    // Ordenar por fecha
                    const dateCompare = new Date(a.transfer_date).getTime() - new Date(b.transfer_date).getTime();
                    if (dateCompare !== 0) return dateCompare;
                    
                    // Si misma fecha, ordenar por hora de recogida
                    if (!a.pickup_time && !b.pickup_time) return a.position - b.position;
                    if (!a.pickup_time) return 1;
                    if (!b.pickup_time) return -1;
                    return a.pickup_time.localeCompare(b.pickup_time);
                  })
                  .map((item, index) => (
                    <TransferItemBlock
                      key={item.id}
                      item={item}
                      index={index}
                      requestId={existingRequest.id}
                    />
                  ))}
              </div>
            )}

            {/* Status History Timeline */}
            {existingRequest && (
              <StatusTimeline requestId={existingRequest.id} isDark={false} />
            )}

            {/* Internal Notes */}
            {existingRequest && profile?.organization_id && (
              <TransferNotesSection
                requestId={existingRequest.id}
                organizationId={profile.organization_id}
                currentBrokerId={null}
                currentAuthorName={profile.name || 'Admin'}
                isDark={false}
              />
            )}

            {/* Total Summary */}
            {items.length > 0 && (() => {
              const subtotal = items.reduce((sum, it) => sum + (it.price_with_commission || 0), 0);
              const iva = subtotal * 0.21;
              const total = subtotal + iva;
              if (subtotal <= 0) return null;
              return (
                <Card className="border-primary/20 bg-primary/5">
                  <CardContent className="p-4 space-y-2">
                    <h4 className="font-medium text-primary text-sm mb-3">
                      Resumen Total ({items.length} transfer{items.length !== 1 ? 's' : ''})
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-muted-foreground">
                        <span>Subtotal (sin IVA):</span>
                        <span>{new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(subtotal)} €</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>IVA 21%:</span>
                        <span>{new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(iva)} €</span>
                      </div>
                      <div className="border-t pt-2 mt-2 flex justify-between font-bold text-primary">
                        <span>TOTAL CON IVA:</span>
                        <span>{new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total)} €</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
