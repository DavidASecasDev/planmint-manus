import { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';
import { Loader2, Mail, Lock } from 'lucide-react';
import { z } from 'zod';
import logo from '@/assets/logo.png';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

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

  // Check for invitation redirect
  const inviteToken = searchParams.get('invite');
  const redirectTo = (location.state as any)?.from?.pathname;

  // Auto-accept invitation after login if token is present (runs once via ref)
  useEffect(() => {
    const acceptInvitation = async () => {
      if (user && !profileLoading && inviteToken && !inviteAcceptedRef.current) {
        inviteAcceptedRef.current = true;
        setAcceptingInvite(true);
        try {
          const { data, error } = await supabase.rpc('accept_invitation', { p_token: inviteToken });
          
          if (error) {
            console.error('Error accepting invitation:', error);
            navigate('/dashboard');
            return;
          }
          
          const result = data as { success?: boolean; organization_name?: string; error?: string } | null;
          
          if (result?.success) {
            toast({ 
              title: 'Invitación aceptada', 
              description: `Te has unido a ${result.organization_name}` 
            });
          } else if (result?.error === 'email_mismatch') {
            toast({
              title: 'Email no coincide',
              description: 'Tu cuenta no coincide con el email de la invitación.',
              variant: 'destructive',
            });
          }
          navigate('/dashboard');
        } catch (err) {
          console.error('Error accepting invitation:', err);
          navigate('/dashboard');
        } finally {
          setAcceptingInvite(false);
        }
      }
    };
    
    acceptInvitation();
  }, [user, profileLoading, inviteToken, navigate]);

  // Show loading while auth OR profile is loading
  if (authLoading || profileLoading || acceptingInvite) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          {acceptingInvite && (
            <p className="mt-4 text-muted-foreground">Aceptando invitación...</p>
          )}
        </div>
      </div>
    );
  }

  // Show active session screen instead of auto-redirecting
  if (user && !profileLoading && !inviteToken) {
    const handleSignOut = async () => {
      await signOut();
    };

    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
        <Card className="w-full max-w-md border-border/50 shadow-xl">
          <CardHeader className="space-y-1 text-center pb-6 pt-8">
            <img src={logo} alt="PlanMint Logo" className="mx-auto mb-6 h-14 w-14 rounded-2xl shadow-lg object-contain" />
            <CardTitle className="text-2xl font-bold">Ya tienes sesión activa</CardTitle>
            <CardDescription className="text-base">
              Estás conectado como <span className="font-medium text-foreground">{user.email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pb-8">
            <Button 
              onClick={() => navigate(redirectTo || '/dashboard')} 
              className="w-full h-12 text-base font-semibold"
            >
              Ir al Dashboard
            </Button>
            <Button 
              variant="outline" 
              onClick={handleSignOut}
              className="w-full h-12 text-base"
            >
              Cerrar sesión e iniciar con otra cuenta
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted/30 p-4">
      <Card className="w-full max-w-md border-border/50 shadow-xl">
        <CardHeader className="space-y-1 text-center pb-8 pt-8">
          <img src={logo} alt="PlanMint Logo" className="mx-auto mb-6 h-14 w-14 rounded-2xl shadow-lg object-contain" />
          <CardTitle className="text-2xl font-bold">Iniciar Sesión</CardTitle>
          <CardDescription className="text-base">
            {inviteToken 
              ? 'Inicia sesión para aceptar tu invitación' 
              : 'Ingresa tus credenciales para acceder a tu cuenta'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10 h-12" required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-10 h-12" required />
              </div>
            </div>
            <div className="text-right">
              <Link to="/auth/recover" className="text-sm font-medium text-primary hover:underline">¿Olvidaste tu contraseña?</Link>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4 pt-2 pb-8">
            <Button type="submit" className="w-full h-12 text-base font-semibold shadow-sm" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Iniciar Sesión
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              ¿No tienes cuenta?{' '}
              <Link 
                to={inviteToken ? `/auth/invitation/${inviteToken}` : "/auth/register"} 
                className="font-medium text-primary hover:underline"
              >
                {inviteToken ? 'Crear cuenta' : 'Regístrate'}
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
