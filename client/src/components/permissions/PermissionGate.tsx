import { ReactNode } from 'react';
import { usePermissions, PermissionKey } from '@/hooks/usePermissions';
import { Loader2 } from 'lucide-react';

interface PermissionGateProps {
  permission: PermissionKey;
  children: ReactNode;
  fallback?: ReactNode;
  showLoading?: boolean;
}

/**
 * Component that conditionally renders children based on permission check.
 * Use this to gate UI elements based on user permissions.
 */
export function PermissionGate({ 
  permission, 
  children, 
  fallback = null,
  showLoading = true 
}: PermissionGateProps) {
  const { hasPermission, isLoading } = usePermissions();

  if (isLoading && showLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPermission(permission)) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
