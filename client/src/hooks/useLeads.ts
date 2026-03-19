import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const useLeads = () => {
  const createLead = useMutation({
    mutationFn: async ({ 
      email, 
      source = 'landing', 
      referralCode 
    }: { 
      email: string; 
      source?: string; 
      referralCode?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('upsert_lead', {
        p_email: email,
        p_source: source,
        p_referral_code: referralCode ?? undefined,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('¡Gracias! Te avisaremos cuando haya novedades.');
    },
    onError: (error) => {
      console.error('Error creating lead:', error);
      toast.error('Error al registrar. Inténtalo de nuevo.');
    },
  });

  return {
    createLead: createLead.mutate,
    isCreating: createLead.isPending,
  };
};
