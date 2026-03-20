import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Ship, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
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

  // Fetch organizations that allow broker registration
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
    
    // Validaciones locales (UX rápida)
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
      // Llamar a Edge Function atómica
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
        // Mapeo de códigos a mensajes amigables
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

      // Éxito
      setIsSuccess(true);
      
    } catch (err) {
      setError('Error de conexión. Verifica tu internet e intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div 
        className="light min-h-screen flex items-center justify-center px-4"
        style={{ 
          backgroundColor: '#1a365d',
          backgroundImage: 'linear-gradient(to bottom right, #1a365d, #0f2644)'
        }}
      >
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl overflow-hidden p-8 text-center">
            <div 
              className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ backgroundColor: '#d4edda' }}
            >
              <CheckCircle2 className="h-8 w-8" style={{ color: '#155724' }} />
            </div>
            
            <h2 className="text-xl font-bold mb-2" style={{ color: '#1a365d' }}>
              ¡Solicitud Enviada!
            </h2>
            
            <p className="text-gray-600 mb-6">
              Tu solicitud de acceso ha sido enviada correctamente. 
              Recibirás un email cuando sea aprobada.
            </p>
            
            <Link to="/broker/login">
              <Button 
                className="w-full"
                style={{ backgroundColor: '#b8860b' }}
              >
                Ir al Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="light min-h-screen flex items-center justify-center px-4 py-8"
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
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div 
            className="px-8 pt-8 pb-6 text-center"
            style={{ backgroundColor: '#1a365d' }}
          >
            <div className="inline-flex items-center justify-center mb-4">
              <Ship className="h-10 w-10 text-white" />
            </div>
            
            <div 
              className="w-16 h-1 mx-auto mb-4"
              style={{ backgroundColor: '#b8860b' }}
            />
            
            <h1 className="text-xl font-bold text-white">
              Solicitar Acceso
            </h1>
            <p className="text-white/85 text-sm mt-1">
              Registro para brokers externos
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="px-8 py-6 space-y-4">
            {error && (
              <div 
                className="p-3 rounded-lg text-sm"
                style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}
              >
                {error}
              </div>
            )}

            {/* Organization Select */}
            <div className="space-y-2">
              <Label style={{ color: '#1a365d' }}>
                Organización *
              </Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger 
                  className="h-10"
                  style={{ borderColor: '#e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a' }}
                >
                  <SelectValue placeholder={loadingOrgs ? "Cargando..." : "Selecciona una organización"} />
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
              <Label style={{ color: '#1a365d' }}>
                Nombre completo *
              </Label>
              <Input
                type="text"
                placeholder="Tu nombre"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-10"
                style={{ borderColor: '#e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a' }}
              />
            </div>

            {/* Company */}
            <div className="space-y-2">
              <Label style={{ color: '#1a365d' }}>
                Empresa
              </Label>
              <Input
                type="text"
                placeholder="Nombre de tu empresa"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                disabled={isSubmitting}
                className="h-10"
                style={{ borderColor: '#e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a' }}
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label style={{ color: '#1a365d' }}>
                Correo electrónico *
              </Label>
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-10"
                style={{ borderColor: '#e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a' }}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label style={{ color: '#1a365d' }}>
                Teléfono
              </Label>
              <Input
                type="tel"
                placeholder="+34 600 000 000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={isSubmitting}
                className="h-10"
                style={{ borderColor: '#e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a' }}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label style={{ color: '#1a365d' }}>
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
                  className="h-10 pr-10"
                  style={{ borderColor: '#e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label style={{ color: '#1a365d' }}>
                Confirmar contraseña *
              </Label>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="Repite la contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isSubmitting}
                className="h-10"
                style={{ borderColor: '#e2e8f0', backgroundColor: '#f8fafc', color: '#0f172a' }}
              />
            </div>

            <Button
              type="submit"
              className="w-full h-10 font-semibold text-white mt-4"
              disabled={isSubmitting}
              style={{ backgroundColor: '#b8860b' }}
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

            <div className="text-center pt-2">
              <span className="text-sm text-gray-500">¿Ya tienes cuenta? </span>
              <Link 
                to="/broker/login" 
                className="text-sm font-medium hover:underline"
                style={{ color: '#1a365d' }}
              >
                Iniciar sesión
              </Link>
            </div>
          </form>
        </div>

        <p className="text-center text-white/75 text-sm mt-6">
          © {new Date().getFullYear()} PlanMint
        </p>
      </div>
    </div>
  );
}
