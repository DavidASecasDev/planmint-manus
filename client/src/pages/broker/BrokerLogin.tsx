import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff } from 'lucide-react';
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
  const navigate = useNavigate();

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
        style={{ backgroundColor: '#0D1117' }}
      >
        <Loader2 className="h-10 w-10 animate-spin" style={{ color: '#A3E635' }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{
        backgroundColor: '#0D1117',
        backgroundImage:
          'radial-gradient(ellipse at 50% 0%, rgba(163, 230, 53, 0.06) 0%, transparent 60%)',
      }}
    >
      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: '#161B22',
            border: '1px solid rgba(163, 230, 53, 0.15)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Header */}
          <div className="px-8 pt-10 pb-6 text-center">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-5 font-bold text-xl"
              style={{ backgroundColor: '#A3E635', color: '#0D1117' }}
            >
              AC
            </div>

            {/* Green line */}
            <div
              className="w-16 h-[2px] mx-auto mb-4"
              style={{ background: 'linear-gradient(90deg, transparent, #A3E635, transparent)' }}
            />

            <h1
              className="text-2xl font-bold uppercase tracking-wider"
              style={{ color: '#E6EDF3' }}
            >
              Portal de Broker
            </h1>
            <p className="text-sm mt-2" style={{ color: 'rgba(230, 237, 243, 0.5)' }}>
              Gestiona tus solicitudes de transfers
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
            {error && (
              <div
                className="p-3 rounded-lg text-sm text-center"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#F87171',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label
                htmlFor="email"
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'rgba(230, 237, 243, 0.6)' }}
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
                  backgroundColor: '#0D1117',
                  borderColor: 'rgba(163, 230, 53, 0.2)',
                  color: '#E6EDF3',
                }}
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-xs font-medium uppercase tracking-wider"
                style={{ color: 'rgba(230, 237, 243, 0.6)' }}
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
                    backgroundColor: '#0D1117',
                    borderColor: 'rgba(163, 230, 53, 0.2)',
                    color: '#E6EDF3',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'rgba(230, 237, 243, 0.4)' }}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-bold uppercase text-sm tracking-wider transition-all hover:brightness-110"
              disabled={isSubmitting}
              style={{
                backgroundColor: '#A3E635',
                color: '#0D1117',
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
                style={{ color: 'rgba(230, 237, 243, 0.5)' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
              <div
                className="pt-3"
                style={{ borderTop: '1px solid rgba(163, 230, 53, 0.1)' }}
              >
                <span className="text-sm" style={{ color: 'rgba(230, 237, 243, 0.4)' }}>
                  ¿No tienes cuenta?{' '}
                </span>
                <Link
                  to="/broker/register"
                  className="text-sm font-semibold hover:underline"
                  style={{ color: '#A3E635' }}
                >
                  Solicitar acceso
                </Link>
              </div>
            </div>
          </form>
        </div>

        {/* Footer text */}
        <p
          className="text-center text-xs uppercase tracking-wider mt-6"
          style={{ color: 'rgba(230, 237, 243, 0.3)' }}
        >
          © {new Date().getFullYear()} Azul Cars
        </p>
      </div>
    </div>
  );
}
