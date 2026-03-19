import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { useForms } from "@/hooks/useForms";
import { usePermissions } from "@/hooks/usePermissions";
import { useOrganizationModules } from "@/hooks/useOrganizationModules";
import { Form } from "@/types/forms";
import { FormCard } from "@/components/forms/FormCard";
import { FormResponsesDialog } from "@/components/forms/FormResponsesDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Loader2, ShieldAlert, Car, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Forms() {
  const navigate = useNavigate();
  const { forms, isLoading, updateForm, deleteForm, canView, canManage, permissionsLoading, createForm } = useForms();
  const { hasPermission, isLoading: permLoading } = usePermissions();
  const { isModuleEnabled } = useOrganizationModules();
  
  const canCreate = !permLoading && hasPermission('forms.create');
  const transfersEnabled = isModuleEnabled('transfers');
  
  const [search, setSearch] = useState("");
  const [formToDelete, setFormToDelete] = useState<Form | null>(null);
  const [formForResponses, setFormForResponses] = useState<Form | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState(false);

  // Loading state
  if (permissionsLoading || permLoading) {
    return (
      <AppLayout title="Formularios">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Access denied
  if (!canView) {
    return (
      <AppLayout title="Formularios">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Acceso denegado</h2>
          <p className="text-muted-foreground">No tienes permiso para ver formularios</p>
        </div>
      </AppLayout>
    );
  }

  const filteredForms = forms?.filter(form =>
    form.name.toLowerCase().includes(search.toLowerCase()) ||
    form.description?.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const handleEdit = (form: Form) => {
    navigate(`/transfers/forms/${form.id}`);
  };

  const handleDelete = async () => {
    if (!formToDelete) return;
    await deleteForm(formToDelete.id);
    setFormToDelete(null);
  };

  const handleToggleActive = async (form: Form) => {
    await updateForm({ id: form.id, is_active: !form.is_active });
  };

  const handleCopyLink = (form: Form) => {
    const url = `${window.location.origin}/f/${form.slug}`;
    navigator.clipboard.writeText(url);
    toast.success("Enlace copiado al portapapeles");
  };

  const handleCreateTransferTemplate = async (templateType: 'simple' | 'detailed') => {
    if (creatingTemplate) return;
    setCreatingTemplate(true);
    
    try {
      const templateConfig = templateType === 'simple' 
        ? {
            name: 'Solicitud de Transfer',
            description: 'Formulario público para que los brokers soliciten transfers',
            slug: `transfer-request-${Date.now()}`,
            fields: [
              { name: 'broker_name', label: 'Nombre del broker', type: 'text' as const, is_required: true, maps_to_transfer_field: 'broker_name', width: 'half' },
              { name: 'submitter_email', label: 'Email de contacto', type: 'email' as const, is_required: true, width: 'half' },
              { name: 'client_name', label: 'Nombre del cliente', type: 'text' as const, is_required: true, maps_to_transfer_field: 'client_name', width: 'full' },
              { name: 'transfer_date', label: 'Fecha del transfer', type: 'date' as const, is_required: true, maps_to_transfer_field: 'transfer_date', width: 'half' },
              { name: 'pickup_time', label: 'Hora de recogida', type: 'text' as const, is_required: true, placeholder: 'Ej: 10:30', maps_to_transfer_field: 'pickup_time', width: 'half' },
              { name: 'pickup_location', label: 'Punto de recogida', type: 'text' as const, is_required: true, maps_to_transfer_field: 'pickup_location', width: 'half' },
              { name: 'dropoff_location', label: 'Punto de llegada', type: 'text' as const, is_required: true, maps_to_transfer_field: 'dropoff_location', width: 'half' },
              { name: 'pax_count', label: 'Número de pasajeros', type: 'number' as const, is_required: true, maps_to_transfer_field: 'pax_count', width: 'half' },
              { name: 'notes', label: 'Notas adicionales', type: 'textarea' as const, is_required: false, maps_to_transfer_field: 'notes', width: 'full' },
            ]
          }
        : {
            name: 'Solicitud de Transfer Detallada',
            description: 'Formulario completo para solicitudes de transfer con información detallada',
            slug: `transfer-detailed-${Date.now()}`,
            fields: [
              { name: 'broker_name', label: 'Nombre del broker', type: 'text' as const, is_required: true, maps_to_transfer_field: 'broker_name', width: 'half' },
              { name: 'submitter_email', label: 'Email de contacto', type: 'email' as const, is_required: true, width: 'half' },
              { name: 'broker_phone', label: 'Teléfono de contacto', type: 'phone' as const, is_required: false, width: 'half' },
              { name: 'agency_name', label: 'Empresa / Agencia', type: 'text' as const, is_required: false, width: 'half' },
              { name: 'client_name', label: 'Nombre del cliente', type: 'text' as const, is_required: true, maps_to_transfer_field: 'client_name', width: 'full' },
              { name: 'yacht_name', label: 'Nombre del yate', type: 'text' as const, is_required: false, placeholder: 'Si aplica', width: 'full' },
              { name: 'transfer_date', label: 'Fecha del transfer', type: 'date' as const, is_required: true, maps_to_transfer_field: 'transfer_date', width: 'half' },
              { name: 'pickup_time', label: 'Hora de recogida', type: 'text' as const, is_required: true, placeholder: 'Ej: 10:30', maps_to_transfer_field: 'pickup_time', width: 'half' },
              { name: 'pickup_location', label: 'Punto de recogida', type: 'text' as const, is_required: true, maps_to_transfer_field: 'pickup_location', width: 'full' },
              { name: 'dropoff_location', label: 'Punto de llegada', type: 'text' as const, is_required: true, maps_to_transfer_field: 'dropoff_location', width: 'full' },
              { name: 'pax_count', label: 'Número de pasajeros', type: 'number' as const, is_required: true, maps_to_transfer_field: 'pax_count', width: 'half' },
              { name: 'vehicle_type', label: 'Tipo de vehículo preferido', type: 'select' as const, is_required: false, width: 'half', options: [
                { value: 'sedan', label: 'Sedán' },
                { value: 'van', label: 'Van' },
                { value: 'minibus', label: 'Minibús' },
                { value: 'bus', label: 'Autobús' },
                { value: 'luxury', label: 'Vehículo de lujo' },
              ]},
              { name: 'special_luggage', label: 'Equipaje especial o voluminoso', type: 'checkbox' as const, is_required: false, width: 'half' },
              { name: 'child_seat', label: 'Necesita silla infantil', type: 'checkbox' as const, is_required: false, width: 'half' },
              { name: 'notes', label: 'Notas adicionales', type: 'textarea' as const, is_required: false, maps_to_transfer_field: 'notes', width: 'full' },
            ]
          };
      
      // Create the form
      const createdForm = await createForm({
        name: templateConfig.name,
        description: templateConfig.description,
        slug: templateConfig.slug,
        is_public: true,
        is_active: true,
        requires_auth: false,
        create_task_on_submit: false,
        entity_type: 'transfer_request',
        success_message: '¡Gracias por tu solicitud! Nuestro equipo la revisará y te contactará a la brevedad para confirmar los detalles del servicio.',
        primary_color: '#1a365d',
      });
      
      // Create fields
      for (let i = 0; i < templateConfig.fields.length; i++) {
        const fieldConfig = templateConfig.fields[i];
        // Create field directly using supabase
        const { error } = await (supabase as any).from('form_fields').insert({
          form_id: createdForm.id,
          name: fieldConfig.name,
          label: fieldConfig.label,
          type: fieldConfig.type,
          is_required: fieldConfig.is_required,
          placeholder: (fieldConfig as any).placeholder || null,
          options: (fieldConfig as any).options || null,
          maps_to_transfer_field: (fieldConfig as any).maps_to_transfer_field || null,
          position: i,
          width: (fieldConfig as any).width || 'full',
        });
        
        if (error) throw error;
      }
      
      toast.success('Formulario de transfer creado');
      navigate(`/transfers/forms/${createdForm.id}`);
    } catch (error) {
      console.error('Error creating transfer template:', error);
      toast.error('Error al crear el formulario');
    } finally {
      setCreatingTemplate(false);
    }
  };

  return (
    <AppLayout title="Formularios">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Formularios</h1>
            <p className="text-muted-foreground">
              Crea formularios públicos que generan tareas automáticamente
            </p>
          </div>
          {(canCreate || canManage) && (
            <Button onClick={() => navigate('/transfers/forms/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo formulario
            </Button>
          )}
        </div>

        {/* Transfer Templates Section */}
        {transfersEnabled && (canCreate || canManage) && (
          <Card className="border-dashed">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Car className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Plantillas de Transfer</CardTitle>
                <Badge variant="secondary" className="ml-2">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Nuevo
                </Badge>
              </div>
              <CardDescription>
              Crea formularios públicos premium para que los brokers soliciten transfers. Las respuestas crean automáticamente solicitudes en el módulo de Transfers y se acceden vía <code className="text-xs bg-muted px-1 rounded">/transfer/slug</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button 
                variant="outline" 
                onClick={() => handleCreateTransferTemplate('simple')}
                disabled={creatingTemplate}
              >
                {creatingTemplate ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Transfer Simple
              </Button>
              <Button 
                variant="outline"
                onClick={() => handleCreateTransferTemplate('detailed')}
                disabled={creatingTemplate}
              >
                {creatingTemplate ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Transfer Detallado
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar formularios..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : filteredForms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">
              {search ? 'No se encontraron formularios' : 'Aún no tienes formularios'}
            </h2>
            <p className="text-muted-foreground mb-4 max-w-md">
              {search 
                ? 'Prueba con otros términos de búsqueda'
                : 'Crea tu primer formulario para empezar a recibir solicitudes de manera organizada'
              }
            </p>
            {!search && (canCreate || canManage) && (
              <Button onClick={() => navigate('/transfers/forms/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Crear formulario
              </Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredForms.map((form) => (
              <FormCard
                key={form.id}
                form={form}
                onEdit={handleEdit}
                onDelete={setFormToDelete}
                onToggleActive={handleToggleActive}
                onViewResponses={setFormForResponses}
                onCopyLink={handleCopyLink}
              />
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!formToDelete} onOpenChange={() => setFormToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar formulario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán también todas las respuestas asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <FormResponsesDialog
        form={formForResponses}
        open={!!formForResponses}
        onOpenChange={() => setFormForResponses(null)}
      />
    </AppLayout>
  );
}
