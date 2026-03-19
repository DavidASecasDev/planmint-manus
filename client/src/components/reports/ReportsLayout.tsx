import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { AccessDeniedPage } from '@/components/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useOrganizationModules } from '@/hooks/useOrganizationModules';
import { useSubscription } from '@/hooks/useSubscription';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { cn } from '@/lib/utils';
import { BarChart3, Car, ArrowUpDown, Repeat2, Wrench, Loader2, Lock } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface ReportSection {
  key: string;
  label: string;
  icon: React.ElementType;
  path: string;
  moduleKey?: string;
}

const REPORT_SECTIONS: ReportSection[] = [
  { key: 'general', label: 'General', icon: BarChart3, path: '/reports' },
  { key: 'vehicles', label: 'Flota', icon: Car, path: '/reports/vehicles', moduleKey: 'vehicle_status' },
  { key: 'movements', label: 'Movimientos', icon: ArrowUpDown, path: '/reports/movements', moduleKey: 'movements' },
  { key: 'transfers', label: 'Transfers', icon: Repeat2, path: '/reports/transfers', moduleKey: 'transfers' },
  { key: 'garatech', label: 'Garatech', icon: Wrench, path: '/reports/garatech', moduleKey: 'garatech' },
];

interface ReportsLayoutProps {
  children: ReactNode;
}

export function ReportsLayout({ children }: ReportsLayoutProps) {
  const { hasPermission, isLoading: permissionsLoading } = usePermissions();
  const { isModuleEnabled } = useOrganizationModules();
  const { isProPlan, isTeamPlan } = useSubscription();
  const location = useLocation();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const hasPlanAccess = isProPlan || isTeamPlan;

  const visibleSections = REPORT_SECTIONS.filter(
    (s) => !s.moduleKey || isModuleEnabled(s.moduleKey as any)
  );

  if (permissionsLoading) {
    return (
      <AppLayout title="Reportes">
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!hasPermission('reports.view')) {
    return (
      <AppLayout title="Reportes">
        <AccessDeniedPage
          title="Sin acceso a reportes"
          description="No tienes permiso para ver los reportes. Contacta a tu administrador si crees que deberías tener acceso."
        />
      </AppLayout>
    );
  }

  if (!hasPlanAccess) {
    return (
      <AppLayout title="Reportes">
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Reportes avanzados</h2>
          <p className="text-muted-foreground mb-6 max-w-md">Accede a métricas de productividad con el plan Pro o Team.</p>
          <Button onClick={() => setShowUpgrade(true)}>Actualizar plan</Button>
          <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Reportes">
      <div className="space-y-6">
        {/* Top horizontal tabs */}
        <ScrollArea className="w-full">
          <div className="flex gap-1.5 pb-1">
            {visibleSections.map((section) => {
              const isActive = location.pathname === section.path;
              const Icon = section.icon;
              return (
                <Link
                  key={section.key}
                  to={section.path}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {section.label}
                </Link>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        {/* Main content — full width */}
        {children}
      </div>
    </AppLayout>
  );
}
