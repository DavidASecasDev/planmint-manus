import { useState } from 'react';
import { SuperAdminLayout } from './SuperAdminLayout';
import { useSuperAdminAlerts, usePaymentStats, SuperAdminAlert } from '@/hooks/useSuperAdminAlerts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  AlertTriangle, 
  Bell, 
  Check, 
  CheckCircle2, 
  DollarSign, 
  Eye, 
  ExternalLink,
  Trash2,
  Building2 
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { formatCurrencyMinorUnits, formatEUR } from '@/lib/billing';
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

export default function SuperAdminAlerts() {
  const navigate = useNavigate();
  const { 
    alerts, 
    isLoading, 
    unreadCount,
    activePaymentCount,
    markAsRead, 
    markAsResolved,
    deleteAlert 
  } = useSuperAdminAlerts();
  const { data: paymentStats, isLoading: statsLoading } = usePaymentStats();

  const [selectedAlert, setSelectedAlert] = useState<SuperAdminAlert | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const unresolvedAlerts = alerts.filter(a => !a.resolved_at);
  const resolvedAlerts = alerts.filter(a => a.resolved_at);
  const paymentAlerts = alerts.filter(a => a.alert_type === 'payment_failed' && !a.resolved_at);

  const handleMarkRead = (alert: SuperAdminAlert) => {
    if (!alert.read_at) {
      markAsRead.mutate(alert.id);
    }
  };

  const handleResolve = (alert: SuperAdminAlert) => {
    markAsResolved.mutate(alert.id);
  };

  const handleDelete = () => {
    if (selectedAlert) {
      deleteAlert.mutate(selectedAlert.id);
      setShowDeleteDialog(false);
      setSelectedAlert(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'warning': return 'default';
      default: return 'secondary';
    }
  };

  const getAlertTypeIcon = (type: string) => {
    switch (type) {
      case 'payment_failed': return <DollarSign className="h-4 w-4" />;
      case 'subscription_cancelled': return <AlertTriangle className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const AlertCard = ({ alert }: { alert: SuperAdminAlert }) => (
    <div 
      className={`p-4 rounded-lg border transition-colors ${
        !alert.read_at ? 'bg-muted/50 border-primary/20' : 'bg-card hover:bg-muted/30'
      }`}
      onClick={() => handleMarkRead(alert)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
            alert.severity === 'critical' ? 'bg-destructive/10 text-destructive' :
            alert.severity === 'warning' ? 'bg-orange-500/10 text-orange-600' :
            'bg-muted text-muted-foreground'
          }`}>
            {getAlertTypeIcon(alert.alert_type)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-sm">{alert.title}</h4>
              {!alert.read_at && (
                <Badge variant="secondary" className="text-xs">Nueva</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{alert.message}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span>{format(new Date(alert.created_at), "d MMM, HH:mm", { locale: es })}</span>
              {alert.organizations?.name && (
                <span className="flex items-center gap-1">
                  <Building2 className="h-3 w-3" />
                  {alert.organizations.name}
                </span>
              )}
              <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                {alert.severity}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {alert.organization_id && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={(e) => {
                e.stopPropagation();
                navigate(`/super-admin/organizations/${alert.organization_id}`);
              }}
            >
              <ExternalLink className="h-4 w-4" />
            </Button>
          )}
          {!alert.resolved_at && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600 hover:text-green-700"
              onClick={(e) => {
                e.stopPropagation();
                handleResolve(alert);
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAlert(alert);
              setShowDeleteDialog(true);
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Metadata details for payment failures */}
      {alert.alert_type === 'payment_failed' && alert.metadata_json && (
        <div className="mt-3 pt-3 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          {alert.metadata_json.amount && (
            <div>
              <span className="text-muted-foreground">Monto:</span>
              <span className="ml-1 font-medium">
                {formatCurrencyMinorUnits(alert.metadata_json.amount, alert.metadata_json.currency)}
              </span>
            </div>
          )}
          {alert.metadata_json.plan && (
            <div>
              <span className="text-muted-foreground">Plan:</span>
              <span className="ml-1 font-medium capitalize">{alert.metadata_json.plan}</span>
            </div>
          )}
          {alert.metadata_json.attempt_count && (
            <div>
              <span className="text-muted-foreground">Intentos:</span>
              <span className="ml-1 font-medium">{alert.metadata_json.attempt_count}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <SuperAdminLayout title="Alertas">
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Impagos Activos
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-red-500/10 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{paymentStats?.pastDueCount || 0}</span>
                  <span className="text-sm text-muted-foreground">suscripciones</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                MRR en Riesgo
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-orange-600" />
              </div>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">{formatEUR(paymentStats?.mrrAtRisk || 0)}</span>
                  <span className="text-sm text-muted-foreground">/mes</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-500/10 to-transparent rounded-bl-full" />
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Alertas Sin Leer
              </CardTitle>
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-blue-600" />
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <span className="text-3xl font-bold">{unreadCount}</span>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alerts Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Centro de Alertas
            </CardTitle>
            <CardDescription>Gestiona las alertas de impago y otros eventos críticos</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="active">
              <TabsList className="mb-4">
                <TabsTrigger value="active" className="gap-2">
                  Activas
                  {unresolvedAlerts.length > 0 && (
                    <Badge variant="secondary" className="ml-1">{unresolvedAlerts.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="payments" className="gap-2">
                  Impagos
                  {activePaymentCount > 0 && (
                    <Badge variant="destructive" className="ml-1">{activePaymentCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="resolved">Resueltas</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-3">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : unresolvedAlerts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Check className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No hay alertas activas</p>
                  </div>
                ) : (
                  unresolvedAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="payments" className="space-y-3">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : paymentAlerts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                    <p>No hay impagos pendientes</p>
                  </div>
                ) : (
                  paymentAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))
                )}
              </TabsContent>

              <TabsContent value="resolved" className="space-y-3">
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : resolvedAlerts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No hay alertas resueltas</p>
                  </div>
                ) : (
                  resolvedAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Past Due Subscriptions */}
        {paymentStats && paymentStats.pastDueSubscriptions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Suscripciones con Pago Pendiente
              </CardTitle>
              <CardDescription>
                Estas organizaciones tienen pagos atrasados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {paymentStats.pastDueSubscriptions.map((sub: any) => (
                  <div 
                    key={sub.id} 
                    className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-destructive" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{sub.organizations?.name || 'Org desconocida'}</p>
                        <p className="text-xs text-muted-foreground capitalize">Plan {sub.plan}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">Pago pendiente</Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/super-admin/organizations/${sub.organization_id}`)}
                      >
                        Ver
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar alerta?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La alerta será eliminada permanentemente.
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
    </SuperAdminLayout>
  );
}
