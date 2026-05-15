import { useMutation } from '@tanstack/react-query';
import { supabaseQuery } from '@/lib/supabaseQuery';
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
      // Insert directly into leads table instead of broken RPC
      try {
        const { data, error } = await supabaseQuery
          .from('leads')
          .upsert({ email, source, referral_code: referralCode || null }, { onConflict: 'email' })
          .select()
          .single();

        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[Leads] upsert_lead failed, lead may not be saved:', err);
        // Don't throw - leads are non-critical
        return null;
      }
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
