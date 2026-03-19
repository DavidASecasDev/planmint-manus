import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { usePWA } from "@/hooks/usePWA";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function InstallPrompt() {
  const { installApp, shouldShowInstallPrompt, dismissInstallPrompt, isInstalled } = usePWA();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Delay showing the prompt for better UX
    const timer = setTimeout(() => {
      setIsVisible(shouldShowInstallPrompt());
    }, 3000);

    return () => clearTimeout(timer);
  }, [shouldShowInstallPrompt]);

  if (!isVisible || isInstalled) return null;

  const handleInstall = async () => {
    const success = await installApp();
    if (success) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    dismissInstallPrompt();
    setIsVisible(false);
  };

  return (
    <Card className={cn(
      "fixed bottom-20 left-4 right-4 z-40 md:left-auto md:right-4 md:w-80",
      "shadow-xl border-primary/20",
      "animate-in slide-in-from-bottom-4"
    )}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">Instalar PlanMint</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Accede más rápido y usa la app sin conexión
            </p>
            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={handleInstall} className="h-8 text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Instalar
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss} className="h-8 text-xs">
                Ahora no
              </Button>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mt-1 -mr-1"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
