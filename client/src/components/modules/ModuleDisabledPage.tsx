import { Lock, Mail } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AppLayout } from '@/components/layout/AppLayout';

interface ModuleDisabledPageProps {
  moduleName: string;
  moduleDescription?: string;
}

export function ModuleDisabledPage({ moduleName, moduleDescription }: ModuleDisabledPageProps) {
  return (
    <AppLayout title={moduleName}>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Lock className="h-7 w-7 text-muted-foreground" />
            </div>
            <CardTitle className="text-xl">Módulo no activado</CardTitle>
            <CardDescription className="text-base">
              {moduleDescription || `El módulo "${moduleName}" no está habilitado para tu organización.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Si necesitas esta funcionalidad, contacta con el administrador de la plataforma para solicitar su activación.
            </p>
            <Button variant="outline" className="gap-2" asChild>
              <a href="mailto:soporte@planmint.app">
                <Mail className="h-4 w-4" />
                Contactar soporte
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
