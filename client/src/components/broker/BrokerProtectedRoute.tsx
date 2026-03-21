import { Navigate } from 'react-router-dom';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { BrokerLayout } from './BrokerLayout';
import { Loader2 } from 'lucide-react';

interface BrokerProtectedRouteProps {
  children: React.ReactNode;
}

export function BrokerProtectedRoute({ children }: BrokerProtectedRouteProps) {
  const { user, broker, loading, isBroker } = useBrokerAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando acceso...</p>
        </div>
      </div>
    );
  }

  // Not authenticated at all
  if (!user) {
    return <Navigate to="/broker/login" replace />;
  }

  // Authenticated but not a broker
  if (!isBroker || !broker) {
    return <Navigate to="/broker/login" replace />;
  }

  return (
    <BrokerLayout>
      {children}
    </BrokerLayout>
  );
}
