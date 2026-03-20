import { AppLayout } from '@/components/layout/AppLayout';
import { getRoleLabel } from '@/lib/roleHierarchy';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { OperationalPanel } from '@/components/dashboard/OperationalPanel';

export default function Dashboard() {
  const { profile, organization } = useAuth();
  const { role } = usePermissions();

  const displayRoleLabel = (roleStr: string | null | undefined) => {
    if (!roleStr) return 'Miembro';
    return getRoleLabel(roleStr);
  };

  return (
    <AppLayout title="Dashboard">
      <div className="space-y-6">
        {/* Compact Welcome */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              Hola, {profile?.name || 'Usuario'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {organization?.name} · {displayRoleLabel(role)}
            </p>
          </div>
          <p className="text-sm text-muted-foreground hidden sm:block">
            {new Date().toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Full Operational Panel */}
        <OperationalPanel />
      </div>
    </AppLayout>
  );
}
