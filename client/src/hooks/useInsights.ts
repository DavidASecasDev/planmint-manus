import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useInsights() {
  const { profile } = useAuth();
  const [insights, setInsights] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

  const generateInsights = useCallback(async () => {
    if (!profile?.organization_id) {
      toast.error('No se pudo identificar la organización');
      return null;
    }

    setIsLoading(true);
    setInsights(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { type: 'insights', organizationId: profile.organization_id },
      });

      if (error) {
        console.error('Insights error:', error);
        if (error.message?.includes('429')) {
          toast.error('Límite de solicitudes alcanzado. Intenta más tarde.');
        } else if (error.message?.includes('402')) {
          toast.error('Créditos de IA agotados.');
        } else {
          toast.error('Error al generar los insights');
        }
        return null;
      }

      setInsights(data.summary);
      setLastGenerated(new Date());
      return data.summary;
    } catch (err) {
      console.error('Insights error:', err);
      toast.error('Error al generar los insights');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.organization_id]);

  const clearInsights = useCallback(() => {
    setInsights(null);
    setLastGenerated(null);
  }, []);

  return {
    insights,
    isLoading,
    lastGenerated,
    generateInsights,
    clearInsights,
  };
}
