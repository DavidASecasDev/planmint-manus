import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { 
  Plus, Pencil, Trash2, FileText, Hash, Power, PowerOff, 
  ChevronDown, ChevronRight, Settings2, Loader2 
} from 'lucide-react';
import { useProviderTemplates } from '@/hooks/useProviderTemplates';
import type { ProviderParsingTemplate, ProviderTemplateFormData } from '@/types/providerTemplates';
import { cn } from '@/lib/utils';

const VEHICLE_TYPES = [
  { value: 'sedan', label: 'Sedán' },
  { value: 'minivan', label: 'Minivan' },
  { value: 'v_class', label: 'V-Class' },
  { value: 'sprinter', label: 'Sprinter' },
  { value: 'minibus', label: 'Minibús' },
  { value: 'bus', label: 'Autobús' },
  { value: 'van', label: 'Furgoneta' },
];

const EMPTY_FORM: ProviderTemplateFormData = {
  provider_name: '',
  provider_aliases: [],
  description: null,
  parsing_hints: '',
  field_mappings: {},
  sample_fields: {},
  default_vehicle_type: null,
  default_currency: 'EUR',
  is_active: true,
};

export function ProviderTemplateManager() {
  const { templates, isLoading, createTemplate, updateTemplate, deleteTemplate, toggleActive } = useProviderTemplates();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ProviderParsingTemplate | null>(null);
  const [form, setForm] = useState<ProviderTemplateFormData>(EMPTY_FORM);
  const [aliasInput, setAliasInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
    setForm(EMPTY_FORM);
    setAliasInput('');
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (template: ProviderParsingTemplate) => {
    setEditingTemplate(template);
    setForm({
      provider_name: template.provider_name,
      provider_aliases: template.provider_aliases,
      description: template.description,
      parsing_hints: template.parsing_hints,
      field_mappings: template.field_mappings,
      sample_fields: template.sample_fields,
      default_vehicle_type: template.default_vehicle_type,
      default_currency: template.default_currency,
      is_active: template.is_active,
    });
    setAliasInput(template.provider_aliases.join(', '));
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    const aliases = aliasInput
      .split(',')
      .map(a => a.trim())
      .filter(Boolean);

    const data = { ...form, provider_aliases: aliases };

    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, ...data });
    } else {
      await createTemplate.mutateAsync(data);
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    await deleteTemplate.mutateAsync(id);
  };

  const handleToggle = async (id: string, currentActive: boolean) => {
    await toggleActive.mutateAsync({ id, is_active: !currentActive });
  };

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-muted-foreground" />
            Plantillas de Proveedor
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Configura reglas de parsing específicas por proveedor para mejorar la precisión de extracción de datos.
          </p>
        </div>
        <Button onClick={handleOpenCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva Plantilla
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Cargando plantillas...
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground mb-1">No hay plantillas de proveedor</p>
            <p className="text-xs text-muted-foreground mb-4">
              Las plantillas mejoran la precisión del análisis de PDFs para proveedores recurrentes.
            </p>
            <Button onClick={handleOpenCreate} variant="outline" size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Crear primera plantilla
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {templates.map((template) => {
            const isExpanded = expandedId === template.id;
            return (
              <Card key={template.id} className={cn(
                'transition-colors',
                !template.is_active && 'opacity-60'
              )}>
                <div 
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : template.id)}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{template.provider_name}</span>
                      {template.is_active ? (
                        <Badge variant="outline" className="text-xs bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200">
                          Activa
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs bg-gray-50 text-gray-500 border-gray-200">
                          Inactiva
                        </Badge>
                      )}
                      {template.default_vehicle_type && (
                        <Badge variant="secondary" className="text-xs">
                          {VEHICLE_TYPES.find(v => v.value === template.default_vehicle_type)?.label || template.default_vehicle_type}
                        </Badge>
                      )}
                    </div>
                    {template.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{template.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="outline" className="text-xs gap-1">
                      <Hash className="h-3 w-3" />
                      {template.usage_count}
                    </Badge>
                  </div>
                </div>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4 px-4 border-t">
                    <div className="space-y-3 mt-3">
                      {template.provider_aliases.length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Alias</Label>
                          <div className="flex gap-1 flex-wrap mt-1">
                            {template.provider_aliases.map((alias, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">{alias}</Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <Label className="text-xs text-muted-foreground">Instrucciones de parsing</Label>
                        <p className="text-sm mt-1 bg-muted/50 rounded-md p-2 whitespace-pre-wrap">{template.parsing_hints}</p>
                      </div>

                      {Object.keys(template.field_mappings).length > 0 && (
                        <div>
                          <Label className="text-xs text-muted-foreground">Mapeo de campos</Label>
                          <div className="grid grid-cols-2 gap-1 mt-1">
                            {Object.entries(template.field_mappings).map(([key, value]) => (
                              <div key={key} className="text-xs bg-muted/50 rounded px-2 py-1">
                                <span className="text-muted-foreground">{key}:</span> {value}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleOpenEdit(template); }} className="gap-1">
                          <Pencil className="h-3 w-3" />
                          Editar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={(e) => { e.stopPropagation(); handleToggle(template.id, template.is_active); }}
                          className="gap-1"
                        >
                          {template.is_active ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                          {template.is_active ? 'Desactivar' : 'Activar'}
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1 text-destructive hover:text-destructive" onClick={(e) => e.stopPropagation()}>
                              <Trash2 className="h-3 w-3" />
                              Eliminar
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Eliminar plantilla</AlertDialogTitle>
                              <AlertDialogDescription>
                                Se eliminará la plantilla de "{template.provider_name}". Esta acción no se puede deshacer.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(template.id)}>Eliminar</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Editar Plantilla' : 'Nueva Plantilla de Proveedor'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="provider_name">Nombre del proveedor *</Label>
              <Input
                id="provider_name"
                value={form.provider_name}
                onChange={(e) => setForm(f => ({ ...f, provider_name: e.target.value }))}
                placeholder="Ej: TransferMallorca, Autocares Balear..."
              />
            </div>

            <div>
              <Label htmlFor="aliases">Alias (separados por coma)</Label>
              <Input
                id="aliases"
                value={aliasInput}
                onChange={(e) => setAliasInput(e.target.value)}
                placeholder="Ej: TM, Transfer Mallorca SL, TransMallorca"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Nombres alternativos que pueden aparecer en los PDFs de este proveedor.
              </p>
            </div>

            <div>
              <Label htmlFor="description">Descripción</Label>
              <Input
                id="description"
                value={form.description || ''}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value || null }))}
                placeholder="Ej: Proveedor principal de transfers aeropuerto"
              />
            </div>

            <div>
              <Label htmlFor="parsing_hints">Instrucciones de parsing *</Label>
              <Textarea
                id="parsing_hints"
                value={form.parsing_hints}
                onChange={(e) => setForm(f => ({ ...f, parsing_hints: e.target.value }))}
                placeholder={`Describe el formato típico de los presupuestos de este proveedor:\n\n- ¿Cómo estructura las rutas? (tabla, lista, párrafos)\n- ¿Qué columnas usa? (Servicio, Precio, Fecha...)\n- ¿Incluye ida y vuelta juntos o separados?\n- ¿Usa algún formato especial para horas o precios?\n- ¿Hay campos específicos que siempre aparecen?`}
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Estas instrucciones se envían al LLM junto con el PDF para mejorar la precisión.
              </p>
            </div>

            <div>
              <Label htmlFor="default_vehicle_type">Tipo de vehículo por defecto</Label>
              <Select
                value={form.default_vehicle_type || 'none'}
                onValueChange={(v) => setForm(f => ({ ...f, default_vehicle_type: v === 'none' ? null : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin tipo por defecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin tipo por defecto</SelectItem>
                  {VEHICLE_TYPES.map(vt => (
                    <SelectItem key={vt.value} value={vt.value}>{vt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>Plantilla activa</Label>
                <p className="text-xs text-muted-foreground">Se aplicará automáticamente al detectar este proveedor.</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button 
              onClick={handleSave} 
              disabled={!form.provider_name.trim() || !form.parsing_hints.trim() || isSaving}
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingTemplate ? 'Guardar cambios' : 'Crear plantilla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
