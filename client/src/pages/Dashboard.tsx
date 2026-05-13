/*
 * Azul Cars Brand — Dashboard
 * Headings: Montserrat 700 | Body: Barlow
 * Text: #0F1216 dark | Muted: #52555B
 * Gold accent: oklch(0.72 0.10 80)
 */
import { AppLayout } from '@/components/layout/AppLayout';
import { getRoleLabel } from '@/lib/roleHierarchy';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { OperationalPanel } from '@/components/dashboard/OperationalPanel';
import { EquipmentStockWidget } from '@/components/dashboard/EquipmentStockWidget';
import { StaffCapacityAlert } from '@/components/StaffCapacityAlert';
import { useMemo } from 'react';
import { format } from 'date-fns';

export default function Dashboard() {
  const { profile, organization } = useAuth();
  const { role } = usePermissions();

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const displayRoleLabel = (roleStr: string | null | undefined) => {
    if (!roleStr) return 'Miembro';
    return getRoleLabel(roleStr);
  };

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Compact Welcome */}
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2
              className="text-lg sm:text-xl text-foreground"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
              }}
            >
              Hola, {profile?.name || 'Usuario'}
            </h2>
            <p
              className="text-sm text-muted-foreground"
              style={{
                fontFamily: 'Barlow, sans-serif',
              }}
            >
              {organization?.name} · {displayRoleLabel(role)}
            </p>
          </div>
          <p
            className="text-sm hidden sm:block text-muted-foreground"
            style={{
              fontFamily: 'Barlow, sans-serif',
            }}
          >
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Staff Capacity Alert */}
        <StaffCapacityAlert date={todayStr} compact />

        {/* Full Operational Panel */}
        <OperationalPanel />

        {/* Equipment Stock Widget */}
        <EquipmentStockWidget />
      </div>
    </AppLayout>
  );
}
