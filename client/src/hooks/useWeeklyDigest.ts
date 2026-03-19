import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useWeeklyDigest() {
  const { profile } = useAuth();
  const [digest, setDigest] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);

  const generateDigest = useCallback(async () => {
    if (!profile?.organization_id) {
      toast.error('No se pudo identificar la organización');
      return null;
    }

    setIsLoading(true);
    setDigest(null);

    try {
      const { data, error } = await supabase.functions.invoke('ai-assistant', {
        body: { type: 'weekly_digest', organizationId: profile.organization_id },
      });

      if (error) {
        console.error('Weekly digest error:', error);
        if (error.message?.includes('429')) {
          toast.error('Límite de solicitudes alcanzado. Intenta más tarde.');
        } else if (error.message?.includes('402')) {
          toast.error('Créditos de IA agotados.');
        } else {
          toast.error('Error al generar el resumen semanal');
        }
        return null;
      }

      setDigest(data.summary);
      setLastGenerated(new Date());
      return data.summary;
    } catch (err) {
      console.error('Weekly digest error:', err);
      toast.error('Error al generar el resumen semanal');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.organization_id]);

  const clearDigest = useCallback(() => {
    setDigest(null);
    setLastGenerated(null);
  }, []);

  return {
    digest,
    isLoading,
    lastGenerated,
    generateDigest,
    clearDigest,
  };
}
