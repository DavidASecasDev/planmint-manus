/*
 * Azul Cars Brand — Reset Password Page
 * Split layout: navy left panel with particle logos | warm right panel with form
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';
import { ParticleLogos } from '@/components/effects/ParticleLogos';

const brand = {
  navy: '#001321',
  gold: 'oklch(0.72 0.10 80)',
  warmBg: '#F5F3EF',
  textDark: '#0F1216',
  textMuted: '#52555B',
  textWhite: '#FFFFFF',
  textWhiteMuted: 'rgba(255,255,255,0.55)',
  borderLight: 'rgba(0,19,33,0.08)',
};

const resetSchema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

/* ── Shared Navy Panel with Particle Effect ── */
function NavyPanel() {
  const [currentLogo, setCurrentLogo] = useState('Azul Cars');
  const [fadeKey, setFadeKey] = useState(0);

  const handleLogoChange = useCallback((logoName: string) => {
    setCurrentLogo(logoName);
    setFadeKey(prev => prev + 1);
  }, []);

  return (
    <div
      className="hidden lg:flex lg:w-[45%] flex-col relative overflow-hidden"
      style={{ backgroundColor: brand.navy }}
    >
      <ParticleLogos onLogoChange={handleLogoChange} />
      <div className="relative z-10 flex flex-col justify-between h-full p-12">
        <div>
          <span
            className="text-3xl"
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: brand.textWhite }}
          >
            AZUL<span style={{ color: brand.gold }}>.</span>
          </span>
        </div>
        <div />
        <div>
          <p
            key={fadeKey}
            className="text-sm tracking-widest uppercase mb-3"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 600,
              color: brand.textWhiteMuted,
              letterSpacing: '0.15em',
              animation: 'fadeInUp 0.6s ease-out',
            }}
          >
            {currentLogo}
          </p>
          <div style={{ height: '2px', width: '60px', background: brand.gold, marginBottom: '12px' }} />
          <p
            className="text-sm"
            style={{
              fontFamily: 'Barlow, sans-serif',
              color: brand.textWhiteMuted,
              lineHeight: '1.6',
              maxWidth: '280px',
            }}
          >
            Plataforma de gestión integral para las empresas del grupo.
          </p>
        </div>
      </div>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
      setChecking(false);
    });
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) setIsRecovery(true);
    const timeout = setTimeout(() => setChecking(false), 3000);
    return () => { subscription.unsubscribe(); clearTimeout(timeout); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = resetSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast({ title: 'Error de validación', description: validation.error.errors[0].message, variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      toast({ title: 'Error', description: 'No se pudo actualizar la contraseña. Intenta solicitar un nuevo enlace.', variant: 'destructive' });
      setLoading(false);
      return;
    }
    setSuccess(true);
    setLoading(false);
    toast({ title: 'Contraseña actualizada', description: 'Tu contraseña ha sido cambiada exitosamente.' });
    setTimeout(() => navigate('/dashboard'), 2000);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: brand.warmBg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: brand.gold }} />
      </div>
    );
  }

  if (!isRecovery && !success) {
    return (
      <div className="flex min-h-screen" style={{ backgroundColor: brand.warmBg }}>
        <NavyPanel />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8 lg:hidden">
              <span className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: brand.textDark }}>
                AZUL<span style={{ color: brand.gold }}>.</span>
              </span>
            </div>
            <Card className="border shadow-lg text-center" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
              <CardHeader className="pb-6 pt-8">
                <CardTitle className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: brand.textDark }}>
                  Enlace inválido
                </CardTitle>
                <CardDescription style={{ fontFamily: 'Barlow, sans-serif', color: brand.textMuted }}>
                  Este enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-center pb-8">
                <Button
                  onClick={() => navigate('/auth/recover')}
                  style={{ backgroundColor: brand.gold, color: brand.navy, fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                >
                  Solicitar nuevo enlace
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen" style={{ backgroundColor: brand.warmBg }}>
        <NavyPanel />
        <div className="flex flex-1 items-center justify-center p-6">
          <div className="w-full max-w-md">
            <div className="text-center mb-8 lg:hidden">
              <span className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: brand.textDark }}>
                AZUL<span style={{ color: brand.gold }}>.</span>
              </span>
            </div>
            <Card className="border shadow-lg text-center" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
              <CardHeader className="pb-6 pt-8">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}>
                  <CheckCircle2 className="h-7 w-7" style={{ color: '#22C55E' }} />
                </div>
                <CardTitle className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: brand.textDark }}>
                  Contraseña actualizada
                </CardTitle>
                <CardDescription style={{ fontFamily: 'Barlow, sans-serif', color: brand.textMuted }}>
                  Serás redirigido al dashboard en unos segundos...
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: brand.warmBg }}>
      <NavyPanel />
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <span className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: brand.textDark }}>
              AZUL<span style={{ color: brand.gold }}>.</span>
            </span>
          </div>
          <Card className="border shadow-lg" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
            <CardHeader className="space-y-1 text-center pb-6 pt-8">
              <CardTitle className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: brand.textDark }}>
                Nueva contraseña
              </CardTitle>
              <CardDescription style={{ fontFamily: 'Barlow, sans-serif', color: brand.textMuted }}>
                Ingresa tu nueva contraseña
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px', color: brand.textDark }}>
                    Nueva contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" style={{ borderColor: brand.borderLight, fontFamily: 'Barlow, sans-serif', backgroundColor: '#FFFFFF', color: brand.textDark }} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px', color: brand.textDark }}>
                    Confirmar contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                    <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12" style={{ borderColor: brand.borderLight, fontFamily: 'Barlow, sans-serif', backgroundColor: '#FFFFFF', color: brand.textDark }} required />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2 pb-8">
                <Button
                  type="submit"
                  className="w-full h-12 text-base"
                  disabled={loading}
                  style={{ backgroundColor: brand.gold, color: brand.navy, fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Cambiar contraseña
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
