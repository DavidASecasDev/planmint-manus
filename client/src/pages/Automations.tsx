import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { ListSkeleton, TableSkeleton } from '@/components/ui/loading-skeleton';
import { 
  Zap, 
  Plus, 
  Settings2, 
  History, 
  Trash2, 
  Edit,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Crown
} from 'lucide-react';
import { useAutomationRules } from '@/hooks/useAutomationRules';
import { AutomationRule, AutomationRun, TRIGGER_OPTIONS } from '@/types/automations';
import { AutomationRuleDialog } from '@/components/automations/AutomationRuleDialog';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
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

export default function Automations() {
  const {
    rules,
    runs,
    loading,
    runsLoading,
    canCreateRules,
    canManageRules,
    ruleLimit,
    currentPlan,
    rulesCount,
    fetchRuns,
    toggleRule,
    deleteRule,
  } = useAutomationRules();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('rules');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    if (tab === 'logs') {
      fetchRuns();
    }
  };

  const handleNewRule = () => {
    if (!canCreateRules) {
      setShowUpgradeModal(true);
      return;
    }
    setEditingRule(null);
    setIsDialogOpen(true);
  };

  const handleEditRule = (rule: AutomationRule) => {
    setEditingRule(rule);
    setIsDialogOpen(true);
  };

  const handleDeleteRule = async () => {
    if (deleteConfirm) {
      await deleteRule(deleteConfirm);
      setDeleteConfirm(null);
    }
  };

  const getTriggerLabel = (triggerType: string) => {
    return TRIGGER_OPTIONS.find(t => t.value === triggerType)?.label || triggerType;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-destructive" />;
      case 'skipped':
        return <Clock className="h-4 w-4 text-muted-foreground" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      success: 'default',
      failed: 'destructive',
      skipped: 'secondary',
      pending: 'outline',
    };
    const labels: Record<string, string> = {
      success: 'Éxito',
      failed: 'Error',
      skipped: 'Omitido',
      pending: 'Pendiente',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {labels[status] || status}
      </Badge>
    );
  };

  if (!canManageRules) {
    return (
      <AppLayout title="Automatizaciones">
        <div className="flex items-center justify-center h-[60vh]">
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Automatizaciones
              </CardTitle>
              <CardDescription>
                Solo los administradores y managers pueden gestionar las automatizaciones.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (currentPlan === 'free') {
    return (
      <AppLayout title="Automatizaciones">
        <PageHeader
          title="Automatizaciones"
          description="Automatiza flujos de trabajo con reglas personalizadas"
          icon={Zap}
        />
        <div className="p-6">
          <Card className="max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Crown className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Actualiza tu plan</CardTitle>
              <CardDescription>
                Las automatizaciones están disponibles en los planes Pro y Team.
                Crea reglas para automatizar tareas repetitivas y mantén a tu equipo informado.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Button onClick={() => setShowUpgradeModal(true)}>
                Ver planes
              </Button>
            </CardContent>
          </Card>
        </div>
        <UpgradeModal 
          open={showUpgradeModal} 
          onOpenChange={setShowUpgradeModal} 
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Automatizaciones">
      <PageHeader
        title="Automatizaciones"
        description="Automatiza flujos de trabajo con reglas personalizadas"
        icon={Zap}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {rulesCount} / {ruleLimit === Infinity ? '∞' : ruleLimit} reglas
            </span>
            <Button onClick={handleNewRule}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva regla
            </Button>
          </div>
        }
      />

      <div className="p-6">
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="rules" className="gap-2">
              <Settings2 className="h-4 w-4" />
              Reglas
            </TabsTrigger>
            <TabsTrigger value="logs" className="gap-2">
              <History className="h-4 w-4" />
              Historial
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rules" className="mt-6">
            {loading ? (
              <ListSkeleton count={3} />
            ) : rules.length === 0 ? (
              <EmptyState
                icon={Zap}
                title="Sin automatizaciones"
                description="Crea tu primera regla para automatizar tareas repetitivas"
                action={{
                  label: 'Crear regla',
                  onClick: handleNewRule,
                }}
              />
            ) : (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <Card key={rule.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Switch
                            checked={rule.is_active}
                            onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                          />
                          <div>
                            <h3 className="font-medium">{rule.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              Trigger: {getTriggerLabel(rule.trigger_type)}
                              {rule.conditions_json.all && rule.conditions_json.all.length > 0 && (
                                <> · {rule.conditions_json.all.length} condiciones</>
                              )}
                              {rule.actions_json.actions && (
                                <> · {rule.actions_json.actions.length} acciones</>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={rule.is_active ? 'default' : 'secondary'}>
                            {rule.is_active ? 'Activa' : 'Inactiva'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditRule(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteConfirm(rule.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-6">
            {runsLoading ? (
              <TableSkeleton rows={5} columns={4} />
            ) : runs.length === 0 ? (
              <EmptyState
                icon={History}
                title="Sin ejecuciones"
                description="Aquí verás el historial de ejecuciones de tus automatizaciones"
              />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {runs.map((run) => (
                      <div key={run.id} className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(run.status)}
                          <div>
                            <p className="font-medium text-sm">
                              {rules.find(r => r.id === run.rule_id)?.name || 'Regla eliminada'}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {run.message || getTriggerLabel(run.trigger_type)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {getStatusBadge(run.status)}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(run.created_at), { 
                              addSuffix: true, 
                              locale: es 
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AutomationRuleDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingRule={editingRule}
      />

      <UpgradeModal 
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal} 
      />

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar regla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La regla y su historial de ejecuciones serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRule}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
