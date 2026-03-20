/*
 * Azul Cars Brand — Reset Password Page
 * Centered card on warm background with navy accent
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Lock, CheckCircle2 } from 'lucide-react';
import { z } from 'zod';

const brand = {
  navy: '#001321',
  gold: 'oklch(0.72 0.10 80)',
  warmBg: '#F5F3EF',
  textDark: '#0F1216',
  textMuted: '#52555B',
  borderLight: 'rgba(0,19,33,0.08)',
};

const resetSchema = z.object({
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

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
      <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: brand.warmBg }}>
        <Card className="w-full max-w-md border shadow-lg text-center" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
          <CardHeader className="pb-6 pt-8">
            <div className="text-center mb-4">
              <span className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: brand.textDark }}>
                AZUL<span style={{ color: brand.gold }}>.</span>
              </span>
            </div>
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
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: brand.warmBg }}>
        <Card className="w-full max-w-md border shadow-lg text-center" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
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
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4" style={{ backgroundColor: brand.warmBg }}>
      <Card className="w-full max-w-md border shadow-lg" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
        <CardHeader className="space-y-1 text-center pb-6 pt-8">
          <div className="text-center mb-4">
            <span className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: brand.textDark }}>
              AZUL<span style={{ color: brand.gold }}>.</span>
            </span>
          </div>
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
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" style={{ borderColor: brand.borderLight, fontFamily: 'Barlow, sans-serif' }} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px', color: brand.textDark }}>
                Confirmar contraseña
              </Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12" style={{ borderColor: brand.borderLight, fontFamily: 'Barlow, sans-serif' }} required />
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
  );
}
