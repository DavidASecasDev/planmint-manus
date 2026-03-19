// Phase 29: Community Template Detail Page
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserTemplates } from '@/hooks/useUserTemplates';
import { useTemplates } from '@/hooks/useTemplates';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CardSkeleton, ListSkeleton } from '@/components/ui/loading-skeleton';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { TemplateRatingSection } from '@/components/templates/TemplateRatingSection';
import { ReportTemplateDialog } from '@/components/templates/ReportTemplateDialog';
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
  Heart,
  Share2,
  AlertTriangle,
  Download,
  Star,
  Copy,
  ExternalLink
} from 'lucide-react';
import { UserTemplate, UserTemplateConfig, TemplateRating, VISIBILITY_LABELS } from '@/types/userTemplates';
import { ApplyOptions } from '@/types/templates';
import * as LucideIcons from 'lucide-react';
import { toast } from 'sonner';

const CommunityTemplateDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { applyUserTemplate, isApplying, canManageTemplates, currentPlan } = useTemplates();
  const { 
    fetchUserTemplateBySlug, 
    fetchTemplateRatings,
    fetchMyRating,
    isFavorite,
    toggleFavorite,
    rateTemplate,
    reportTemplate,
    recordInstall,
    canRateTemplates,
  } = useUserTemplates();

  const [template, setTemplate] = useState<UserTemplate | null>(null);
  const [ratings, setRatings] = useState<TemplateRating[]>([]);
  const [myRating, setMyRating] = useState<TemplateRating | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [applyOptions, setApplyOptions] = useState<ApplyOptions>({
    areas: true,
    tags: true,
    kanban_columns: true,
    tasks: true,
    automations: true,
  });

  const loadTemplate = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    try {
      const result = await fetchUserTemplateBySlug(slug);
      if (result) {
        setTemplate(result);
        
        // Load ratings
        const templateRatings = await fetchTemplateRatings(result.id);
        setRatings(templateRatings);
        
        // Load my rating
        const userRating = await fetchMyRating(result.id);
        setMyRating(userRating);
      }
    } finally {
      setLoading(false);
    }
  }, [slug, fetchUserTemplateBySlug, fetchTemplateRatings, fetchMyRating]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const config = template?.config_json;

  const handleApply = (partial: boolean) => {
    if (!canManageTemplates) {
      return;
    }

    if (partial) {
      setShowApplyDialog(true);
    } else {
      doApplyTemplate();
    }
  };

  const doApplyTemplate = () => {
    if (!template || !config) return;

    const options: ApplyOptions = showApplyDialog 
      ? applyOptions 
      : {
          areas: true,
          tags: true,
          kanban_columns: true,
          tasks: true,
          automations: currentPlan !== 'free' && (config?.automations?.length || 0) > 0,
        };

    // Call the server-side apply function with user template ID
    applyUserTemplate(template.id, options);
    
    // Record install
    recordInstall(template.id);
    
    setShowApplyDialog(false);
  };

  const handleCopyShareLink = () => {
    const shareUrl = `${window.location.origin}/templates/shared/${template?.share_code}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success('Enlace copiado al portapapeles');
  };

  const handleRate = (rating: number, review?: string) => {
    if (!template) return;
    rateTemplate({ templateId: template.id, rating, review }, {
      onSuccess: () => loadTemplate(),
    });
  };

  const handleReport = (reason: string, details?: string) => {
    if (!template) return;
    reportTemplate({ templateId: template.id, reason, details }, {
      onSuccess: () => setShowReportDialog(false),
    });
  };

  const hasAutomations = (config?.automations?.length || 0) > 0;
  const automationsBlocked = currentPlan === 'free' && hasAutomations;

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
          <p className="text-muted-foreground mt-2">
            La plantilla puede haber sido eliminada o no estar disponible.
          </p>
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

  const isFav = isFavorite(template.id);

  return (
    <AppLayout title={template.name}>
      <SEOHead
        title={`${template.name} | Plantillas | PlanMint`}
        description={template.description}
      />

      <div className="space-y-6">
        {/* Back button */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/templates')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a plantillas
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
                          {template.rating_avg.toFixed(1)} ({template.rating_count})
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      Por {template.creator_name} · {template.organization_name}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleFavorite(template.id)}
                    >
                      <Heart className={`h-4 w-4 ${isFav ? 'fill-red-500 text-red-500' : ''}`} />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyShareLink}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleApply(true)}
                      disabled={isApplying || !canManageTemplates}
                    >
                      Aplicar parcialmente
                    </Button>
                    <Button 
                      onClick={() => handleApply(false)}
                      disabled={isApplying || !canManageTemplates}
                    >
                      {isApplying ? 'Aplicando...' : 'Instalar plantilla'}
                    </Button>
                  </div>
                </div>
                <p className="text-muted-foreground mt-4">
                  {template.long_description || template.description}
                </p>
                {!canManageTemplates && (
                  <p className="text-sm text-amber-600 mt-2">
                    <AlertTriangle className="h-4 w-4 inline mr-1" />
                    Solo los administradores y managers pueden aplicar plantillas.
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
                  <div className="font-medium">
                    {config?.automations?.length || 0}
                    {automationsBlocked && <span className="text-amber-500 ml-1">*</span>}
                  </div>
                  <div className="text-sm text-muted-foreground">Automatizaciones</div>
                </div>
              </div>
            </div>
            {automationsBlocked && (
              <p className="text-sm text-amber-600 mt-4">
                * Las automatizaciones requieren plan Pro o superior.{' '}
                <button 
                  className="underline hover:no-underline"
                  onClick={() => setShowUpgradeModal(true)}
                >
                  Actualizar plan
                </button>
              </p>
            )}
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
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Tareas y objetivos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {config.tasks.slice(0, 5).map((task, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-lg border">
                      {task.type === 'goal_numeric' ? (
                        <Target className="h-4 w-4 text-emerald-500 mt-0.5" />
                      ) : task.type === 'goal_milestones' ? (
                        <Flag className="h-4 w-4 text-violet-500 mt-0.5" />
                      ) : (
                        <Check className="h-4 w-4 text-blue-500 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm">{task.title}</div>
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
                  {config.tasks.length > 5 && (
                    <p className="text-sm text-muted-foreground text-center">
                      +{config.tasks.length - 5} tareas más
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Ratings section */}
        <TemplateRatingSection
          templateId={template.id}
          ratings={ratings}
          myRating={myRating}
          canRate={canRateTemplates}
          onRate={handleRate}
        />

        {/* Report button */}
        <div className="flex justify-end">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-muted-foreground"
            onClick={() => setShowReportDialog(true)}
          >
            <AlertTriangle className="h-4 w-4 mr-2" />
            Reportar plantilla
          </Button>
        </div>
      </div>

      {/* Partial apply dialog */}
      <Dialog open={showApplyDialog} onOpenChange={setShowApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar parcialmente</DialogTitle>
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
              {isApplying ? 'Aplicando...' : 'Aplicar selección'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitMessage="Actualiza tu plan para aplicar automatizaciones"
        suggestedPlan="pro"
      />

      <ReportTemplateDialog
        open={showReportDialog}
        onOpenChange={setShowReportDialog}
        onSubmit={handleReport}
      />
    </AppLayout>
  );
};

export default CommunityTemplateDetail;
