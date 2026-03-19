import { Download, Smartphone, Monitor, Apple, Chrome, MoreVertical, Share } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

export default function Install() {
  const { installApp, isInstallable, isInstalled } = usePWA();
  const navigate = useNavigate();

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      navigate("/dashboard");
    }
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Smartphone className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>¡App instalada!</CardTitle>
            <CardDescription>
              Ya tienes PlanMint instalada en tu dispositivo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              Ir al Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mb-4">
            <img src="/pwa-192x192.png" alt="Goals" className="w-16 h-16 rounded-2xl" />
          </div>
          <h1 className="text-2xl font-bold">Instalar PlanMint</h1>
          <p className="text-muted-foreground mt-2">
            Accede más rápido y usa la app incluso sin conexión
          </p>
        </div>

        {/* Direct Install Button */}
        {isInstallable && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <Button onClick={handleInstall} size="lg" className="w-full">
                <Download className="mr-2 h-5 w-5" />
                Instalar ahora
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Installation Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Instrucciones de instalación</CardTitle>
            <CardDescription>
              Selecciona tu dispositivo para ver las instrucciones
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="ios" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ios" className="flex items-center gap-2">
                  <Apple className="h-4 w-4" />
                  <span className="hidden sm:inline">iOS</span>
                </TabsTrigger>
                <TabsTrigger value="android" className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4" />
                  <span className="hidden sm:inline">Android</span>
                </TabsTrigger>
                <TabsTrigger value="desktop" className="flex items-center gap-2">
                  <Monitor className="h-4 w-4" />
                  <span className="hidden sm:inline">Desktop</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ios" className="mt-4 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Abre Safari</p>
                    <p className="text-sm text-muted-foreground">
                      Esta función solo está disponible en Safari
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">2</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Toca el botón Compartir</p>
                    <Share className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Selecciona "Añadir a pantalla de inicio"</p>
                    <p className="text-sm text-muted-foreground">
                      Desplázate hacia abajo si no lo ves
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">4</span>
                  </div>
                  <div>
                    <p className="font-medium">Toca "Añadir"</p>
                    <p className="text-sm text-muted-foreground">
                      ¡Listo! La app aparecerá en tu pantalla de inicio
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="android" className="mt-4 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">1</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Abre Chrome</p>
                    <Chrome className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">2</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Toca el menú</p>
                    <MoreVertical className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Selecciona "Instalar app" o "Añadir a pantalla de inicio"</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">4</span>
                  </div>
                  <div>
                    <p className="font-medium">Confirma la instalación</p>
                    <p className="text-sm text-muted-foreground">
                      ¡Listo! La app se instalará en tu dispositivo
                    </p>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="desktop" className="mt-4 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">1</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">Usa Chrome, Edge o Brave</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Busca el icono de instalación</p>
                    <p className="text-sm text-muted-foreground">
                      En la barra de direcciones, a la derecha
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Haz clic en "Instalar"</p>
                    <p className="text-sm text-muted-foreground">
                      La app se abrirá en su propia ventana
                    </p>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Benefits */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="text-center p-4">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium text-sm">Acceso rápido</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Abre la app directamente desde tu pantalla de inicio
            </p>
          </div>
          <div className="text-center p-4">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium text-sm">Modo offline</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Consulta tus tareas incluso sin conexión
            </p>
          </div>
          <div className="text-center p-4">
            <div className="mx-auto w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
              <Monitor className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-medium text-sm">Pantalla completa</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Experiencia inmersiva sin barras del navegador
            </p>
          </div>
        </div>

        {/* Back to app */}
        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            Volver a la app
          </Button>
        </div>
      </div>
    </div>
  );
}
