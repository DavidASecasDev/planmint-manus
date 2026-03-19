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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
      toast({
        title: 'Error de validación',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { error } = await resetPassword(email);

    if (error) {
      toast({
        title: 'Error',
        description: 'Error al enviar el email de recuperación',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <div className="w-full max-w-md animate-in">
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="space-y-1 text-center pb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10">
                <CheckCircle2 className="h-7 w-7 text-green-500" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Email Enviado</CardTitle>
              <CardDescription className="text-muted-foreground">
                Revisa tu bandeja de entrada para restablecer tu contraseña
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link to="/auth/login" className="w-full">
                <Button variant="outline" className="w-full h-11 gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver al login
                </Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-md animate-in">
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 text-center pb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
              <span className="text-xl font-bold text-primary-foreground">AG</span>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Recuperar Contraseña</CardTitle>
            <CardDescription className="text-muted-foreground">
              Ingresa tu email y te enviaremos un enlace para restablecer tu contraseña
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
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
            </CardContent>
            <CardFooter className="flex flex-col space-y-4 pt-2">
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Enviar Email'
                )}
              </Button>
              <Link to="/auth/login" className="w-full">
                <Button variant="ghost" className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Volver al login
                </Button>
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
