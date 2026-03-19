import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTemplates } from '@/hooks/useTemplates';
import { AppLayout } from '@/components/layout/AppLayout';
import { SEOHead } from '@/components/seo/SEOHead';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CardSkeleton, ListSkeleton } from '@/components/ui/loading-skeleton';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
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
  AlertTriangle
} from 'lucide-react';
import { Template, TemplateVersion, TemplateConfig, ApplyOptions, CATEGORY_LABELS, INDUSTRY_LABELS } from '@/types/templates';
import * as LucideIcons from 'lucide-react';

const TemplateDetail = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { fetchTemplateBySlug, applyTemplate, isApplying, canManageTemplates, currentPlan } = useTemplates();

  const [template, setTemplate] = useState<Template | null>(null);
  const [version, setVersion] = useState<TemplateVersion | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplyDialog, setShowApplyDialog] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
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
      const result = await fetchTemplateBySlug(slug);
      if (result) {
        setTemplate(result.template);
        setVersion(result.version);
      }
    } finally {
      setLoading(false);
    }
  }, [slug, fetchTemplateBySlug]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const config = version?.config_json as TemplateConfig | undefined;

  const handleApply = (partial: boolean) => {
    if (!canManageTemplates) {
      return;
    }

    if (partial) {
      setShowApplyDialog(true);
    } else {
      // Apply all (except automations if free plan)
      const options: ApplyOptions = {
        areas: true,
        tags: true,
        kanban_columns: true,
        tasks: true,
        automations: currentPlan !== 'free' && (config?.automations?.length || 0) > 0,
      };

      if (version) {
        applyTemplate(version.id, options);
      }
    }
  };

  const handleConfirmApply = () => {
    if (version) {
      applyTemplate(version.id, applyOptions);
      setShowApplyDialog(false);
    }
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

  if (!template || !version) {
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
    template.icon.split('-').map((s, i) => 
      i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
    ).join('')
  ] || LayoutTemplate;

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
                style={{ backgroundColor: `${template.color}20` }}
              >
                <IconComponent 
                  className="h-10 w-10" 
                  style={{ color: template.color }} 
                />
              </div>
              <div className="flex-1">
                <div className="flex items-start justify-between flex-wrap gap-4">
                  <div>
                    <h1 className="text-2xl font-bold">{template.name}</h1>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline">
                        {CATEGORY_LABELS[template.category]}
                        {template.industry && ` · ${INDUSTRY_LABELS[template.industry] || template.industry}`}
                      </Badge>
                      {template.is_featured && (
                        <Badge variant="secondary">Destacada</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
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
                      {isApplying ? 'Aplicando...' : 'Aplicar plantilla'}
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

          {/* Kanban preview */}
          {config?.kanban_columns && config.kanban_columns.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Columns3 className="h-4 w-4" />
                  Columnas Kanban
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {config.kanban_columns.map((col, i) => (
                    <div 
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg border min-w-fit"
                    >
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: col.color }}
                      />
                      <span className="text-sm font-medium">{col.label}</span>
                    </div>
                  ))}
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
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Automations preview */}
        {config?.automations && config.automations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Automatizaciones
                {automationsBlocked && (
                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                    Requiere Pro
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {config.automations.map((auto, i) => (
                  <div 
                    key={i} 
                    className={`p-3 rounded-lg border ${automationsBlocked ? 'opacity-50' : ''}`}
                  >
                    <div className="font-medium text-sm">{auto.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Trigger: {auto.trigger_type.replace(/_/g, ' ')}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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
              <span>Tareas y objetivos ({config?.tasks?.length || 0})</span>
            </label>
            <label className={`flex items-center gap-3 ${automationsBlocked ? 'opacity-50' : 'cursor-pointer'}`}>
              <Checkbox 
                checked={applyOptions.automations && !automationsBlocked}
                onCheckedChange={(checked) => 
                  setApplyOptions(prev => ({ ...prev, automations: !!checked }))
                }
                disabled={!config?.automations?.length || automationsBlocked}
              />
              <Zap className="h-4 w-4 text-muted-foreground" />
              <span>Automatizaciones ({config?.automations?.length || 0})</span>
              {automationsBlocked && (
                <Badge variant="outline" className="text-amber-600 text-xs">Pro</Badge>
              )}
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowApplyDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirmApply} disabled={isApplying}>
              {isApplying ? 'Aplicando...' : 'Aplicar seleccionados'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade modal */}
      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitMessage="Las automatizaciones están disponibles en el plan Pro o superior."
        suggestedPlan="pro"
      />
    </AppLayout>
  );
};

export default TemplateDetail;
