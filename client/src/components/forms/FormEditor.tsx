import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm, useFormFields } from "@/hooks/useForms";
import { useForms } from "@/hooks/useForms";
import { FormWithFields, CreateFormData, FormFieldType, FormEntityType } from "@/types/forms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormFieldEditor } from "./FormFieldEditor";
import { 
  ArrowLeft, 
  Plus, 
  Save, 
  Eye, 
  Settings,
  FileText,
  Palette,
  Car
} from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

function SortableFieldEditor({ field, onUpdate, onDelete, entityType }: {
  field: FormWithFields['fields'][0];
  onUpdate: (updates: Partial<typeof field>) => void;
  onDelete: () => void;
  entityType?: FormEntityType;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <FormFieldEditor
        field={field}
        onUpdate={onUpdate}
        onDelete={onDelete}
        dragHandleProps={{ ...attributes, ...listeners }}
        entityType={entityType}
      />
    </div>
  );
}

export function FormEditor() {
  const { formId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const isNew = formId === 'new';

  const { form, isLoading } = useForm(isNew ? null : formId!);
  const { createForm, updateForm } = useForms();
  const { createField, updateField, deleteField, reorderFields } = useFormFields(isNew ? null : formId!);

  const [formData, setFormData] = useState<CreateFormData>({
    name: '',
    description: '',
    slug: '',
    is_public: true,
    is_active: true,
    requires_auth: false,
    create_task_on_submit: true,
    success_message: '¡Gracias por tu respuesta!',
    entity_type: 'task',
  });

  const [fields, setFields] = useState<FormWithFields['fields']>([]);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    if (form) {
      setFormData({
        name: form.name,
        description: form.description,
        slug: form.slug,
        is_public: form.is_public,
        is_active: form.is_active,
        requires_auth: form.requires_auth,
        create_task_on_submit: form.create_task_on_submit,
        success_message: form.success_message,
        redirect_url: form.redirect_url,
        custom_logo_url: form.custom_logo_url,
        primary_color: form.primary_color,
        max_responses: form.max_responses,
        expires_at: form.expires_at,
        entity_type: form.entity_type,
      });
      setFields(form.fields);
    }
  }, [form]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleNameChange = (name: string) => {
    setFormData(prev => ({
      ...prev,
      name,
      slug: isNew ? generateSlug(name) : prev.slug,
    }));
  };

  const handleAddField = async () => {
    const newField = {
      form_id: formId!,
      name: `field_${fields.length + 1}`,
      label: 'Nuevo campo',
      type: 'text' as FormFieldType,
      is_required: false,
      position: fields.length,
      width: 'full' as const,
    };

    if (!isNew) {
      const created = await createField(newField);
      setFields(prev => [...prev, created]);
    } else {
      // For new forms, just add to local state
      const tempField = {
        ...newField,
        id: `temp_${Date.now()}`,
        placeholder: null,
        help_text: null,
        default_value: null,
        options: null,
        min_length: null,
        max_length: null,
        min_value: null,
        max_value: null,
        pattern: null,
        maps_to_task_field: null,
        maps_to_transfer_field: null,
        conditions: null,
        created_at: new Date().toISOString(),
      };
      setFields(prev => [...prev, tempField]);
    }
  };

  const handleUpdateField = async (fieldId: string, updates: Partial<FormWithFields['fields'][0]>) => {
    setFields(prev => prev.map(f => f.id === fieldId ? { ...f, ...updates } : f));
    
    if (!isNew && !fieldId.startsWith('temp_')) {
      updateField({ id: fieldId, ...updates });
    }
  };

  const handleDeleteField = async (fieldId: string) => {
    setFields(prev => prev.filter(f => f.id !== fieldId));
    
    if (!isNew && !fieldId.startsWith('temp_')) {
      deleteField(fieldId);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id);
      const newIndex = fields.findIndex(f => f.id === over.id);
      
      const reordered = arrayMove(fields, oldIndex, newIndex).map((f, i) => ({
        ...f,
        position: i,
      }));
      
      setFields(reordered);

      if (!isNew) {
        await reorderFields(reordered.map(f => ({ id: f.id, position: f.position })));
      }
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) {
      toast.error('Por favor, completa el nombre y slug del formulario');
      return;
    }

    setIsSaving(true);
    try {
      if (isNew) {
        const created = await createForm(formData);
        // Create fields for the new form
        for (const field of fields) {
          await createField({
            form_id: created.id,
            name: field.name,
            label: field.label,
            type: field.type,
            is_required: field.is_required,
            placeholder: field.placeholder,
            help_text: field.help_text,
            options: field.options,
            position: field.position,
            width: field.width,
            maps_to_task_field: field.maps_to_task_field,
          });
        }
        toast.success('Formulario creado correctamente');
        navigate(`/transfers/forms/${created.id}`);
      } else {
        await updateForm({ id: formId!, ...formData });
        toast.success('Formulario guardado correctamente');
      }
    } catch (error) {
      toast.error('Error al guardar el formulario');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isNew && isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/transfers/forms')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {isNew ? 'Nuevo formulario' : formData.name || 'Editar formulario'}
            </h1>
            {!isNew && form?.is_public && (
              <p className="text-sm text-muted-foreground">/f/{formData.slug}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isNew && form?.is_public && (
            <Button variant="outline" asChild>
              <a href={`/f/${form.slug}`} target="_blank" rel="noopener noreferrer">
                <Eye className="h-4 w-4 mr-2" />
                Vista previa
              </a>
            </Button>
          )}
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="fields" className="space-y-4">
        <TabsList>
          <TabsTrigger value="fields">
            <FileText className="h-4 w-4 mr-2" />
            Campos
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </TabsTrigger>
          <TabsTrigger value="appearance">
            <Palette className="h-4 w-4 mr-2" />
            Apariencia
          </TabsTrigger>
        </TabsList>

        <TabsContent value="fields" className="space-y-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Campos del formulario</h2>
                <Button onClick={handleAddField}>
                  <Plus className="h-4 w-4 mr-2" />
                  Añadir campo
                </Button>
              </div>

              {fields.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground text-center">
                      Aún no hay campos.<br />
                      Añade el primer campo para empezar.
                    </p>
                    <Button className="mt-4" onClick={handleAddField}>
                      <Plus className="h-4 w-4 mr-2" />
                      Añadir campo
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={fields.map(f => f.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-3">
                      {fields.map((field) => (
                        <SortableFieldEditor
                          key={field.id}
                          field={field}
                          onUpdate={(updates) => handleUpdateField(field.id, updates)}
                          onDelete={() => handleDeleteField(field.id)}
                          entityType={formData.entity_type}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-4">Vista previa</h2>
              <Card>
                <CardHeader>
                  <CardTitle>{formData.name || 'Nombre del formulario'}</CardTitle>
                  {formData.description && (
                    <CardDescription>{formData.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {fields.map((field) => (
                    <div key={field.id} className={field.width === 'half' ? 'w-1/2' : 'w-full'}>
                      <Label>
                        {field.label}
                        {field.is_required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                      {field.type === 'textarea' ? (
                        <Textarea placeholder={field.placeholder || ''} disabled />
                      ) : (
                        <Input placeholder={field.placeholder || ''} disabled />
                      )}
                      {field.help_text && (
                        <p className="text-xs text-muted-foreground mt-1">{field.help_text}</p>
                      )}
                    </div>
                  ))}
                  {fields.length > 0 && (
                    <Button className="w-full" disabled>Enviar</Button>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configuración general</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre del formulario</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder="Ej: Solicitud de soporte"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug (URL)</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    placeholder="solicitud-soporte"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descripción</Label>
                <Textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe el propósito de este formulario"
                  rows={3}
                />
              </div>

              <div className="space-y-4 pt-4 border-t">
                <div className="space-y-2">
                  <Label>Tipo de entidad a crear</Label>
                  <Select
                    value={formData.entity_type || 'task'}
                    onValueChange={(value) => setFormData(prev => ({ 
                      ...prev, 
                      entity_type: value as FormEntityType,
                      create_task_on_submit: value === 'task'
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="task">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Tarea
                        </div>
                      </SelectItem>
                      <SelectItem value="transfer_request">
                        <div className="flex items-center gap-2">
                          <Car className="h-4 w-4" />
                          Solicitud de Transfer
                        </div>
                      </SelectItem>
                      <SelectItem value="none">Ninguno (solo guardar respuesta)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    {formData.entity_type === 'transfer_request' 
                      ? 'Las respuestas crearán solicitudes de transfer automáticamente'
                      : formData.entity_type === 'task'
                      ? 'Las respuestas crearán tareas automáticamente'
                      : 'Las respuestas solo se guardarán sin crear entidades'
                    }
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Formulario público</Label>
                    <p className="text-sm text-muted-foreground">
                      Accesible sin iniciar sesión
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_public}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_public: checked }))}
                  />
                </div>

                {formData.entity_type === 'task' && (
                  <div className="flex items-center justify-between">
                  <div>
                    <Label>Crear tarea al enviar</Label>
                    <p className="text-sm text-muted-foreground">
                      Genera una tarea automáticamente con los datos
                    </p>
                  </div>
                  <Switch
                    checked={formData.create_task_on_submit}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, create_task_on_submit: checked }))}
                  />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Activo</Label>
                    <p className="text-sm text-muted-foreground">
                      Acepta nuevas respuestas
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Después del envío</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Mensaje de éxito</Label>
                <Textarea
                  value={formData.success_message || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, success_message: e.target.value }))}
                  placeholder="¡Gracias por tu respuesta!"
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label>URL de redirección (opcional)</Label>
                <Input
                  value={formData.redirect_url || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, redirect_url: e.target.value }))}
                  placeholder="https://ejemplo.com/gracias"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Límites</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Máximo de respuestas</Label>
                  <Input
                    type="number"
                    value={formData.max_responses || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      max_responses: e.target.value ? parseInt(e.target.value) : null 
                    }))}
                    placeholder="Sin límite"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Fecha de expiración</Label>
                  <Input
                    type="datetime-local"
                    value={formData.expires_at?.slice(0, 16) || ''}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      expires_at: e.target.value ? new Date(e.target.value).toISOString() : null 
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personalización</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>URL del logo</Label>
                <Input
                  value={formData.custom_logo_url || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, custom_logo_url: e.target.value }))}
                  placeholder="https://ejemplo.com/logo.png"
                />
              </div>
              <div className="space-y-2">
                <Label>Color principal</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="color"
                    value={formData.primary_color || '#3b82f6'}
                    onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                    className="w-12 h-10 p-1"
                  />
                  <Input
                    value={formData.primary_color || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, primary_color: e.target.value }))}
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
