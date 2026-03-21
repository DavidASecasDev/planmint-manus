/*
 * Azul Cars Brand — Broker Login
 * Dark mode: navy bg stays navy (brand identity), card adapts
 * Gold accent: oklch(0.72 0.10 80)
 * Headings: Montserrat 800 | Body/inputs: Barlow 400-500
 */
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { useBrokerTheme } from '@/contexts/BrokerThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

export default function BrokerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clearingSession, setClearingSession] = useState(true);
  const sessionCleared = useRef(false);

  const { login, isBroker, loading } = useBrokerAuth();
  const { resolvedTheme, setTheme } = useBrokerTheme();
  const navigate = useNavigate();
  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    if (sessionCleared.current) return;
    sessionCleared.current = true;

    const clearNonBrokerSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: brokerData } = await supabase.rpc('get_broker_profile', {
            p_user_id: session.user.id,
          });
          if (!brokerData || typeof brokerData !== 'object' || !('id' in (brokerData as any))) {
            await supabase.auth.signOut();
          }
        }
      } catch (err) {
        console.warn('[BrokerLogin] Error clearing session:', err);
      } finally {
        setClearingSession(false);
      }
    };

    clearNonBrokerSession();
  }, []);

  useEffect(() => {
    if (!loading && !clearingSession && isBroker) {
      navigate('/broker');
    }
  }, [loading, clearingSession, isBroker, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    const result = await login(email, password);

    if (result.error) {
      setError(result.error);
      setIsSubmitting(false);
    } else {
      navigate('/broker');
    }
  };

  if (loading || clearingSession) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: '#001321' }}
      >
        <Loader2
          className="h-10 w-10 animate-spin"
          style={{ color: 'oklch(0.72 0.10 80)' }}
        />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundColor: isDark ? '#060F17' : '#001321',
        fontFamily: 'Barlow, sans-serif',
      }}
    >
      {/* Theme toggle - top right corner */}
      <button
        type="button"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="fixed top-4 right-4 z-50 h-9 w-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
        style={{ color: 'rgba(255,255,255,0.5)' }}
        aria-label="Cambiar tema"
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </button>

      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: isDark ? '#0F1E2D' : '#FFFFFF',
            boxShadow: isDark
              ? '0 25px 60px -12px rgba(0, 0, 0, 0.6)'
              : '0 25px 60px -12px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center">
            <h1
              className="text-2xl tracking-tight"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                color: isDark ? '#EDE8DF' : '#001321',
                letterSpacing: '-0.02em',
              }}
            >
              AZUL<span style={{ color: 'oklch(0.72 0.10 80)' }}>.</span> TRANSFERS
            </h1>
            <div
              className="w-12 h-[2px] mx-auto mt-3 mb-2"
              style={{ backgroundColor: 'oklch(0.72 0.10 80)' }}
            />
            <p
              className="text-sm mt-3"
              style={{
                color: isDark ? '#7E8694' : '#52555B',
                fontFamily: 'Barlow, sans-serif',
                fontWeight: 400,
              }}
            >
              Gestiona tus solicitudes de transfers
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
            {error && (
              <div
                className="p-3 rounded-lg text-sm text-center"
                style={{
                  backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2',
                  color: '#DC2626',
                  border: isDark ? '1px solid rgba(220,38,38,0.25)' : '1px solid #FECACA',
                }}
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label
                htmlFor="email"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase' as const,
                  color: isDark ? '#7E8694' : '#52555B',
                }}
              >
                Correo electrónico
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-11"
                style={{
                  backgroundColor: isDark ? '#0A1520' : '#F8F7F4',
                  borderColor: isDark ? 'rgba(30,50,69,0.6)' : '#E5E2DB',
                  color: isDark ? '#EDE8DF' : '#0F1216',
                  fontFamily: 'Barlow, sans-serif',
                  fontSize: '15px',
                }}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                style={{
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                  fontSize: '10px',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase' as const,
                  color: isDark ? '#7E8694' : '#52555B',
                }}
              >
                Contraseña
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="h-11 pr-10"
                  style={{
                    backgroundColor: isDark ? '#0A1520' : '#F8F7F4',
                    borderColor: isDark ? 'rgba(30,50,69,0.6)' : '#E5E2DB',
                    color: isDark ? '#EDE8DF' : '#0F1216',
                    fontFamily: 'Barlow, sans-serif',
                    fontSize: '15px',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: isDark ? '#7E8694' : '#52555B' }}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 transition-all hover:brightness-110"
              disabled={isSubmitting}
              style={{
                backgroundColor: isDark ? 'oklch(0.72 0.10 80)' : '#001321',
                color: isDark ? '#001321' : '#FFFFFF',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
                borderRadius: '6px',
              }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Accediendo...
                </>
              ) : (
                'Acceder'
              )}
            </Button>

            <div className="text-center space-y-3 pt-2">
              <button
                type="button"
                onClick={() =>
                  toast.info(
                    'Contacta con el administrador de tu organización para restablecer tu contraseña.'
                  )
                }
                className="text-sm hover:underline block w-full"
                style={{
                  color: isDark ? '#7E8694' : '#52555B',
                  fontFamily: 'Barlow, sans-serif',
                }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </form>
        </div>

        {/* Footer text */}
        <p
          className="text-center text-xs mt-8"
          style={{
            color: 'rgba(255,255,255,0.35)',
            fontFamily: 'Barlow, sans-serif',
            letterSpacing: '0.05em',
          }}
        >
          © {new Date().getFullYear()} Azul Cars. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
}
