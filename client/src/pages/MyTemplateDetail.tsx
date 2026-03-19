// Phase 29: My Template Detail Page
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserTemplates } from '@/hooks/useUserTemplates';
import { AppLayout } from '@/components/layout/AppLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CardSkeleton, ListSkeleton } from '@/components/ui/loading-skeleton';
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
import { 
  LayoutTemplate, 
  ArrowLeft, 
  Folder, 
  Tag, 
  Columns3, 
  ListTodo, 
  Zap,
  Check,
  Target,
  Flag,
  Share2,
  Download,
  Trash2,
  Edit,
  Copy,
  Lock,
  Users,
  Globe
} from 'lucide-react';
import { UserTemplate, VISIBILITY_LABELS } from '@/types/userTemplates';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';

const MyTemplateDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { 
    fetchUserTemplateBySlug, 
    deleteTemplate,
    isDeleting,
  } = useUserTemplates();

  const [template, setTemplate] = useState<UserTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const loadTemplate = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const result = await fetchUserTemplateBySlug(slug);
      if (result) {
        setTemplate(result);
      }
    } finally {
      setLoading(false);
    }
  }, [slug, fetchUserTemplateBySlug]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const config = template?.config_json;

  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/templates/shared/${template?.share_code}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Enlace copiado al portapapeles');
  };

  const handleExportJSON = () => {
    if (!template) return;
    
    const exportData = {
      name: template.name,
      description: template.description,
      long_description: template.long_description,
      icon: template.icon,
      color: template.color,
      version: template.version,
      config: template.config_json,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${template.slug}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Plantilla exportada como JSON');
  };

  const handleDelete = () => {
    if (!template) return;
    deleteTemplate(template.id, {
      onSuccess: () => {
        navigate('/templates?tab=my');
      },
    });
  };

  if (loading) {
    return (
      <AppLayout title="Cargando plantilla...">
        <div className="space-y-6">
          <CardSkeleton className="h-48" />
          <ListSkeleton count={4} />
        </div>
      </AppLayout>
    );
  }

  if (!template) {
    return (
      <AppLayout title="Plantilla no encontrada">
        <div className="text-center py-12">
          <LayoutTemplate className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold">Plantilla no encontrada</h2>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/templates')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a plantillas
          </Button>
        </div>
      </AppLayout>
    );
  }

  const IconComponent = (LucideIcons as any)[
    (template.icon || 'layout-template').split('-').map((s, i) => 
      i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
    ).join('')
  ] || LayoutTemplate;

  const VisibilityIcon = template.visibility === 'private' ? Lock 
    : template.visibility === 'org' ? Users 
    : Globe;

  return (
    <AppLayout title={template.name}>
      <SEOHead
        title={`${template.name} | Mis plantillas | PlanMint`}
        description={template.description}
      />

      <div className="space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/templates?tab=my')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a mis plantillas
        </Button>

        {/* Hero */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${template.color || '#6366f1'}20` }}
              >
                <IconComponent 
                  className="h-10 w-10" 
                  style={{ color: template.color || '#6366f1' }} 
                />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h1 className="text-2xl font-bold">{template.name}</h1>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className="gap-1">
                        <VisibilityIcon className="h-3 w-3" />
                        {VISIBILITY_LABELS[template.visibility]}
                      </Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Download className="h-3.5 w-3.5" />
                        {template.installs_count} instalaciones
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopyShareLink}
                    >
                      <Share2 className="h-4 w-4 mr-2" />
                      Compartir enlace
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportJSON}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Exportar JSON
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground mt-4">
                  {template.long_description || template.description}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* What's included */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contenido de la plantilla</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Folder className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{config?.areas?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Áreas</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Tag className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{config?.tags?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Tags</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Columns3 className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{config?.kanban_columns?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Columnas</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <ListTodo className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{config?.tasks?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Tareas</div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Zap className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-medium">{config?.automations?.length || 0}</div>
                  <div className="text-sm text-muted-foreground">Automatizaciones</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Preview sections */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Areas preview */}
          {config?.areas && config.areas.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Folder className="h-4 w-4" />
                  Áreas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {config.areas.map((area, i) => {
                    const AreaIcon = (LucideIcons as any)[
                      area.icon.split('-').map((s, j) => 
                        j === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
                      ).join('')
                    ] || Folder;
                    return (
                      <Badge 
                        key={i} 
                        variant="outline" 
                        className="gap-1.5 py-1.5 px-3"
                        style={{ borderColor: area.color, color: area.color }}
                      >
                        <AreaIcon className="h-3.5 w-3.5" />
                        {area.name}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tags preview */}
          {config?.tags && config.tags.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Tag className="h-4 w-4" />
                  Tags
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {config.tags.map((tag, i) => {
                    const TagIcon = (LucideIcons as any)[
                      tag.icon.split('-').map((s, j) => 
                        j === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
                      ).join('')
                    ] || Tag;
                    return (
                      <Badge 
                        key={i} 
                        className="gap-1.5"
                        style={{ backgroundColor: tag.color }}
                      >
                        <TagIcon className="h-3 w-3" />
                        {tag.name}
                      </Badge>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tasks preview */}
          {config?.tasks && config.tasks.length > 0 && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Tareas y objetivos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {config.tasks.map((task, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                      {task.type === 'goal_numeric' ? (
                        <Target className="h-4 w-4 text-emerald-500 mt-0.5" />
                      ) : task.type === 'goal_milestones' ? (
                        <Flag className="h-4 w-4 text-violet-500 mt-0.5" />
                      ) : (
                        <Check className="h-4 w-4 text-blue-500 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{task.title}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {task.type === 'goal_numeric' && task.goal_target_value && (
                            <span>Objetivo: {task.goal_target_value} {task.goal_unit}</span>
                          )}
                          {task.type === 'goal_milestones' && task.milestones && (
                            <span>{task.milestones.length} hitos</span>
                          )}
                          {task.type === 'simple' && <span>Tarea simple</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La plantilla "{template.name}" será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default MyTemplateDetail;
