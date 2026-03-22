/*
 * Azul Cars Brand — Invitation Page
 * Centered card on warm background
 * Gold accent: oklch(0.72 0.10 80)
 * Headings: Montserrat | Body: Barlow
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getRoleLabel } from '@/lib/roleHierarchy';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Lock, User, Building2, ArrowRight, AlertCircle, Clock, LogIn } from 'lucide-react';
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

interface InvitationPreview {
  valid: boolean;
  error?: string;
  organization_id?: string;
  organization_name?: string;
  role?: string;
  expires_at?: string;
}

const signupSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

const inputStyle = {
  borderColor: brand.borderLight,
  fontFamily: 'Barlow, sans-serif',
  backgroundColor: '#FFFFFF',
  color: brand.textDark,
};

const labelStyle = {
  fontFamily: 'Montserrat, sans-serif',
  fontWeight: 600 as const,
  fontSize: '12px',
  color: brand.textDark,
};

/* ─── AuthShell extracted OUTSIDE Invitation to avoid re-mount on state changes ─── */
function AuthShell({ children }: { children: React.ReactNode }) {
  const [currentLogo, setCurrentLogo] = useState('Azul Cars');
  const [fadeKey, setFadeKey] = useState(0);

  const handleLogoChange = useCallback((logoName: string) => {
    setCurrentLogo(logoName);
    setFadeKey(prev => prev + 1);
  }, []);

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: brand.warmBg }}>
      <div className="hidden lg:flex lg:w-[45%] flex-col relative overflow-hidden" style={{ backgroundColor: brand.navy }}>
        <ParticleLogos onLogoChange={handleLogoChange} />
        <div className="relative z-10 flex flex-col justify-between h-full p-12">
          <div>
            <span className="text-3xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: brand.textWhite }}>
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
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md animate-in">
          <div className="text-center mb-8 lg:hidden">
            <span className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: brand.textDark }}>
              AZUL<span style={{ color: brand.gold }}>.</span>
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Invitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, refreshProfile } = useAuth();
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [loadingInvitation, setLoadingInvitation] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptingAsExisting, setAcceptingAsExisting] = useState(false);

  useEffect(() => {
    const fetchInvitationPreview = async () => {
      if (!token) return;
      const { data, error } = await supabase.rpc('get_invitation_public', { p_token: token });
      if (error) {
        setInvitation({ valid: false, error: 'invitation_not_found' });
        setLoadingInvitation(false);
        return;
      }
      const result = data as unknown as InvitationPreview;
      setInvitation(result);
      setLoadingInvitation(false);
    };
    fetchInvitationPreview();
  }, [token]);

  const handleAcceptAsExistingUser = async () => {
    if (!user || !token) return;
    setAcceptingAsExisting(true);
    const { data, error } = await supabase.rpc('accept_invitation', { p_token: token });
    const result = data as unknown as { success: boolean; error?: string; organization_name?: string };
    if (error || !result?.success) {
      const errorMsg = result?.error || error?.message || 'Error desconocido';
      const messages: Record<string, string> = {
        'invitation_not_found': 'Invitación no encontrada',
        'invitation_already_accepted': 'Esta invitación ya fue aceptada',
        'invitation_revoked': 'Esta invitación ha sido revocada',
        'invitation_expired': 'Esta invitación ha expirado',
        'not_authenticated': 'Debes iniciar sesión primero',
        'email_mismatch': 'Tu cuenta no coincide con el email de la invitación',
      };
      toast({ title: 'Error', description: messages[errorMsg] || errorMsg, variant: 'destructive' });
      setAcceptingAsExisting(false);
      return;
    }
    await refreshProfile();
    toast({ title: '¡Bienvenido!', description: `Te has unido a ${result.organization_name}` });
    navigate('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation?.valid || !token) return;
    const validation = signupSchema.safeParse({ name, password, confirmPassword });
    if (!validation.success) {
      toast({ title: 'Error de validación', description: validation.error.errors[0].message, variant: 'destructive' });
      return;
    }
    if (!email.trim()) {
      toast({ title: 'Error', description: 'Por favor ingresa tu email', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data: fnData, error: fnError } = await apiInvoke<{ error?: string; message?: string; userId?: string; organization_name?: string }>('signup-with-invitation', {
        body: { email: email.trim(), password, name, token },
      });
      if (fnError) {
        toast({ title: 'Error', description: 'Error al procesar la solicitud. Intenta de nuevo.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      if (fnData?.error) {
        const errorMessages: Record<string, string> = {
          'missing_fields': 'Todos los campos son obligatorios',
          'invitation_not_found': 'Invitación no encontrada',
          'invitation_already_accepted': 'Esta invitación ya fue aceptada',
          'invitation_revoked': 'Esta invitación ha sido revocada',
          'invitation_expired': 'Esta invitación ha expirado',
          'email_mismatch': 'El email no coincide con la invitación. Usa el email al que fue enviada.',
          'user_already_confirmed': 'Este email ya tiene una cuenta. Inicia sesión para aceptar la invitación.',
          'signup_failed': fnData.message || 'Error al crear la cuenta',
        };
        const isExistingUser = fnData.error === 'user_already_confirmed';
        toast({
          title: isExistingUser ? 'Cuenta existente' : 'Error',
          description: errorMessages[fnData.error] || fnData.message || 'Error desconocido',
          variant: 'destructive',
        });
        if (isExistingUser) navigate(`/auth/login?invite=${token}`);
        setLoading(false);
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) {
        toast({ title: 'Cuenta creada', description: 'Tu cuenta fue creada exitosamente. Inicia sesión para continuar.' });
        navigate(`/auth/login?invite=${token}`);
        setLoading(false);
        return;
      }
      toast({ title: '¡Bienvenido!', description: `Te has unido a ${fnData?.organization_name || 'la organización'}` });
      navigate('/dashboard');
    } catch (err) {
      toast({ title: 'Error', description: 'Error inesperado. Por favor intenta de nuevo.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (error: string) => {
    const messages: Record<string, { title: string; description: string }> = {
      'invitation_not_found': { title: 'Invitación no válida', description: 'Esta invitación no existe o el enlace es incorrecto' },
      'invitation_already_accepted': { title: 'Invitación ya aceptada', description: 'Esta invitación ya ha sido utilizada' },
      'invitation_revoked': { title: 'Invitación revocada', description: 'Esta invitación ha sido cancelada por un administrador' },
      'invitation_expired': { title: 'Invitación expirada', description: 'Esta invitación ha caducado. Solicita una nueva al administrador' },
    };
    return messages[error] || { title: 'Error', description: 'Ha ocurrido un error inesperado' };
  };

  if (loadingInvitation) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: brand.warmBg }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: brand.gold }} />
      </div>
    );
  }

  // Invalid invitation
  if (!invitation?.valid) {
    const errorInfo = getErrorMessage(invitation?.error || 'unknown');
    return (
      <AuthShell>
        <Card className="border shadow-lg text-center" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
          <CardHeader className="pb-6 pt-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(239,68,68,0.1)' }}>
              {invitation?.error === 'invitation_expired' ? (
                <Clock className="h-7 w-7" style={{ color: '#EF4444' }} />
              ) : (
                <AlertCircle className="h-7 w-7" style={{ color: '#EF4444' }} />
              )}
            </div>
            <CardTitle className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: brand.textDark }}>
              {errorInfo.title}
            </CardTitle>
            <CardDescription style={{ fontFamily: 'Barlow, sans-serif', color: brand.textMuted }}>
              {errorInfo.description}
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center pb-8">
            <Link to="/auth/login">
              <Button className="gap-2" style={{ backgroundColor: brand.gold, color: brand.navy, fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}>
                Ir al login <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  // User is logged in - show accept button
  if (user) {
    return (
      <AuthShell>
        <Card className="border shadow-lg" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
          <CardHeader className="space-y-1 text-center pb-6 pt-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(201,169,110,0.12)' }}>
              <Building2 className="h-7 w-7" style={{ color: brand.gold }} />
            </div>
            <CardTitle className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: brand.textDark }}>
              Invitación
            </CardTitle>
            <CardDescription style={{ fontFamily: 'Barlow, sans-serif', color: brand.textMuted }}>
              Has sido invitado a unirte a <strong style={{ color: brand.textDark }}>{invitation.organization_name}</strong> como <strong style={{ color: brand.textDark }}>{getRoleLabel(invitation.role || '')}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm mb-4" style={{ color: brand.textMuted, fontFamily: 'Barlow, sans-serif' }}>
              Ya has iniciado sesión. Haz clic en el botón para unirte a la organización.
            </p>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2 pb-8">
            <Button
              onClick={handleAcceptAsExistingUser}
              className="w-full h-11 gap-2"
              disabled={acceptingAsExisting}
              style={{ backgroundColor: brand.gold, color: brand.navy, fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
            >
              {acceptingAsExisting ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Aceptar Invitación <ArrowRight className="h-4 w-4" /></>)}
            </Button>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  // Not logged in - show signup form
  return (
    <AuthShell>
      <Card className="border shadow-lg" style={{ borderColor: brand.borderLight, backgroundColor: '#FFFFFF' }}>
        <CardHeader className="space-y-1 text-center pb-4 pt-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: 'rgba(201,169,110,0.12)' }}>
            <Building2 className="h-7 w-7" style={{ color: brand.gold }} />
          </div>
          <CardTitle className="text-2xl" style={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 700, color: brand.textDark }}>
            Invitación
          </CardTitle>
          <CardDescription style={{ fontFamily: 'Barlow, sans-serif', color: brand.textMuted }}>
            Has sido invitado a unirte a <strong style={{ color: brand.textDark }}>{invitation.organization_name}</strong> como <strong style={{ color: brand.textDark }}>{getRoleLabel(invitation.role || '')}</strong>
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" style={labelStyle}>Tu email</Label>
              <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11" style={inputStyle} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" style={labelStyle}>Nombre completo</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                <Input id="name" type="text" placeholder="Tu nombre" value={name} onChange={(e) => setName(e.target.value)} className="pl-10 h-11" style={inputStyle} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" style={labelStyle}>Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: brand.textMuted }} />
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-11" style={inputStyle} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" style={labelStyle}>Confirmar contraseña</Label>
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
              style={{ backgroundColor: brand.gold, color: brand.navy, fontFamily: 'Montserrat, sans-serif', fontWeight: 700 }}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (<>Crear cuenta y aceptar <ArrowRight className="h-4 w-4" /></>)}
            </Button>
            <p className="text-center text-sm" style={{ color: brand.textMuted, fontFamily: 'Barlow, sans-serif' }}>
              ¿Ya tienes cuenta?{' '}
              <Link to={`/auth/login?invite=${token}`} className="font-semibold hover:underline inline-flex items-center gap-1" style={{ color: brand.gold }}>
                <LogIn className="h-3 w-3" />
                Iniciar sesión
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </AuthShell>
  );
}
