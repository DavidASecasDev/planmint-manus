/*
 * Azul Cars Brand — Broker Register (Invite-only)
 * Dark mode: navy bg adapts, card uses dark surface
 * Gold: oklch(0.72 0.10 80) | Headings: Montserrat 800 | Body: Barlow
 */
import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { decodeBrokerInviteCode } from '@/lib/brokerInvite';
import { useBrokerTheme } from '@/contexts/BrokerThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, CheckCircle2, ShieldX, Building2, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

interface Organization {
  id: string;
  name: string;
}

export default function BrokerRegister() {
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get('invite');
  const { resolvedTheme, setTheme } = useBrokerTheme();
  const isDark = resolvedTheme === 'dark';

  // Invite validation state
  const [validating, setValidating] = useState(true);
  const [inviteValid, setInviteValid] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);

  // Form state
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

  // Validate invite code on mount
  useEffect(() => {
    async function validateInvite() {
      if (!inviteCode) {
        setValidating(false);
        setInviteValid(false);
        return;
      }

      const orgId = decodeBrokerInviteCode(inviteCode);
      if (!orgId) {
        setValidating(false);
        setInviteValid(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('organizations')
          .select('id, name')
          .eq('id', orgId)
          .eq('status', 'active')
          .single();

        if (error || !data) {
          setInviteValid(false);
        } else {
          setOrganization(data);
          setInviteValid(true);
        }
      } catch {
        setInviteValid(false);
      } finally {
        setValidating(false);
      }
    }

    validateInvite();
  }, [inviteCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!organization) {
      setError('Invitación no válida');
      return;
    }
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
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
            organization_id: organization.id,
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
    } catch {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Shared styles
  const pageBg = isDark ? '#060F17' : '#001321';
  const cardBg = isDark ? '#0F1E2D' : '#FFFFFF';
  const cardShadow = isDark
    ? '0 25px 60px -12px rgba(0, 0, 0, 0.6)'
    : '0 25px 60px -12px rgba(0, 0, 0, 0.4)';
  const titleColor = isDark ? '#EDE8DF' : '#001321';
  const subtitleColor = isDark ? '#7E8694' : '#52555B';
  const inputBg = isDark ? '#0A1520' : '#F8F7F4';
  const inputBorder = isDark ? 'rgba(30,50,69,0.6)' : '#E5E2DB';
  const inputColor = isDark ? '#EDE8DF' : '#0F1216';
  const errorBg = isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2';
  const errorBorder = isDark ? '1px solid rgba(220,38,38,0.25)' : '1px solid #FECACA';
  const btnBg = isDark ? 'oklch(0.72 0.10 80)' : '#001321';
  const btnColor = isDark ? '#001321' : '#FFFFFF';
  const dividerColor = isDark ? 'rgba(30,50,69,0.6)' : '#E5E2DB';

  const inputStyle: React.CSSProperties = {
    backgroundColor: inputBg,
    borderColor: inputBorder,
    color: inputColor,
    fontFamily: 'Barlow, sans-serif',
    fontSize: '15px',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: 'Montserrat, sans-serif',
    fontWeight: 700,
    fontSize: '10px',
    letterSpacing: '1.5px',
    textTransform: 'uppercase',
    color: subtitleColor,
  };

  // Theme toggle button (shared across all states)
  const themeToggle = (
    <button
      type="button"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="fixed top-4 right-4 z-50 h-9 w-9 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
      style={{ color: 'rgba(255,255,255,0.5)' }}
      aria-label="Cambiar tema"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );

  // --- Loading state ---
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: pageBg }}>
        {themeToggle}
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: 'oklch(0.72 0.10 80)' }} />
      </div>
    );
  }

  // --- Invalid or missing invite ---
  if (!inviteValid || !organization) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: pageBg, fontFamily: 'Barlow, sans-serif' }}
      >
        {themeToggle}
        <div
          className="w-full max-w-md rounded-xl p-8 text-center"
          style={{ backgroundColor: cardBg, boxShadow: cardShadow }}
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
            style={{ backgroundColor: isDark ? 'rgba(220,38,38,0.12)' : '#FEF2F2' }}
          >
            <ShieldX className="h-8 w-8" style={{ color: '#DC2626' }} />
          </div>
          <h2
            className="text-xl mb-3"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              color: titleColor,
              letterSpacing: '-0.02em',
            }}
          >
            Invitación Requerida
          </h2>
          <p className="text-sm mb-2" style={{ color: subtitleColor }}>
            Para registrarte como broker necesitas un enlace de invitación válido proporcionado por el administrador de la organización.
          </p>
          <p className="text-xs mb-6" style={{ color: isDark ? '#5A6270' : '#9CA3AF' }}>
            Si crees que esto es un error, contacta con tu administrador para que te envíe un nuevo enlace.
          </p>
          <Link to="/broker/login">
            <Button
              className="w-full hover:brightness-110"
              style={{
                backgroundColor: btnBg,
                color: btnColor,
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

  // --- Success state ---
  if (isSuccess) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: pageBg, fontFamily: 'Barlow, sans-serif' }}
      >
        {themeToggle}
        <div
          className="w-full max-w-md rounded-xl p-8 text-center"
          style={{ backgroundColor: cardBg, boxShadow: cardShadow }}
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-5"
            style={{ backgroundColor: isDark ? 'rgba(22,163,106,0.12)' : '#F0FDF4' }}
          >
            <CheckCircle2 className="h-8 w-8" style={{ color: '#16A34A' }} />
          </div>
          <h2
            className="text-xl mb-3"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 800,
              color: titleColor,
              letterSpacing: '-0.02em',
            }}
          >
            Solicitud Enviada
          </h2>
          <p className="text-sm mb-6" style={{ color: subtitleColor }}>
            Tu solicitud de acceso a <strong style={{ color: titleColor }}>{organization.name}</strong> ha sido enviada correctamente.
            Recibirás un email cuando sea aprobada.
          </p>
          <Link to="/broker/login">
            <Button
              className="w-full hover:brightness-110"
              style={{
                backgroundColor: btnBg,
                color: btnColor,
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

  // --- Registration form ---
  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-8"
      style={{ backgroundColor: pageBg, fontFamily: 'Barlow, sans-serif' }}
    >
      {themeToggle}
      <div className="w-full max-w-md relative z-10">
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: cardBg, boxShadow: cardShadow }}
        >
          {/* Header */}
          <div className="px-8 pt-8 pb-5 text-center">
            <h1
              className="text-2xl tracking-tight"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 800,
                color: titleColor,
                letterSpacing: '-0.02em',
              }}
            >
              AZUL<span style={{ color: 'oklch(0.72 0.10 80)' }}>.</span> TRANSFERS
            </h1>
            <div
              className="w-12 h-[2px] mx-auto mt-3 mb-2"
              style={{ backgroundColor: 'oklch(0.72 0.10 80)' }}
            />
            <p className="text-sm mt-3" style={{ color: subtitleColor }}>
              Solicitud de acceso como broker
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-4">
            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{
                  backgroundColor: errorBg,
                  color: '#DC2626',
                  border: errorBorder,
                }}
              >
                {error}
              </div>
            )}

            {/* Organization (read-only, from invite) */}
            <div className="space-y-2">
              <Label style={labelStyle}>Organización</Label>
              <div
                className="flex items-center gap-2 h-11 px-3 rounded-md"
                style={{
                  backgroundColor: isDark ? 'rgba(15,30,45,0.8)' : '#F0F1F3',
                  border: `1px solid ${inputBorder}`,
                }}
              >
                <Building2 className="h-4 w-4 shrink-0" style={{ color: 'oklch(0.72 0.10 80)' }} />
                <span
                  className="text-sm font-medium truncate"
                  style={{
                    fontFamily: 'Barlow, sans-serif',
                    color: titleColor,
                  }}
                >
                  {organization.name}
                </span>
              </div>
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
                  style={{ color: subtitleColor }}
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
                backgroundColor: btnBg,
                color: btnColor,
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

            <div className="text-center pt-3" style={{ borderTop: `1px solid ${dividerColor}` }}>
              <span className="text-sm" style={{ color: subtitleColor }}>
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
          &copy; {new Date().getFullYear()} Azul Cars
        </p>
      </div>
    </div>
  );
}
