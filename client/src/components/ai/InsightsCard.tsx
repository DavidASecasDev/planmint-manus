import { Sparkles, RefreshCw, Settings, Lightbulb, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useInsights } from '@/hooks/useInsights';
import { useAIFeatures } from '@/hooks/useAIFeatures';

export function InsightsCard() {
  const navigate = useNavigate();
  const { insights, isLoading, lastGenerated, generateInsights } = useInsights();
  const { insights: hasAccess, isLoading: accessLoading } = useAIFeatures();

  const handleGenerate = async () => {
    if (!hasAccess) {
      navigate('/settings?tab=integrations');
      return;
    }
    await generateInsights();
  };

  if (accessLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Insights del equipo
          {!hasAccess && (
            <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
              <Settings className="h-3 w-3" />
              Sin API key
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {!insights && !isLoading && (
          <div className="text-center py-4">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Detecta bloqueos, riesgos y oportunidades de mejora en tu equipo.
            </p>
            <Button
              onClick={handleGenerate}
              variant={hasAccess ? "default" : "outline"}
              className="gap-2"
              disabled={isLoading}
            >
              <Sparkles className="h-4 w-4" />
              {hasAccess ? 'Analizar ahora' : 'Configurar API key'}
            </Button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-2 py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-4/5" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}

        {insights && !isLoading && (
          <>
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/50 p-4 rounded-lg border">
              {insights}
            </div>
            
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                Analizado {lastGenerated?.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerate}
                className="gap-1"
                disabled={isLoading}
              >
                <RefreshCw className="h-3 w-3" />
                Actualizar
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
