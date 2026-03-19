import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useTaskSummary() {
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

  const generateSummary = useCallback(async (taskId: string) => {
    setIsLoading(true);
    setSummary(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { type: 'task_summary', taskId },
      });

      if (error) {
        console.error('AI summary error:', error);
        if (error.message?.includes('429')) {
          toast.error('Límite de solicitudes alcanzado. Intenta más tarde.');
        } else if (error.message?.includes('402')) {
          toast.error('Créditos de IA agotados.');
        } else {
          toast.error('Error al generar el resumen');
        }
        return null;
      }

      setSummary(data.summary);
      setLastGenerated(new Date());
      return data.summary;
    } catch (err) {
      console.error('Task summary error:', err);
      toast.error('Error al generar el resumen');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearSummary = useCallback(() => {
    setSummary(null);
    setLastGenerated(null);
  }, []);

  return {
    summary,
    isLoading,
    lastGenerated,
    generateSummary,
    clearSummary,
  };
}
