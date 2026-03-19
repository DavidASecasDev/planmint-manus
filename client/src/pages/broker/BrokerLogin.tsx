import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Ship, Eye, EyeOff } from 'lucide-react';
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

  // Clear any existing non-broker session on mount to avoid conflicts
  useEffect(() => {
    if (sessionCleared.current) return;
    sessionCleared.current = true;
    
    const clearNonBrokerSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Check if current user is a broker
          const { data: brokerData } = await supabase
            .rpc('get_broker_profile', { p_user_id: session.user.id });
          
          if (!brokerData || typeof brokerData !== 'object' || !('id' in (brokerData as any))) {
            // Not a broker - clear the session to prevent conflicts
            console.log('[BrokerLogin] Clearing non-broker session for:', session.user.email);
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

  // Redirect if already logged in as broker
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
        style={{ backgroundColor: '#1a365d' }}
      >
        <Loader2 className="h-10 w-10 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div 
      className="light min-h-screen flex items-center justify-center px-4"
      style={{ 
        backgroundColor: '#1a365d',
        backgroundImage: 'linear-gradient(to bottom right, #1a365d, #0f2644)'
      }}
    >
      {/* Decorative elements */}
      <div 
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      
      <div className="w-full max-w-md relative z-10">
        {/* Card */}
        <div 
          className="bg-white rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div 
            className="px-8 pt-10 pb-6 text-center"
            style={{ backgroundColor: '#1a365d' }}
          >
            <div className="inline-flex items-center justify-center mb-4">
              <Ship className="h-12 w-12 text-white" />
            </div>
            
            {/* Gold line */}
            <div 
              className="w-16 h-1 mx-auto mb-4"
              style={{ backgroundColor: '#b8860b' }}
            />
            
            <h1 className="text-2xl font-bold text-white">
              Portal de Broker
            </h1>
            <p className="text-white/85 text-sm mt-1">
              Gestiona tus solicitudes de transfers
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-8 space-y-5">
            {error && (
              <div 
                className="p-3 rounded-lg text-sm text-center"
                style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}
              >
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label 
                htmlFor="email" 
                className="text-sm font-medium"
                style={{ color: '#1a365d' }}
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
                  borderColor: '#e2e8f0',
                  backgroundColor: '#f8fafc'
                }}
              />
            </div>

            <div className="space-y-2">
              <Label 
                htmlFor="password" 
                className="text-sm font-medium"
                style={{ color: '#1a365d' }}
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
                    borderColor: '#e2e8f0',
                    backgroundColor: '#f8fafc'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
              className="w-full h-11 font-semibold text-white transition-all"
              disabled={isSubmitting}
              style={{ 
                backgroundColor: '#b8860b',
                borderColor: '#b8860b'
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

            <div className="text-center space-y-2">
              <button
                type="button"
                onClick={() => toast.info('Contacta con el administrador de tu organización para restablecer tu contraseña.')}
                className="text-sm hover:underline block"
                style={{ color: '#1a365d' }}
              >
                ¿Olvidaste tu contraseña?
              </button>
              <div className="pt-2 border-t border-gray-100">
                <span className="text-sm text-gray-500">¿No tienes cuenta? </span>
                <Link 
                  to="/broker/register" 
                  className="text-sm font-medium underline"
                  style={{ color: '#7a5c08' }}
                >
                  Solicitar acceso
                </Link>
              </div>
            </div>
          </form>
        </div>

        {/* Footer text */}
        <p className="text-center text-white/75 text-sm mt-6">
          © {new Date().getFullYear()} PlanMint
        </p>
      </div>
    </div>
  );
}
