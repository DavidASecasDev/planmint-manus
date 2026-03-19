// Phase 29: Import Template JSON Page
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserTemplates } from '@/hooks/useUserTemplates';
import { AppLayout } from '@/components/layout/AppLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { 
  ArrowLeft, 
  Upload, 
  FileJson, 
  Folder, 
  Tag, 
  Columns3, 
  ListTodo, 
  Zap,
  Check,
  AlertTriangle,
  Loader2
} from 'lucide-react';
import { UserTemplateConfig } from '@/types/userTemplates';

interface ImportedTemplate {
  name: string;
  description: string;
  long_description?: string;
  icon?: string;
  color?: string;
  version?: string;
  config: UserTemplateConfig;
}

const ImportTemplate = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { canCreateTemplates, createTemplate, isCreating, myTemplates, templateLimit } = useUserTemplates();
  
  const [imported, setImported] = useState<ImportedTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  
  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setImported(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        // Validate structure
        if (!json.name || !json.config) {
          setError('El archivo JSON no tiene el formato correcto. Debe incluir "name" y "config".');
          return;
        }

        // Validate config structure
        const config = json.config as UserTemplateConfig;
        if (!config.areas && !config.tags && !config.kanban_columns && !config.tasks && !config.automations) {
          setError('El archivo no contiene datos válidos de plantilla.');
          return;
        }

        setImported(json as ImportedTemplate);
        setName(json.name);
        setDescription(json.description || '');
      } catch (err) {
        setError('Error al leer el archivo. Asegúrate de que es un JSON válido.');
      }
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    if (!imported) return;

    if (!canCreateTemplates) {
      setShowUpgradeModal(true);
      return;
    }

    const atLimit = (myTemplates?.length || 0) >= templateLimit;
    if (atLimit) {
      setError(`Has alcanzado el límite de ${templateLimit} plantillas en tu plan.`);
      return;
    }

    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    createTemplate({
      name,
      slug,
      description,
      long_description: imported.long_description,
      visibility: 'private',
      icon: imported.icon || 'layout-template',
      color: imported.color || '#6366f1',
      config_json: imported.config,
    }, {
      onSuccess: () => {
        navigate('/templates?tab=my');
      },
    });
  };

  const config = imported?.config;

  return (
    <AppLayout title="Importar plantilla">
      <SEOHead
        title="Importar plantilla | PlanMint"
        description="Importa una plantilla desde un archivo JSON"
      />

      <div className="max-w-2xl mx-auto space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a plantillas
        </Button>

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Importar plantilla</h1>
          <p className="text-muted-foreground mt-1">
            Sube un archivo JSON para crear una nueva plantilla
          </p>
        </div>

        {/* Upload section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileJson className="h-5 w-5" />
              Seleccionar archivo
            </CardTitle>
            <CardDescription>
              Selecciona un archivo JSON exportado desde PlanMint
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <div 
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm font-medium">
                Haz clic para seleccionar un archivo
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Archivos .json hasta 1MB
              </p>
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview section */}
        {imported && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Check className="h-5 w-5 text-emerald-500" />
                Archivo válido
              </CardTitle>
              <CardDescription>
                Revisa los datos antes de importar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Editable fields */}
              <div className="space-y-2">
                <Label htmlFor="name">Nombre de la plantilla</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Mi plantilla importada"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción de la plantilla"
                />
              </div>

              {/* Content summary */}
              <div className="grid grid-cols-5 gap-3 pt-4">
                <div className="p-3 rounded-lg border text-center">
                  <Folder className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-semibold">{config?.areas?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Áreas</p>
                </div>
                <div className="p-3 rounded-lg border text-center">
                  <Tag className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-semibold">{config?.tags?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Tags</p>
                </div>
                <div className="p-3 rounded-lg border text-center">
                  <Columns3 className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-semibold">{config?.kanban_columns?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Columnas</p>
                </div>
                <div className="p-3 rounded-lg border text-center">
                  <ListTodo className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-semibold">{config?.tasks?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Tareas</p>
                </div>
                <div className="p-3 rounded-lg border text-center">
                  <Zap className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-semibold">{config?.automations?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Automations</p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                La plantilla se guardará como <Badge variant="outline">Privada</Badge> en "Mis plantillas".
              </p>

              <Button 
                className="w-full" 
                onClick={handleImport}
                disabled={!name.trim() || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Importar como plantilla
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitMessage="Actualiza a Pro para importar plantillas"
        suggestedPlan="pro"
      />
    </AppLayout>
  );
};

export default ImportTemplate;
