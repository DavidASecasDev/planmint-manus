import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export const ReferralRedirect = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const trackAndRedirect = async () => {
      if (!code) {
        navigate('/');
        return;
      }

      try {
        // Track click directly instead of broken RPC
        try {
          const { data: ref } = await supabase
            .from('referrals')
            .select('id, clicks')
            .eq('code', code)
            .maybeSingle();
          if (ref) {
            await supabase
              .from('referrals')
              .update({ clicks: (ref.clicks || 0) + 1 })
              .eq('id', ref.id);
          }
        } catch { /* non-critical */ }

        // Store referral code in localStorage for 30 days
        localStorage.setItem('ref_code', code);
        localStorage.setItem('ref_code_expires', String(Date.now() + 30 * 24 * 60 * 60 * 1000));
      } catch (error) {
        console.error('Error tracking referral click:', error);
      }

      // Redirect to landing with ref param
      navigate(`/?ref=${code}`);
    };

    trackAndRedirect();
  }, [code, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground">Redirigiendo...</p>
      </div>
    </div>
  );
};
