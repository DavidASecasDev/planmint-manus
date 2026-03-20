/*
 * Azul Cars Brand — Recover Password Page
 * Split layout: navy left panel with brand | warm right panel with form
 */
import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mail, ArrowLeft, CheckCircle2 } from 'lucide-react';
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

const recoverSchema = z.object({
  email: z.string().email('Email inválido'),
});

export default function Recover() {
  const { resetPassword, user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: brand.warmBg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: brand.gold }} />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = recoverSchema.safeParse({ email });
    if (!validation.success) {
      toast({ title: 'Error de validación', description: validation.error.errors[0].message, variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await resetPassword(email);
    if (error) {
      toast({ title: 'Error', description: 'Error al enviar el email de recuperación', variant: 'destructive' });
      setLoading(false);
      return;
    }
    setSent(true);
    setLoading(false);
  };

  const AuthShell = ({ children }: { children: React.ReactNode }) => (
    <div className="flex min-h-screen" style={{ backgroundColor: brand.warmBg }}>
      {/* Navy left panel with particle logos */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col relative overflow-hidden"
        style={{ backgroundColor: brand.navy }}
      >
        <ParticleLogos />
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
              className="text-sm tracking-widest uppercase mb-3"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 600,
                color: brand.textWhiteMuted,
                letterSpacing: '0.15em',
              }}
            >
              Grupo Azul
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
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md animate-in">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <span
              className="text-2xl"
              style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: brand.textDark }}
            >
              AZUL<span style={{ color: brand.gold }}>.</span>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );

  if (sent) {
    return (
      <AuthShell>
        <Card className="border shadow-lg" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
          <CardHeader className="space-y-1 text-center pb-6 pt-8">
            <div
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}
            >
              <CheckCircle2 className="h-7 w-7" style={{ color: '#22C55E' }} />
            </div>
            <CardTitle
              className="text-2xl"
              style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: brand.textDark }}
            >
              Email Enviado
            </CardTitle>
            <CardDescription style={{ fontFamily: 'Barlow, sans-serif', color: brand.textMuted }}>
              Revisa tu bandeja de entrada para restablecer tu contraseña
            </CardDescription>
          </CardHeader>
          <CardFooter className="pb-8">
            <Link to="/auth/login" className="w-full">
              <Button
                variant="outline"
                className="w-full h-11 gap-2"
                style={{
                  borderColor: brand.borderLight,
                  color: brand.textDark,
                  fontFamily: 'Barlow, sans-serif',
                  fontWeight: 600,
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="border shadow-lg" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
        <CardHeader className="space-y-1 text-center pb-6 pt-8">
          <CardTitle
            className="text-2xl"
            style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: brand.textDark }}
          >
            Recuperar Contraseña
          </CardTitle>
          <CardDescription style={{ fontFamily: 'Barlow, sans-serif', color: brand.textMuted }}>
            Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label
                htmlFor="email"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px', color: brand.textDark }}
              >
                Email
              </Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10 h-11"
                  style={{ borderColor: brand.borderLight, fontFamily: 'Barlow, sans-serif', backgroundColor: '#FFFFFF' }}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2 pb-8">
            <Button
              type="submit"
              className="w-full h-11"
              disabled={loading}
              style={{
                backgroundColor: brand.gold,
                color: brand.navy,
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
              }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Enviar Email'}
            </Button>
            <Link to="/auth/login" className="w-full">
              <Button
                variant="ghost"
                className="w-full gap-2"
                style={{ color: brand.textMuted, fontFamily: 'Barlow, sans-serif' }}
              >
                <ArrowLeft className="h-4 w-4" />
                Volver al login
              </Button>
            </Link>
          </CardFooter>
        </form>
      </Card>
    </AuthShell>
  );
}
