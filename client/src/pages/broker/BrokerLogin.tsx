/*
 * Azul Cars Brand — Broker Login
 * Dark mode: deep navy bg adapts, card adapts
 * Gold accent: oklch(0.72 0.10 80)
 * Headings: Montserrat 800 | Body/inputs: Barlow 400-500
 * All inline theme colors include transition for smooth switching.
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

/* Shared transition for all inline-styled elements */
const T = 'background-color 450ms cubic-bezier(.4,0,.2,1), color 450ms cubic-bezier(.4,0,.2,1), border-color 450ms cubic-bezier(.4,0,.2,1), box-shadow 450ms cubic-bezier(.4,0,.2,1)';

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
          // Check if user already has a broker profile — if so, they'll be
          // redirected to /broker by the isBroker effect below.
          // If NOT a broker, do NOT sign them out — their PlanMint session
          // must remain intact. Just show the login form.
          const { data: brokerData } = await (supabase as any)
            .from('broker_profiles')
            .select('id')
            .eq('user_id', session.user.id)
            .maybeSingle();
          if (!brokerData) {
            // User is logged into PlanMint but has no broker access.
            // Previously we did signOut() here which destroyed their PlanMint session.
            // Now we just proceed — they'll see the login form or a "no access" message.
            console.info('[BrokerLogin] User has PlanMint session but no broker profile — preserving session');
          }
        }
      } catch (err) {
        console.warn('[BrokerLogin] Error checking session:', err);
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
        transition: T,
      }}
    >
      {/* Theme toggle - top right corner */}
      <button
        type="button"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        className="fixed top-4 right-4 z-50 h-9 w-9 rounded-full flex items-center justify-center"
        style={{
          color: 'rgba(255,255,255,0.5)',
          transition: T,
        }}
        aria-label="Cambiar tema"
      >
        <Sun
          className="absolute h-4 w-4"
          style={{
            transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0)',
            opacity: isDark ? 1 : 0,
            transition: 'transform 500ms cubic-bezier(.4,0,.2,1), opacity 400ms ease',
          }}
        />
        <Moon
          className="absolute h-4 w-4"
          style={{
            transform: isDark ? 'rotate(90deg) scale(0)' : 'rotate(0deg) scale(1)',
            opacity: isDark ? 0 : 1,
            transition: 'transform 500ms cubic-bezier(.4,0,.2,1), opacity 400ms ease',
          }}
        />
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
            transition: T,
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
                transition: T,
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
                transition: T,
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
                  transition: T,
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
                  transition: T,
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
                  transition: T,
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
                  transition: T,
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
                    transition: T,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{
                    color: isDark ? '#7E8694' : '#52555B',
                    transition: T,
                  }}
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
              className="w-full h-11 hover:brightness-110"
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
                transition: T,
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
                  transition: T,
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
