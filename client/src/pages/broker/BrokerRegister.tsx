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

/*
 * Azul Cars Brand – Register
 * Navy bg: #001321 | Gold: oklch(0.72 0.10 80) | Card: white
 * Headings: Montserrat 800 | Body: Barlow 400-500
 * Labels: Montserrat 700, uppercase, tracking 1.5px, #52555B
 */

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
            apikey: SUPABASE_ANON_KEY,
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
          missing_fields: 'Por favor completa todos los campos requeridos',
          weak_password: 'La contraseña debe tener al menos 6 caracteres',
          invalid_email: 'El formato del email no es válido',
          invalid_organization: 'La organización seleccionada no es válida',
          pending_request: 'Ya tienes una solicitud pendiente. Te notificaremos cuando sea revisada.',
          rejected_request: 'Tu solicitud anterior fue rechazada. Contacta al administrador.',
          already_approved: 'Ya tienes acceso aprobado. Inicia sesión en su lugar.',
          email_exists: 'Este email ya está registrado. Intenta iniciar sesión.',
          duplicate_request: 'Ya existe una solicitud con este email para esta organización',
          rate_limited: 'Demasiados intentos. Por favor espera una hora antes de reintentar.',
          critical_error: 'Ocurrió un error inesperado. Nuestro equipo ha sido notificado.',
          server_error: 'Error del servidor. Intenta de nuevo más tarde.',
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

  const inputStyle: React.CSSProperties = {
    backgroundColor: '#F8F7F4',
    borderColor: '#E5E2DB',
    color: '#0F1216',
    fontFamily: 'Barlow, sans-serif',
    fontSize: '15px',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Montserrat, sans-serif',
    fontWeight: 700,
    fontSize: '10px',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: '#52555B',
  };

  if (isSuccess) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{
          backgroundColor: '#001321',
          fontFamily: 'Barlow, sans-serif',
        }}
      >
        <div
          className="w-full max-w-md rounded-xl p-8 text-center"
          style={{
            backgroundColor: '#FFFFFF',
            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.4)',
          }}
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
            style={{ backgroundColor: '#F0FDF4' }}
          >
            <CheckCircle2 className="h-8 w-8" style={{ color: '#16A34A' }} />
          </div>
          <h2
            className="text-xl mb-3"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              color: '#001321',
              letterSpacing: '-0.02em',
            }}
          >
            Solicitud Enviada
          </h2>
          <p className="text-sm mb-6" style={{ color: '#52555B' }}>
            Tu solicitud de acceso ha sido enviada correctamente. Recibirás un email cuando sea
            aprobada.
          </p>
          <Link to="/broker/login">
            <Button
              className="w-full hover:brightness-110"
              style={{
                backgroundColor: '#001321',
                color: '#FFFFFF',
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '12px',
                letterSpacing: '0.1em',
                textTransform: 'uppercase' as const,
              }}
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
        backgroundColor: '#001321',
        fontFamily: 'Barlow, sans-serif',
      }}
    >
      <div className="w-full max-w-md relative z-10">
        <div
          className="rounded-xl overflow-hidden"
          style={{
            backgroundColor: '#FFFFFF',
            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-5 text-center">
            <h1
              className="text-2xl tracking-tight"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                color: '#001321',
                letterSpacing: '-0.02em',
              }}
            >
              AZUL<span style={{ color: 'oklch(0.72 0.10 80)' }}>.</span> TRANSFERS
            </h1>
            <div
              className="w-12 h-[2px] mx-auto mt-3 mb-2"
              style={{ backgroundColor: 'oklch(0.72 0.10 80)' }}
            />
            <p className="text-sm mt-3" style={{ color: '#52555B' }}>
              Registro para brokers externos
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: '#FEF2F2',
                  color: '#DC2626',
                  border: '1px solid #FECACA',
                }}
              >
                {error}
              </div>
            )}

            {/* Organization */}
            <div className="space-y-2">
              <Label style={labelStyle}>Organización *</Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger className="h-11" style={inputStyle}>
                  <SelectValue
                    placeholder={loadingOrgs ? 'Cargando...' : 'Selecciona una organización'}
                  />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Name */}
            <div className="space-y-2">
              <Label style={labelStyle}>Nombre completo *</Label>
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
              <Label style={labelStyle}>Empresa</Label>
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
              <Label style={labelStyle}>Correo electrónico *</Label>
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
              <Label style={labelStyle}>Teléfono</Label>
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
              <Label style={labelStyle}>Contraseña *</Label>
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
                  style={{ color: '#52555B' }}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label style={labelStyle}>Confirmar contraseña *</Label>
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
              className="w-full h-11 transition-all hover:brightness-110 mt-2"
              disabled={isSubmitting}
              style={{
                backgroundColor: '#001321',
                color: '#FFFFFF',
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
                  Enviando solicitud...
                </>
              ) : (
                'Enviar Solicitud'
              )}
            </Button>

            <div className="text-center pt-3" style={{ borderTop: '1px solid #E5E2DB' }}>
              <span className="text-sm" style={{ color: '#52555B' }}>
                ¿Ya tienes cuenta?{' '}
              </span>
              <Link
                to="/broker/login"
                className="text-sm hover:underline"
                style={{
                  color: 'oklch(0.72 0.10 80)',
                  fontFamily: 'Montserrat, sans-serif',
                  fontWeight: 700,
                }}
              >
                Iniciar sesión
              </Link>
            </div>
          </form>
        </div>

        <p
          className="text-center text-xs mt-8"
          style={{
            color: 'rgba(255,255,255,0.35)',
            fontFamily: 'Barlow, sans-serif',
            letterSpacing: '0.05em',
          }}
        >
          © {new Date().getFullYear()} Azul Cars
        </p>
      </div>
    </div>
  );
}
