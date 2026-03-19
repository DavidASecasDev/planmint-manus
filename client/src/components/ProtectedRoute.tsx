import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  requireOrganization?: boolean;
}

export function ProtectedRoute({ children, requireOrganization = true }: ProtectedRouteProps) {
  const { user, profile, loading, profileLoading } = useAuth();
  const location = useLocation();

  // Show spinner during initial load OR profile loading
  if (loading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Authenticated but no profile or no organization → onboarding
  if (requireOrganization && (!profile || !profile.organization_id)) {
    return <Navigate to="/onboarding/create-organization" replace />;
  }

  return <>{children}</>;
}
