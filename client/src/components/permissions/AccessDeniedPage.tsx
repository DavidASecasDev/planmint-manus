import { Lock, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

interface AccessDeniedPageProps {
  title?: string;
  description?: string;
  showBackButton?: boolean;
}

/**
 * Full-page component shown when user lacks permission to access a feature.
 */
export function AccessDeniedPage({ 
  title = 'Sin acceso',
  description = 'No tienes permiso para acceder a esta sección. Contacta a un administrador si crees que deberías tener acceso.',
  showBackButton = true
}: AccessDeniedPageProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Lock className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-6 max-w-md">{description}</p>
      {showBackButton && (
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      )}
    </div>
  );
}
