import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Lock } from 'lucide-react';

interface AreaAccessDeniedProps {
  message?: string;
}

export function AreaAccessDenied({ message }: AreaAccessDeniedProps) {
  return (
    <Alert variant="destructive" className="my-8">
      <Lock className="h-4 w-4" />
      <AlertTitle>Sin permiso</AlertTitle>
      <AlertDescription>
        {message || 'No tienes permiso para ver este contenido. Contacta a un administrador si crees que deberías tener acceso.'}
      </AlertDescription>
    </Alert>
  );
}
