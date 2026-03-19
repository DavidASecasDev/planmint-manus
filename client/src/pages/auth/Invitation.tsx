import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getRoleLabel } from '@/lib/roleHierarchy';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Lock, User, Building2, ArrowRight, AlertCircle, Clock, LogIn } from 'lucide-react';
import { z } from 'zod';

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

  // Fetch invitation preview using secure RPC (no email exposed)
  useEffect(() => {
    const fetchInvitationPreview = async () => {
      if (!token) return;

      const { data, error } = await supabase.rpc('get_invitation_public', {
        p_token: token
      });

      if (error) {
        console.error('Error fetching invitation:', error);
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

  // Accept invitation for logged-in users
  const handleAcceptAsExistingUser = async () => {
    if (!user || !token) return;

    setAcceptingAsExisting(true);

    const { data, error } = await supabase.rpc('accept_invitation', {
      p_token: token
    });

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
      toast({
        title: 'Error',
        description: messages[errorMsg] || errorMsg,
        variant: 'destructive',
      });
      setAcceptingAsExisting(false);
      return;
    }

    await refreshProfile();

    toast({
      title: '¡Bienvenido!',
      description: `Te has unido a ${result.organization_name}`,
    });

    navigate('/dashboard');
  };

  // Handle signup via edge function (auto-confirm + accept invitation atomically)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation?.valid || !token) return;

    const validation = signupSchema.safeParse({ name, password, confirmPassword });
    if (!validation.success) {
      toast({
        title: 'Error de validación',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    if (!email.trim()) {
      toast({
        title: 'Error',
        description: 'Por favor ingresa tu email',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      // Call edge function that creates user with auto-confirm + accepts invitation
      const { data: fnData, error: fnError } = await supabase.functions.invoke('signup-with-invitation', {
        body: {
          email: email.trim(),
          password,
          name,
          token,
        },
      });

      if (fnError) {
        console.error('Edge function error:', fnError);
        toast({
          title: 'Error',
          description: 'Error al procesar la solicitud. Intenta de nuevo.',
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      // Handle error responses from the edge function
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

        if (isExistingUser) {
          // Redirect to login with invite token
          navigate(`/auth/login?invite=${token}`);
        }

        setLoading(false);
        return;
      }

      // Success! Sign in the user to get a client-side session
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        console.error('Sign in after signup error:', signInError);
        toast({
          title: 'Cuenta creada',
          description: 'Tu cuenta fue creada exitosamente. Inicia sesión para continuar.',
        });
        navigate(`/auth/login?invite=${token}`);
        setLoading(false);
        return;
      }

      toast({
        title: '¡Bienvenido!',
        description: `Te has unido a ${fnData.organization_name}`,
      });

      navigate('/dashboard');
    } catch (err) {
      console.error('Unexpected error:', err);
      toast({
        title: 'Error',
        description: 'Error inesperado. Por favor intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (error: string) => {
    const messages: Record<string, { title: string; description: string }> = {
      'invitation_not_found': {
        title: 'Invitación no válida',
        description: 'Esta invitación no existe o el enlace es incorrecto'
      },
      'invitation_already_accepted': {
        title: 'Invitación ya aceptada',
        description: 'Esta invitación ya ha sido utilizada'
      },
      'invitation_revoked': {
        title: 'Invitación revocada',
        description: 'Esta invitación ha sido cancelada por un administrador'
      },
      'invitation_expired': {
        title: 'Invitación expirada',
        description: 'Esta invitación ha caducado. Solicita una nueva al administrador'
      },
    };
    return messages[error] || { title: 'Error', description: 'Ha ocurrido un error inesperado' };
  };


  if (loadingInvitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Invalid invitation
  if (!invitation?.valid) {
    const errorInfo = getErrorMessage(invitation?.error || 'unknown');
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <div className="w-full max-w-md animate-in">
          <Card className="border-border/50 shadow-xl text-center">
            <CardHeader className="pb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
                {invitation?.error === 'invitation_expired' ? (
                  <Clock className="h-7 w-7 text-destructive" />
                ) : (
                  <AlertCircle className="h-7 w-7 text-destructive" />
                )}
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">{errorInfo.title}</CardTitle>
              <CardDescription className="text-muted-foreground">
                {errorInfo.description}
              </CardDescription>
            </CardHeader>
            <CardFooter className="justify-center">
              <Link to="/auth/login">
                <Button className="gap-2">
                  Ir al login
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // User is logged in - show accept button
  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <div className="w-full max-w-md animate-in">
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="space-y-1 text-center pb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                <Building2 className="h-7 w-7 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Invitación</CardTitle>
              <CardDescription className="text-muted-foreground">
                Has sido invitado a unirte a <strong className="text-foreground">{invitation.organization_name}</strong> como <strong className="text-foreground">{getRoleLabel(invitation.role || '')}</strong>
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Ya has iniciado sesión. Haz clic en el botón para unirte a la organización.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button 
                onClick={handleAcceptAsExistingUser} 
                className="w-full h-11 gap-2" 
                disabled={acceptingAsExisting}
              >
                {acceptingAsExisting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Aceptar Invitación
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  // Not logged in - show signup form
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-md animate-in">
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 text-center pb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
              <Building2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Invitación</CardTitle>
            <CardDescription className="text-muted-foreground">
              Has sido invitado a unirte a <strong className="text-foreground">{invitation.organization_name}</strong> como <strong className="text-foreground">{getRoleLabel(invitation.role || '')}</strong>
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Tu email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">Nombre completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Tu nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar contraseña</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-11"
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    Crear cuenta y aceptar
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{' '}
                <Link to={`/auth/login?invite=${token}`} className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                  <LogIn className="h-3 w-3" />
                  Iniciar sesión
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
