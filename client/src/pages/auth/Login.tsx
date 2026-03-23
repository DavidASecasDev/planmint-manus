/*
 * Azul Cars Brand — Login Page
 * Split layout: navy left panel with particle logo animation | warm right panel with form
 * Gold accent: oklch(0.72 0.10 80)
 * Headings: Montserrat | Body: Barlow
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock } from 'lucide-react';
import { z } from 'zod';
import { ParticleLogos } from '@/components/effects/ParticleLogos';

const brand = {
  navy: '#001321',
  navyLight: '#0A1E30',
  gold: 'oklch(0.72 0.10 80)',
  warmBg: '#F5F3EF',
  textDark: '#0F1216',
  textMuted: '#52555B',
  textWhite: '#FFFFFF',
  textWhiteMuted: 'rgba(255,255,255,0.55)',
  borderLight: 'rgba(0,19,33,0.08)',
};

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
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
      {/* Particle canvas fills the entire panel */}
      <ParticleLogos onLogoChange={handleLogoChange} />

      {/* Overlay content on top of particles */}
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

      {/* Inline keyframe for the fade-in animation */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

export default function Login() {
  const { signIn, signOut, user, profile, loading: authLoading, profileLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const inviteAcceptedRef = useRef(false);

  const inviteToken = searchParams.get('invite');
  const redirectTo = (location.state as any)?.from?.pathname;

  useEffect(() => {
    const acceptInvitation = async () => {
      if (user && !profileLoading && inviteToken && !inviteAcceptedRef.current) {
        inviteAcceptedRef.current = true;
        setAcceptingInvite(true);
        try {
          const { data: result, error } = await apiInvoke<{ success?: boolean; organization_name?: string; error?: string }>('accept-invitation', { body: { p_token: inviteToken } });
          if (error) { navigate('/dashboard'); return; }
          if (result?.success) {
            toast({ title: 'Invitación aceptada', description: `Te has unido a ${result.organization_name}` });
          } else if (result?.error === 'email_mismatch') {
            toast({ title: 'Email no coincide', description: 'Tu cuenta no coincide con el email de la invitación.', variant: 'destructive' });
          }
          navigate('/dashboard');
        } catch {
          navigate('/dashboard');
        } finally {
          setAcceptingInvite(false);
        }
      }
    };
    acceptInvitation();
  }, [user, profileLoading, inviteToken, navigate]);

  /* ── Loading state ── */
  if (authLoading || profileLoading || acceptingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: brand.warmBg }}>
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" style={{ color: brand.gold }} />
          {acceptingInvite && (
            <p className="mt-4" style={{ color: brand.textMuted, fontFamily: 'Barlow, sans-serif' }}>
              Aceptando invitación...
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ── Already logged in ── */
  if (user && !profileLoading && !inviteToken) {
    const handleSignOut = async () => { await signOut(); };
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
                  Ya tienes sesión activa
                </CardTitle>
                <CardDescription style={{ fontFamily: 'Barlow, sans-serif', color: brand.textMuted }}>
                  Estás conectado como <span className="font-medium" style={{ color: brand.textDark }}>{user.email}</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-8">
                <Button
                  onClick={() => navigate(redirectTo || '/dashboard')}
                  className="w-full h-12 text-base font-semibold"
                  style={{ backgroundColor: brand.gold, color: brand.navy, fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                >
                  Ir al Dashboard
                </Button>
                <Button
                  variant="outline"
                  onClick={handleSignOut}
                  className="w-full h-12 text-base"
                  style={{ borderColor: brand.borderLight, color: brand.textMuted, backgroundColor: '#FFFFFF', fontFamily: 'Barlow, sans-serif' }}
                >
                  Cerrar sesión e iniciar con otra cuenta
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  /* ── Login form submit ── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = loginSchema.safeParse({ email, password });
    if (!validation.success) {
      toast({ title: 'Error de validación', description: validation.error.errors[0].message, variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      let message = 'Error al iniciar sesión';
      let description = '';
      if (error.message.includes('Invalid login credentials')) {
        message = 'Credenciales inválidas';
        description = inviteToken
          ? 'Verifica que tu email esté confirmado (revisa tu bandeja) o recupera tu contraseña.'
          : 'Email o contraseña incorrectos.';
      } else if (error.message.includes('Email not confirmed')) {
        message = 'Email no confirmado';
        description = 'Revisa tu bandeja de entrada y confirma tu email antes de iniciar sesión.';
      } else {
        description = error.message;
      }
      toast({ title: message, description, variant: 'destructive' });
    }
    setLoading(false);
  };

  /* ── Main login view ── */
  return (
    <div className="flex min-h-screen" style={{ backgroundColor: brand.warmBg }}>
      {/* Navy left panel with particle logos */}
      <NavyPanel />

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="text-center mb-8 lg:hidden">
            <span className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: brand.textDark }}>
              AZUL<span style={{ color: brand.gold }}>.</span>
            </span>
          </div>

          <Card className="border shadow-lg" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
            <CardHeader className="space-y-1 text-center pb-6 pt-8">
              <CardTitle className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: brand.textDark }}>
                Iniciar Sesión
              </CardTitle>
              <CardDescription style={{ fontFamily: 'Barlow, sans-serif', color: brand.textMuted }}>
                {inviteToken
                  ? 'Inicia sesión para aceptar tu invitación'
                  : 'Ingresa tus credenciales para acceder'}
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="email" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px', color: brand.textDark }}>
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                    <Input
                      id="email"
                      type="email"
                      placeholder="tu@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-12"
                      style={{ borderColor: brand.borderLight, fontFamily: 'Barlow, sans-serif', backgroundColor: '#FFFFFF', color: brand.textDark }}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px', color: brand.textDark }}>
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 h-12"
                      style={{ borderColor: brand.borderLight, fontFamily: 'Barlow, sans-serif', backgroundColor: '#FFFFFF', color: brand.textDark }}
                      required
                    />
                  </div>
                </div>
                <div className="text-right">
                  <Link
                    to="/auth/recover"
                    className="text-sm font-medium hover:underline"
                    style={{ color: brand.gold, fontFamily: 'Barlow, sans-serif', fontWeight: 600 }}
                  >
                    ¿Olvidaste tu contraseña?
                  </Link>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2 pb-8">
                <Button
                  type="submit"
                  className="w-full h-12 text-base shadow-sm"
                  disabled={loading}
                  style={{ backgroundColor: brand.gold, color: brand.navy, fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Iniciar Sesión
                </Button>
                {inviteToken && (
                  <p className="text-center text-sm" style={{ color: brand.textMuted, fontFamily: 'Barlow, sans-serif' }}>
                    ¿No tienes cuenta?{' '}
                    <Link
                      to={`/auth/invitation/${inviteToken}`}
                      className="font-semibold hover:underline"
                      style={{ color: brand.gold }}
                    >
                      Crear cuenta
                    </Link>
                  </p>
                )}
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
