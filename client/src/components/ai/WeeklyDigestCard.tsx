import { Sparkles, RefreshCw, Copy, Check, Settings, Calendar } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useWeeklyDigest } from '@/hooks/useWeeklyDigest';
import { useAIFeatures } from '@/hooks/useAIFeatures';
import { toast } from 'sonner';

export function WeeklyDigestCard() {
  const navigate = useNavigate();
  const { digest, isLoading, lastGenerated, generateDigest } = useWeeklyDigest();
  const { weeklyDigest: hasAccess, isLoading: accessLoading } = useAIFeatures();
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!hasAccess) {
      navigate('/settings?tab=integrations');
      return;
    }
    await generateDigest();
  };

  const handleCopy = () => {
    if (digest) {
      navigator.clipboard.writeText(digest);
      setCopied(true);
      toast.success('Resumen copiado');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (accessLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-500/10 to-cyan-500/10">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-500" />
          Resumen semanal del equipo
          {!hasAccess && (
            <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
              <Settings className="h-3 w-3" />
              Sin API key
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {!digest && !isLoading && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-3">
              Genera un resumen ejecutivo de la actividad del equipo esta semana.
            </p>
            <Button
              onClick={handleGenerate}
              variant={hasAccess ? "default" : "outline"}
              className="gap-2"
              disabled={isLoading}
            >
              <Sparkles className="h-4 w-4" />
              {hasAccess ? 'Generar resumen semanal' : 'Configurar API key'}
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2 py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        )}

        {digest && !isLoading && (
          <>
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/50 p-4 rounded-lg border">
              {digest}
            </div>
            
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Generado {lastGenerated?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="gap-1"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'Copiado' : 'Copiar'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGenerate}
                  className="gap-1"
                  disabled={isLoading}
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerar
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
