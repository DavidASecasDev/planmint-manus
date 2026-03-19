import { ReactNode } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { WifiOff, RefreshCw, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface OfflineBlockerProps {
  children: ReactNode;
  message?: string;
  /** If true, blocks even for Pro/Team plans (for things that truly require internet like payments) */
  alwaysBlock?: boolean;
  /** Entity type for plan-based offline access */
  entityType?: string;
  /** Action type for plan-based offline access */
  action?: 'create' | 'update' | 'delete';
}

export function OfflineBlocker({ 
  children, 
  message = "Esta acción requiere conexión a internet",
  alwaysBlock = false,
  entityType,
  action = 'create'
}: OfflineBlockerProps) {
  const { isOnline } = useOnlineStatus();
  const { subscription } = useSubscription();
  const navigate = useNavigate();
  const plan = subscription?.plan || 'free';

  // If online, always show children
  if (isOnline) {
    return <>{children}</>;
  }

  // Some features always require internet
  if (alwaysBlock) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Sin conexión</h3>
        <p className="text-sm text-muted-foreground max-w-sm mb-4">
          {message}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  // Pro/Team plans can do most things offline
  if (plan === 'pro' || plan === 'team') {
    return <>{children}</>;
  }

  // Free plan: limited offline functionality
  // Allow status updates and subtask toggling
  if (action === 'update' && entityType && ['subtask', 'task'].includes(entityType)) {
    return <>{children}</>;
  }

  // Block other offline actions for Free plan
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
        <WifiOff className="h-8 w-8 text-amber-600" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Funcionalidad offline limitada</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-4">
        Con el plan Free solo puedes cambiar estados de tareas y subtareas sin conexión.
        Actualiza a Pro para crear y editar contenido offline.
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reintentar
        </Button>
        <Button
          size="sm"
          onClick={() => navigate('/settings')}
          className="gap-2"
        >
          <Crown className="h-4 w-4" />
          Actualizar a Pro
        </Button>
      </div>
    </div>
  );
}
