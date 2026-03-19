import { Sparkles, RefreshCw, Copy, Check, Settings } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTaskSummary } from '@/hooks/useTaskSummary';
import { useAIFeatures } from '@/hooks/useAIFeatures';
import { toast } from 'sonner';

interface TaskSummaryCardProps {
  taskId: string;
}

export function TaskSummaryCard({ taskId }: TaskSummaryCardProps) {
  const navigate = useNavigate();
  const { summary, isLoading, lastGenerated, generateSummary } = useTaskSummary();
  const { taskSummary: hasAccess, isLoading: accessLoading } = useAIFeatures();
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!hasAccess) {
      navigate('/settings?tab=integrations');
      return;
    }
    await generateSummary(taskId);
  };

  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      setCopied(true);
      toast.success('Resumen copiado');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (accessLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  return (
    <Card className="border-border/50 shadow-sm overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-500" />
          Resumen con IA
          {!hasAccess && (
            <span className="ml-auto text-xs bg-muted px-2 py-0.5 rounded-full flex items-center gap-1">
              <Settings className="h-3 w-3" />
              Sin API key
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {!summary && !isLoading && (
          <Button
            onClick={handleGenerate}
            variant={hasAccess ? "default" : "outline"}
            className="w-full gap-2"
            disabled={isLoading}
          >
            <Sparkles className="h-4 w-4" />
            {hasAccess ? 'Generar resumen con IA' : 'Configurar API key'}
          </Button>
        )}

        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {summary && !isLoading && (
          <>
            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap bg-muted/50 p-3 rounded-lg border">
              {summary}
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
