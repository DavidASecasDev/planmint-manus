import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
}

export default function BrokerRegister() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function fetchOrganizations() {
      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('status', 'active')
          .order('name');
        
        if (error) throw error;
        setOrganizations(data || []);
      } catch (err) {
        console.error('Error fetching organizations:', err);
        toast.error('Error al cargar organizaciones');
      } finally {
        setLoadingOrgs(false);
      }
    }
    fetchOrganizations();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (!organizationId) {
      setError('Selecciona una organización');
      return;
    }
    
    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/request-broker-access`,
        {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            organization_id: organizationId,
            name: name.trim(),
            company: company?.trim() || null,
            email: email.trim().toLowerCase(),
            phone: phone?.trim() || null,
            password,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        const errorMessages: Record<string, string> = {
          'missing_fields': 'Por favor completa todos los campos requeridos',
          'weak_password': 'La contraseña debe tener al menos 6 caracteres',
          'invalid_email': 'El formato del email no es válido',
          'invalid_organization': 'La organización seleccionada no es válida',
          'pending_request': 'Ya tienes una solicitud pendiente. Te notificaremos cuando sea revisada.',
          'rejected_request': 'Tu solicitud anterior fue rechazada. Contacta al administrador.',
          'already_approved': 'Ya tienes acceso aprobado. Inicia sesión en su lugar.',
          'email_exists': 'Este email ya está registrado. Intenta iniciar sesión.',
          'duplicate_request': 'Ya existe una solicitud con este email para esta organización',
          'rate_limited': 'Demasiados intentos. Por favor espera una hora antes de reintentar.',
          'critical_error': 'Ocurrió un error inesperado. Nuestro equipo ha sido notificado.',
          'server_error': 'Error del servidor. Intenta de nuevo más tarde.',
        };
        
        setError(errorMessages[result.error] || result.message || 'Error al procesar la solicitud');
        return;
      }

      setIsSuccess(true);
      
    } catch (err) {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle = {
    backgroundColor: '#0D1117',
    borderColor: 'rgba(163, 230, 53, 0.2)',
    color: '#E6EDF3',
  };

  const labelStyle: React.CSSProperties = {
    color: 'rgba(230, 237, 243, 0.6)',
  };

  if (isSuccess) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundColor: '#0D1117',
          backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(163, 230, 53, 0.06) 0%, transparent 60%)',
        }}
      >
        <div
          className="w-full max-w-md rounded-2xl p-8 text-center"
          style={{
            backgroundColor: '#161B22',
            border: '1px solid rgba(163, 230, 53, 0.15)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
            style={{ backgroundColor: 'rgba(163, 230, 53, 0.1)' }}
          >
            <CheckCircle2 className="h-8 w-8" style={{ color: '#A3E635' }} />
          </div>
          <h2 className="text-xl font-bold mb-3 uppercase tracking-wider" style={{ color: '#E6EDF3' }}>
            ¡Solicitud Enviada!
          </h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(230, 237, 243, 0.5)' }}>
            Tu solicitud de acceso ha sido enviada correctamente. Recibirás un email cuando sea aprobada.
          </p>
          <Link to="/broker/login">
            <Button
              className="w-full font-bold uppercase text-sm tracking-wider hover:brightness-110"
              style={{ backgroundColor: '#A3E635', color: '#0D1117' }}
            >
              Ir al Login
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{
        backgroundColor: '#0D1117',
        backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(163, 230, 53, 0.06) 0%, transparent 60%)',
      }}
    >
      <div className="w-full max-w-md relative z-10">
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            backgroundColor: '#161B22',
            border: '1px solid rgba(163, 230, 53, 0.15)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-6 text-center">
            <div
              className="inline-flex items-center justify-center w-14 h-14 rounded-xl mb-5 font-bold text-xl"
              style={{ backgroundColor: '#A3E635', color: '#0D1117' }}
            >
              AC
            </div>
            <div
              className="w-16 h-[2px] mx-auto mb-4"
              style={{ background: 'linear-gradient(90deg, transparent, #A3E635, transparent)' }}
            />
            <h1 className="text-xl font-bold uppercase tracking-wider" style={{ color: '#E6EDF3' }}>
              Solicitar Acceso
            </h1>
            <p className="text-sm mt-2" style={{ color: 'rgba(230, 237, 243, 0.5)' }}>
              Registro para brokers externos
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: '#F87171',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                }}
              >
                {error}
              </div>
            )}

            {/* Organization */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>
                Organización *
              </Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger className="h-11" style={inputStyle}>
                  <SelectValue placeholder={loadingOrgs ? 'Cargando...' : 'Selecciona una organización'} />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>
                Nombre completo *
              </Label>
              <Input
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-11"
                style={inputStyle}
              />
            </div>

            {/* Company */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>
                Empresa
              </Label>
              <Input
                type="text"
                placeholder="Nombre de tu empresa"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={isSubmitting}
                className="h-11"
                style={inputStyle}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>
                Correo electrónico *
              </Label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-11"
                style={inputStyle}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>
                Teléfono
              </Label>
              <Input
                type="tel"
                placeholder="+34 600 000 000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSubmitting}
                className="h-11"
                style={inputStyle}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>
                Contraseña *
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isSubmitting}
                  className="h-11 pr-10"
                  style={inputStyle}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'rgba(230, 237, 243, 0.4)' }}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label className="text-xs font-medium uppercase tracking-wider" style={labelStyle}>
                Confirmar contraseña *
              </Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-11"
                style={inputStyle}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 font-bold uppercase text-sm tracking-wider transition-all hover:brightness-110 mt-2"
              disabled={isSubmitting}
              style={{ backgroundColor: '#A3E635', color: '#0D1117' }}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando solicitud...
                </>
              ) : (
                'Enviar Solicitud'
              )}
            </Button>

            <div className="text-center pt-3" style={{ borderTop: '1px solid rgba(163, 230, 53, 0.1)' }}>
              <span className="text-sm" style={{ color: 'rgba(230, 237, 243, 0.4)' }}>
                ¿Ya tienes cuenta?{' '}
              </span>
              <Link
                to="/broker/login"
                className="text-sm font-semibold hover:underline"
                style={{ color: '#A3E635' }}
              >
                Iniciar sesión
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-xs uppercase tracking-wider mt-6" style={{ color: 'rgba(230, 237, 243, 0.3)' }}>
          © {new Date().getFullYear()} Azul Cars
        </p>
      </div>
    </div>
  );
}
