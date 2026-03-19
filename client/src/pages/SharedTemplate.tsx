// Phase 29: Shared Template Page (Public via share_code)
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserTemplates } from '@/hooks/useUserTemplates';
import { useTemplates } from '@/hooks/useTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { PublicLayout } from '@/components/public/PublicLayout';
import { AppLayout } from '@/components/layout/AppLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CardSkeleton, ListSkeleton } from '@/components/ui/loading-skeleton';
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
  Download,
  Star,
  Lock,
  AlertTriangle
} from 'lucide-react';
import { UserTemplate, VISIBILITY_LABELS } from '@/types/userTemplates';
import { ApplyOptions } from '@/types/templates';
import * as LucideIcons from 'lucide-react';

const SharedTemplate = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const { applyUserTemplate, isApplying, canManageTemplates, currentPlan } = useTemplates();
  const { fetchTemplateByShareCode, recordInstall } = useUserTemplates();

  const [template, setTemplate] = useState<UserTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [applyOptions, setApplyOptions] = useState<ApplyOptions>({
    areas: true,
    tags: true,
    kanban_columns: true,
    tasks: true,
    automations: true,
  });

  const loadTemplate = useCallback(async () => {
    if (!shareCode) return;
    setLoading(true);
    try {
      const result = await fetchTemplateByShareCode(shareCode);
      if (result) {
        // Check visibility and status
        if (result.status !== 'active') {
          setNotFound(true);
          return;
        }
        
        // For private templates, check if user is authorized
        if (result.visibility === 'private' && result.created_by !== user?.id) {
          setNotFound(true);
          return;
        }
        
        // For org templates, check if user is in same org
        if (result.visibility === 'org' && result.organization_id !== profile?.organization_id) {
          setNotFound(true);
          return;
        }
        
        setTemplate(result);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [shareCode, fetchTemplateByShareCode, user?.id, profile?.organization_id]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const config = template?.config_json;

  const handleInstall = () => {
    if (!user) {
      // Redirect to login with return URL
      navigate(`/login?redirect=/templates/shared/${shareCode}`);
      return;
    }

    if (!canManageTemplates) {
      return;
    }

    setShowApplyDialog(true);
  };

  const doApplyTemplate = () => {
    if (!template || !config) return;

    const options: ApplyOptions = applyOptions;
    
    // Block automations for free plan
    if (currentPlan === 'free') {
      options.automations = false;
    }

    // Call the server-side apply function with user template ID
    applyUserTemplate(template.id, options);
    recordInstall(template.id);
    setShowApplyDialog(false);
  };

  const hasAutomations = (config?.automations?.length || 0) > 0;
  const automationsBlocked = currentPlan === 'free' && hasAutomations;

  // Render content based on state
  if (loading) {
    const LoadingContent = () => (
      <div className="space-y-6 max-w-4xl mx-auto px-4 py-8">
        <CardSkeleton className="h-48" />
        <ListSkeleton count={4} />
      </div>
    );
    
    if (user) {
      return (
        <AppLayout title="Cargando plantilla...">
          <LoadingContent />
        </AppLayout>
      );
    }
    
    return (
      <PublicLayout>
        <LoadingContent />
      </PublicLayout>
    );
  }

  if (notFound || !template) {
    const NotFoundContent = () => (
      <div className="text-center py-12 max-w-md mx-auto px-4">
        <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold">Plantilla no disponible</h2>
        <p className="text-muted-foreground mt-2">
          Esta plantilla no existe, ha sido eliminada, o no tienes permiso para verla.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Ver plantillas
        </Button>
      </div>
    );

    if (user) {
      return (
        <AppLayout title="Plantilla no disponible">
          <NotFoundContent />
        </AppLayout>
      );
    }

    return (
      <PublicLayout>
        <NotFoundContent />
      </PublicLayout>
    );
  }

  const IconComponent = (LucideIcons as any)[
    (template.icon || 'layout-template').split('-').map((s, i) => 
      i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
    ).join('')
  ] || LayoutTemplate;

  const TemplateContent = () => (
    <div className="space-y-6 max-w-4xl mx-auto">
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
                    <Badge variant="outline">
                      {VISIBILITY_LABELS[template.visibility]}
                    </Badge>
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Download className="h-3.5 w-3.5" />
                      {template.installs_count} instalaciones
                    </span>
                    {template.rating_count > 0 && (
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {template.rating_avg.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Por {template.creator_name}
                  </p>
                </div>
                <Button onClick={handleInstall} disabled={isApplying}>
                  {isApplying ? 'Instalando...' : user ? 'Instalar en mi organización' : 'Iniciar sesión para instalar'}
                </Button>
              </div>
              <p className="text-muted-foreground mt-4">
                {template.long_description || template.description}
              </p>
              {user && !canManageTemplates && (
                <p className="text-sm text-amber-600 mt-2">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Solo los administradores y managers pueden instalar plantillas.
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* What's included */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Qué incluye</CardTitle>
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
                {config.tasks.slice(0, 6).map((task, i) => (
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
              {config.tasks.length > 6 && (
                <p className="text-sm text-muted-foreground text-center mt-3">
                  +{config.tasks.length - 6} tareas más
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Apply dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Instalar plantilla</DialogTitle>
            <DialogDescription>
              Selecciona qué elementos quieres incluir de esta plantilla.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox 
                checked={applyOptions.areas}
                onCheckedChange={(checked) => 
                  setApplyOptions(prev => ({ ...prev, areas: !!checked }))
                }
                disabled={!config?.areas?.length}
              />
              <Folder className="h-4 w-4 text-muted-foreground" />
              <span>Áreas ({config?.areas?.length || 0})</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox 
                checked={applyOptions.tags}
                onCheckedChange={(checked) => 
                  setApplyOptions(prev => ({ ...prev, tags: !!checked }))
                }
                disabled={!config?.tags?.length}
              />
              <Tag className="h-4 w-4 text-muted-foreground" />
              <span>Tags ({config?.tags?.length || 0})</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox 
                checked={applyOptions.kanban_columns}
                onCheckedChange={(checked) => 
                  setApplyOptions(prev => ({ ...prev, kanban_columns: !!checked }))
                }
                disabled={!config?.kanban_columns?.length}
              />
              <Columns3 className="h-4 w-4 text-muted-foreground" />
              <span>Columnas Kanban ({config?.kanban_columns?.length || 0})</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox 
                checked={applyOptions.tasks}
                onCheckedChange={(checked) => 
                  setApplyOptions(prev => ({ ...prev, tasks: !!checked }))
                }
                disabled={!config?.tasks?.length}
              />
              <ListTodo className="h-4 w-4 text-muted-foreground" />
              <span>Tareas ({config?.tasks?.length || 0})</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <Checkbox 
                checked={applyOptions.automations && !automationsBlocked}
                onCheckedChange={(checked) => 
                  setApplyOptions(prev => ({ ...prev, automations: !!checked }))
                }
                disabled={!config?.automations?.length || automationsBlocked}
              />
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span>Automatizaciones ({config?.automations?.length || 0})</span>
              {automationsBlocked && <Badge variant="outline" className="ml-auto text-xs">Pro</Badge>}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={doApplyTemplate} disabled={isApplying}>
              {isApplying ? 'Instalando...' : 'Instalar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  // Wrap in appropriate layout
  if (user) {
    return (
      <AppLayout title={template.name}>
        <SEOHead
          title={`${template.name} | Plantilla compartida | PlanMint`}
          description={template.description}
        />
        <TemplateContent />
      </AppLayout>
    );
  }

  return (
    <PublicLayout>
      <SEOHead
        title={`${template.name} | Plantilla compartida | PlanMint`}
        description={template.description}
      />
      <div className="py-8 px-4">
        <TemplateContent />
      </div>
    </PublicLayout>
  );
};

export default SharedTemplate;
