// Phase 29: Create Template Page (Wizard)
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserTemplates } from '@/hooks/useUserTemplates';
import { useSubscription } from '@/hooks/useSubscription';
import { AppLayout } from '@/components/layout/AppLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { 
  ArrowLeft, 
  ArrowRight, 
  Folder, 
  Tag, 
  Columns3, 
  ListTodo, 
  Zap,
  Lock,
  Users,
  Globe,
  LayoutTemplate,
  Check,
  Loader2
} from 'lucide-react';
import { TemplateVisibility, ExportOptions, UserTemplateConfig, VISIBILITY_LABELS } from '@/types/userTemplates';

const STEPS = [
  { id: 'info', title: 'Información básica', description: 'Nombre y descripción' },
  { id: 'content', title: 'Contenido', description: 'Qué incluir' },
  { id: 'preview', title: 'Vista previa', description: 'Revisar y crear' },
];

const CreateTemplate = () => {
  const navigate = useNavigate();
  const { 
    canCreateTemplates, 
    canPublishTemplates, 
    templateLimit,
    myTemplates,
    exportOrganizationConfig,
    createTemplate,
    isCreating,
    currentPlan,
  } = useUserTemplates();
  
  const [step, setStep] = useState(0);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Form state
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [longDescription, setLongDescription] = useState('');
  const [visibility, setVisibility] = useState<TemplateVisibility>('private');
  const [icon, setIcon] = useState('layout-template');
  const [color, setColor] = useState('#6366f1');
  
  // Export options
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    areas: true,
    tags: true,
    kanban_columns: true,
    tasks: true,
    automations: false,
  });
  
  // Generated config
  const [config, setConfig] = useState<UserTemplateConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  // Check permissions
  useEffect(() => {
    if (!canCreateTemplates) {
      setShowUpgradeModal(true);
    }
  }, [canCreateTemplates]);

  // Auto-generate slug from name
  useEffect(() => {
    const generatedSlug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    setSlug(generatedSlug);
  }, [name]);

  // Check template limit
  const atLimit = (myTemplates?.length || 0) >= templateLimit;

  const handleExportConfig = async () => {
    setLoadingConfig(true);
    try {
      const exported = await exportOrganizationConfig(exportOptions);
      setConfig(exported);
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleCreate = () => {
    if (!config) return;
    
    createTemplate({
      name,
      slug,
      description,
      long_description: longDescription || undefined,
      visibility,
      icon,
      color,
      config_json: config,
    }, {
      onSuccess: () => {
        navigate('/templates?tab=my');
      },
    });
  };

  const canProceed = () => {
    if (step === 0) return name.trim() && slug.trim() && description.trim();
    if (step === 1) return Object.values(exportOptions).some(v => v);
    if (step === 2) return config !== null;
    return false;
  };

  const handleNext = async () => {
    if (step === 1) {
      await handleExportConfig();
    }
    setStep(s => s + 1);
  };

  const VisibilityIcon = visibility === 'private' ? Lock 
    : visibility === 'org' ? Users 
    : Globe;

  return (
    <AppLayout title="Crear plantilla">
      <SEOHead
        title="Crear plantilla | PlanMint"
        description="Crea una plantilla desde tu configuración actual"
      />

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a plantillas
        </Button>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Crear plantilla</h1>
          <p className="text-muted-foreground mt-1">
            Exporta tu configuración actual como una plantilla reutilizable
          </p>
        </div>

        {/* Limit warning */}
        {atLimit && (
          <Card className="border-amber-500/50 bg-amber-500/10">
            <CardContent className="pt-6">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Has alcanzado el límite de {templateLimit} plantillas en tu plan {currentPlan}.
                <Button 
                  variant="link" 
                  className="h-auto p-0 ml-1"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  Actualizar plan
                </Button>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Progress steps */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm ${
                i === step 
                  ? 'bg-primary text-primary-foreground' 
                  : i < step 
                    ? 'bg-primary/20 text-primary' 
                    : 'bg-muted text-muted-foreground'
              }`}>
                {i < step ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <span className="w-4 text-center">{i + 1}</span>
                )}
                <span className="hidden sm:inline">{s.title}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 mx-2 ${i < step ? 'bg-primary' : 'bg-muted'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step].title}</CardTitle>
            <CardDescription>{STEPS[step].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 1: Info */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre *</Label>
                  <Input
                    id="name"
                    placeholder="Mi plantilla personalizada"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug (URL)</Label>
                  <Input
                    id="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="mi-plantilla"
                  />
                  <p className="text-xs text-muted-foreground">
                    URL: /templates/my/{slug || 'mi-plantilla'}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Descripción corta *</Label>
                  <Input
                    id="description"
                    placeholder="Una breve descripción de la plantilla"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="longDescription">Descripción larga (opcional)</Label>
                  <Textarea
                    id="longDescription"
                    placeholder="Descripción detallada de qué incluye y para qué sirve..."
                    value={longDescription}
                    onChange={(e) => setLongDescription(e.target.value)}
                    rows={3}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Visibilidad</Label>
                  <Select value={visibility} onValueChange={(v) => setVisibility(v as TemplateVisibility)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="private">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4" />
                          Privada - Solo tú
                        </div>
                      </SelectItem>
                      <SelectItem value="org">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          Organización - Tu equipo
                        </div>
                      </SelectItem>
                      <SelectItem value="public" disabled={!canPublishTemplates}>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          Pública - Comunidad
                          {!canPublishTemplates && <Badge variant="outline" className="ml-2">Team</Badge>}
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <div className="flex gap-2">
                      <Input
                        id="color"
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="w-12 h-10 p-1 cursor-pointer"
                      />
                      <Input
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        placeholder="#6366f1"
                      />
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Content selection */}
            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Selecciona qué elementos de tu organización quieres incluir en la plantilla.
                  Los datos sensibles serán automáticamente sanitizados.
                </p>
                
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={exportOptions.areas}
                      onCheckedChange={(checked) => 
                        setExportOptions(prev => ({ ...prev, areas: !!checked }))
                      }
                    />
                    <Folder className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Áreas</p>
                      <p className="text-sm text-muted-foreground">Categorías de trabajo</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={exportOptions.tags}
                      onCheckedChange={(checked) => 
                        setExportOptions(prev => ({ ...prev, tags: !!checked }))
                      }
                    />
                    <Tag className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Tags</p>
                      <p className="text-sm text-muted-foreground">Etiquetas para clasificar</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={exportOptions.kanban_columns}
                      onCheckedChange={(checked) => 
                        setExportOptions(prev => ({ ...prev, kanban_columns: !!checked }))
                      }
                    />
                    <Columns3 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Columnas Kanban</p>
                      <p className="text-sm text-muted-foreground">Configuración del tablero</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={exportOptions.tasks}
                      onCheckedChange={(checked) => 
                        setExportOptions(prev => ({ ...prev, tasks: !!checked }))
                      }
                    />
                    <ListTodo className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Tareas y objetivos</p>
                      <p className="text-sm text-muted-foreground">Estructura de trabajo (títulos sanitizados)</p>
                    </div>
                  </label>
                  
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50">
                    <Checkbox
                      checked={exportOptions.automations}
                      onCheckedChange={(checked) => 
                        setExportOptions(prev => ({ ...prev, automations: !!checked }))
                      }
                    />
                    <Zap className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">Automatizaciones</p>
                      <p className="text-sm text-muted-foreground">Reglas de automatización (sin IDs de usuario)</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* Step 3: Preview */}
            {step === 2 && (
              <div className="space-y-4">
                {loadingConfig ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : config ? (
                  <>
                    {/* Template preview card */}
                    <div className="p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-start gap-4">
                        <div 
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          <LayoutTemplate className="h-6 w-6" style={{ color }} />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold">{name}</h3>
                          <p className="text-sm text-muted-foreground">{description}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className="gap-1">
                              <VisibilityIcon className="h-3 w-3" />
                              {VISIBILITY_LABELS[visibility]}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Content summary */}
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <div className="p-3 rounded-lg border text-center">
                        <Folder className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-lg font-semibold">{config.areas.length}</p>
                        <p className="text-xs text-muted-foreground">Áreas</p>
                      </div>
                      <div className="p-3 rounded-lg border text-center">
                        <Tag className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-lg font-semibold">{config.tags.length}</p>
                        <p className="text-xs text-muted-foreground">Tags</p>
                      </div>
                      <div className="p-3 rounded-lg border text-center">
                        <Columns3 className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-lg font-semibold">{config.kanban_columns.length}</p>
                        <p className="text-xs text-muted-foreground">Columnas</p>
                      </div>
                      <div className="p-3 rounded-lg border text-center">
                        <ListTodo className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-lg font-semibold">{config.tasks.length}</p>
                        <p className="text-xs text-muted-foreground">Tareas</p>
                      </div>
                      <div className="p-3 rounded-lg border text-center">
                        <Zap className="h-5 w-5 mx-auto mb-1 text-primary" />
                        <p className="text-lg font-semibold">{config.automations.length}</p>
                        <p className="text-xs text-muted-foreground">Automations</p>
                      </div>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      ✓ Los datos sensibles han sido sanitizados automáticamente.
                    </p>
                  </>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Error al generar la configuración. Intenta de nuevo.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/templates')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {step > 0 ? 'Anterior' : 'Cancelar'}
          </Button>
          
          {step < STEPS.length - 1 ? (
            <Button onClick={handleNext} disabled={!canProceed() || loadingConfig || atLimit}>
              {loadingConfig ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generando...
                </>
              ) : (
                <>
                  Siguiente
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button onClick={handleCreate} disabled={!canProceed() || isCreating || atLimit}>
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Crear plantilla
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitMessage="Actualiza a Pro para crear plantillas"
        suggestedPlan="pro"
      />
    </AppLayout>
  );
};

export default CreateTemplate;
