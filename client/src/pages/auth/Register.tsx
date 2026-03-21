/*
 * Azul Cars Brand — Register Page
 * Split layout: navy left panel with brand | warm right panel with form
 * Gold accent: oklch(0.72 0.10 80)
 * Headings: Montserrat | Body: Barlow
 */
import { useState, useEffect, useCallback } from 'react';
import { Link, Navigate, useSearchParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock, User, ArrowRight } from 'lucide-react';
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

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
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

export default function Register() {
  const { signUp, user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);

  useEffect(() => {
    const urlRef = searchParams.get('ref');
    const storedRef = localStorage.getItem('ref_code');
    const storedExpires = localStorage.getItem('ref_code_expires');
    if (urlRef) {
      setRefCode(urlRef);
    } else if (storedRef && storedExpires && Date.now() < parseInt(storedExpires)) {
      setRefCode(storedRef);
    }
  }, [searchParams]);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: brand.warmBg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: brand.gold }} />
      </div>
    );
  }

  if (user) {
    const inviteToken = searchParams.get('invite');
    if (inviteToken) {
      return <Navigate to={`/auth/invitation/${inviteToken}`} replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = registerSchema.safeParse({ name, email, password, confirmPassword });
    if (!validation.success) {
      toast({ title: 'Error de validación', description: validation.error.errors[0].message, variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await signUp(email, password, name);
    if (error) {
      let message = 'Error al registrarse';
      if (error.message.includes('User already registered')) {
        message = 'Este email ya está registrado';
      }
      toast({ title: 'Error', description: message, variant: 'destructive' });
      setLoading(false);
      return;
    }
    if (refCode) {
      try {
        await supabase.rpc('track_referral_signup', { ref_code: refCode, user_email: email });
        localStorage.removeItem('ref_code');
        localStorage.removeItem('ref_code_expires');
      } catch (err) {
        console.error('Error tracking referral signup:', err);
      }
    }
    toast({ title: '¡Cuenta creada!', description: 'Tu cuenta ha sido creada exitosamente.' });
    setLoading(false);
  };

  const inputStyle = {
    borderColor: brand.borderLight,
    fontFamily: 'Barlow, sans-serif',
    backgroundColor: '#FFFFFF',
  };

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: brand.warmBg }}>
      {/* Navy left panel with particle logos */}
      <NavyPanel />

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

          <Card className="border shadow-lg" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
            <CardHeader className="space-y-1 text-center pb-4 pt-8">
              <CardTitle
                className="text-2xl"
                style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: brand.textDark }}
              >
                Crear Cuenta
              </CardTitle>
              <CardDescription style={{ fontFamily: 'Barlow, sans-serif', color: brand.textMuted }}>
                Completa los datos para registrarte
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px', color: brand.textDark }}
                  >
                    Nombre completo
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                    <Input id="name" type="text" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 h-11" style={inputStyle} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px', color: brand.textDark }}
                  >
                    Email
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                    <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-11" style={inputStyle} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px', color: brand.textDark }}
                  >
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                    <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11" style={inputStyle} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="confirmPassword"
                    style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 600, fontSize: '12px', color: brand.textDark }}
                  >
                    Confirmar contraseña
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                    <Input id="confirmPassword" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-10 h-11" style={inputStyle} required />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-4 pt-2 pb-8">
                <Button
                  type="submit"
                  className="w-full h-11 gap-2"
                  disabled={loading}
                  style={{
                    backgroundColor: brand.gold,
                    color: brand.navy,
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
                  }}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Crear Cuenta
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="text-center text-sm" style={{ color: brand.textMuted, fontFamily: 'Barlow, sans-serif' }}>
                  ¿Ya tienes cuenta?{' '}
                  <Link to="/auth/login" className="font-semibold hover:underline" style={{ color: brand.gold }}>
                    Iniciar sesión
                  </Link>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
