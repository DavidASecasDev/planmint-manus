import React, { useState, useEffect } from 'react';
import { apiInvoke } from '@/lib/apiClient';
import { Clock, CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PunctualitySummaryData {
  date: string;
  total_arrivals: number;
  with_estimate: number;
  on_time: number;
  late: number;
  on_time_percent: number;
  avg_diff_minutes: number;
}

interface PunctualitySummaryProps {
  date: string | null; // YYYY-MM-DD
}

export function PunctualitySummary({ date }: PunctualitySummaryProps) {
  const [summary, setSummary] = useState<PunctualitySummaryData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    let cancelled = false;
    setLoading(true);

    (async () => {
      try {
        const resp = await apiInvoke<{ ok: boolean; summary: PunctualitySummaryData }>(
          'en-camino-tracking/summary',
          { body: { date } }
        );
        if (cancelled) return;
        if (resp.data?.ok) {
          setSummary(resp.data.summary);
        }
      } catch (err) {
        console.error('[punctuality-summary] Error:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [date]);

  // Don't render if no data or no arrivals
  if (loading || !summary || summary.total_arrivals === 0) return null;

  const { total_arrivals, with_estimate, on_time, late, on_time_percent, avg_diff_minutes } = summary;

  // Color coding for on-time percentage
  const percentColor = on_time_percent >= 80
    ? 'text-emerald-600'
    : on_time_percent >= 50
      ? 'text-amber-600'
      : 'text-red-600';

  const percentBg = on_time_percent >= 80
    ? 'bg-emerald-50 border-emerald-200'
    : on_time_percent >= 50
      ? 'bg-amber-50 border-amber-200'
      : 'bg-red-50 border-red-200';

  // Color for avg diff
  const avgDiffColor = avg_diff_minutes <= 0
    ? 'text-emerald-600'
    : avg_diff_minutes <= 5
      ? 'text-amber-600'
      : 'text-red-600';

  return (
    <div className={cn('flex items-center gap-4 px-4 py-2 rounded-lg border text-sm', percentBg)}>
      <div className="flex items-center gap-1.5">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium text-muted-foreground">Puntualidad:</span>
      </div>

      <div className="flex items-center gap-1">
        <span className={cn('font-bold text-lg', percentColor)}>{on_time_percent}%</span>
        <span className="text-muted-foreground text-xs">a tiempo</span>
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-1">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        <span className="text-muted-foreground">{on_time} a tiempo</span>
      </div>

      <div className="flex items-center gap-1">
        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
        <span className="text-muted-foreground">{late} tarde</span>
      </div>

      <div className="h-4 w-px bg-border" />

      <div className="flex items-center gap-1">
        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-muted-foreground">Desviación media:</span>
        <span className={cn('font-medium', avgDiffColor)}>
          {avg_diff_minutes > 0 ? '+' : ''}{avg_diff_minutes} min
        </span>
      </div>

      <div className="h-4 w-px bg-border" />

      <span className="text-muted-foreground text-xs">
        {total_arrivals} llegadas ({with_estimate} con estimación)
      </span>
    </div>
  );
}
