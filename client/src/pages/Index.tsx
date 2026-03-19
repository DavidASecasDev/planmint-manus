import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';

const Index = () => {
  const { user, profile, loading, profileLoading } = useAuth();

  // Wait for both initial loading AND profile loading
  if (loading || profileLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated -> login
  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  // Authenticated but no organization -> onboarding
  if (profile && !profile.organization_id) {
    return <Navigate to="/onboarding/create-organization" replace />;
  }

  // Authenticated with organization -> dashboard
  return <Navigate to="/dashboard" replace />;
};

export default Index;
