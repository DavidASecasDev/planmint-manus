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
import logo from '@/assets/logo.png';

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
    // Listen for the PASSWORD_RECOVERY event from the hash fragment
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
      setChecking(false);
    });

    // Also check hash for type=recovery (Supabase auto-processes it)
    const hash = window.location.hash;
    if (hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    // Fallback timeout
    const timeout = setTimeout(() => setChecking(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validation = resetSchema.safeParse({ password, confirmPassword });
    if (!validation.success) {
      toast({
        title: 'Error de validación',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la contraseña. Intenta solicitar un nuevo enlace.',
        variant: 'destructive',
      });
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isRecovery && !success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl text-center">
          <CardHeader className="pb-6 pt-8">
            <img src={logo} alt="Logo" className="mx-auto mb-6 h-14 w-14 rounded-2xl shadow-lg object-contain" />
            <CardTitle className="text-2xl font-bold">Enlace inválido</CardTitle>
            <CardDescription className="text-base">
              Este enlace de recuperación no es válido o ha expirado. Solicita uno nuevo.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pb-8">
            <Button onClick={() => navigate('/auth/recover')}>Solicitar nuevo enlace</Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl text-center">
          <CardHeader className="pb-6 pt-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10">
              <CheckCircle2 className="h-7 w-7 text-green-500" />
            </div>
            <CardTitle className="text-2xl font-bold">Contraseña actualizada</CardTitle>
            <CardDescription className="text-base">
              Serás redirigido al dashboard en unos segundos...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="space-y-1 text-center pb-6 pt-8">
          <img src={logo} alt="Logo" className="mx-auto mb-6 h-14 w-14 rounded-2xl shadow-lg object-contain" />
          <CardTitle className="text-2xl font-bold">Nueva contraseña</CardTitle>
          <CardDescription className="text-base">
            Ingresa tu nueva contraseña
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">Nueva contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-12" required />
              </div>
            </div>
          </CardContent>
          <CardFooter className="pt-2 pb-8">
            <Button type="submit" className="w-full h-12 text-base font-semibold" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cambiar contraseña
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
