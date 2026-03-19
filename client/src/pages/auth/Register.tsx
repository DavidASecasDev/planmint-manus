import { useState, useEffect } from 'react';
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
import logo from '@/assets/logo.png';

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Las contraseñas no coinciden',
  path: ['confirmPassword'],
});

export default function Register() {
  const { signUp, user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [refCode, setRefCode] = useState<string | null>(null);

  // Get referral code from URL or localStorage
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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If user is already authenticated, redirect appropriately
  if (user) {
    // Check if there's an invite token — redirect to invitation page instead
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
      toast({
        title: 'Error de validación',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { error } = await signUp(email, password, name);

    if (error) {
      let message = 'Error al registrarse';
      if (error.message.includes('User already registered')) {
        message = 'Este email ya está registrado';
      }
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    // Track referral signup if ref code exists
    if (refCode) {
      try {
        // Use the dedicated function to track signup
        await supabase.rpc('track_referral_signup', { 
          ref_code: refCode, 
          user_email: email 
        });

        // Clear stored referral code
        localStorage.removeItem('ref_code');
        localStorage.removeItem('ref_code_expires');
      } catch (err) {
        console.error('Error tracking referral signup:', err);
      }
    }

    toast({
      title: '¡Cuenta creada!',
      description: 'Tu cuenta ha sido creada exitosamente.',
    });

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-md animate-in">
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 text-center pb-6">
            <img src={logo} alt="PlanMint Logo" className="mx-auto mb-4 h-14 w-14 rounded-2xl shadow-lg object-contain" />
            <CardTitle className="text-2xl font-bold tracking-tight">Crear Cuenta</CardTitle>
            <CardDescription className="text-muted-foreground">
              Completa los datos para registrarte
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
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
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                    Crear Cuenta
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{' '}
                <Link to="/auth/login" className="text-primary font-medium hover:underline">
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
