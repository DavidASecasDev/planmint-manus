import { ReactNode } from 'react';
import { useOrganizationModules, ModuleKey } from '@/hooks/useOrganizationModules';
import { ModuleDisabledPage } from './ModuleDisabledPage';
import { Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

interface ModuleRouteProps {
  moduleKey: ModuleKey;
  moduleName: string;
  moduleDescription?: string;
  children: ReactNode;
}

export function ModuleRoute({ moduleKey, moduleName, moduleDescription, children }: ModuleRouteProps) {
  const { isModuleEnabled, isLoading } = useOrganizationModules();

  if (isLoading) {
    return (
      <AppLayout title={moduleName}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isModuleEnabled(moduleKey)) {
    return <ModuleDisabledPage moduleName={moduleName} moduleDescription={moduleDescription} />;
  }

  return <>{children}</>;
}
