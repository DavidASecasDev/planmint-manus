import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ReportInsight } from '@/types/reports';
import { 
  AlertTriangle, 
  Clock, 
  Target, 
  TrendingUp, 
  Timer, 
  ArrowUp, 
  ArrowDown,
  Lightbulb
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface InsightsPanelProps {
  insights: ReportInsight[];
}

const iconMap: Record<string, React.ElementType> = {
  AlertTriangle,
  Clock,
  Target,
  TrendingUp,
  Timer,
  ArrowUp,
  ArrowDown,
};

export function InsightsPanel({ insights }: InsightsPanelProps) {
  if (insights.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No hay insights disponibles para el periodo seleccionado.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Insights
          <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0">
            {insights.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        <ScrollArea className="h-full max-h-[320px]">
          <div className="space-y-2.5 pr-2">
            {insights.map((insight, index) => {
              const Icon = iconMap[insight.icon] || AlertTriangle;
              
              return (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-2.5 p-2.5 rounded-lg text-sm",
                    insight.type === 'warning' && "bg-amber-50 dark:bg-amber-900/20 border border-amber-200/60 dark:border-amber-800/40",
                    insight.type === 'success' && "bg-green-50 dark:bg-green-900/20 border border-green-200/60 dark:border-green-800/40",
                    insight.type === 'info' && "bg-blue-50 dark:bg-blue-900/20 border border-blue-200/60 dark:border-blue-800/40"
                  )}
                >
                  <Icon className={cn(
                    "h-3.5 w-3.5 mt-0.5 flex-shrink-0",
                    insight.type === 'warning' && "text-amber-600 dark:text-amber-400",
                    insight.type === 'success' && "text-green-600 dark:text-green-400",
                    insight.type === 'info' && "text-blue-600 dark:text-blue-400"
                  )} />
                  <p className={cn(
                    "text-[13px] leading-snug font-medium flex-1",
                    insight.type === 'warning' && "text-amber-800 dark:text-amber-200",
                    insight.type === 'success' && "text-green-800 dark:text-green-200",
                    insight.type === 'info' && "text-blue-800 dark:text-blue-200"
                  )}>
                    {insight.message}
                  </p>
                  {insight.trend && (
                    <Badge variant={insight.trend === 'up' ? 'default' : 'secondary'} className="flex-shrink-0 text-[10px] px-1.5">
                      {insight.trend === 'up' ? '↑' : '↓'}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
