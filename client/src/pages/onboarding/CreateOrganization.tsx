import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { Loader2, Building2, ArrowRight, Sparkles, Users, Briefcase, Truck, Mail, CheckCircle2, Clock, LogOut } from 'lucide-react';
import { z } from 'zod';
import { VERTICAL_PRESETS, VerticalPresetKey } from '@/lib/verticalPresets';

const orgSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
});

const PRESET_ICONS: Record<VerticalPresetKey, React.ReactNode> = {
  internal_teams: <Users className="h-5 w-5" />,
  agencies: <Briefcase className="h-5 w-5" />,
  operations: <Truck className="h-5 w-5" />,
};

interface PendingInvitation {
  id: string;
  organization_id: string;
  organization_name: string;
  role: string;
  expires_at: string | null;
  created_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  manager: 'Manager',
  member: 'Miembro',
  read_only: 'Solo lectura',
};

export default function CreateOrganization() {
  const { user, profile, loading: authLoading, profileLoading, refreshProfile, signOut } = useAuth();
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<VerticalPresetKey | null>(null);
  const [loading, setLoading] = useState(false);

  // Invitation detection state
  const [pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([]);
  const [checkingInvitations, setCheckingInvitations] = useState(true);
  const [acceptingInvitation, setAcceptingInvitation] = useState<string | null>(null);

  // Check for pending invitations on mount
  useEffect(() => {
    if (!user) return;
    
    apiInvoke<PendingInvitation[]>('get-my-pending-invitations').then(({ data, error }) => {
      if (!error && data && Array.isArray(data) && data.length > 0) {
        setPendingInvitations(data);
      }
      setCheckingInvitations(false);
    });
  }, [user]);

  // Wait for all loading states
  if (authLoading || profileLoading || superAdminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  if (profile?.organization_id) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleAcceptInvitation = async (invitation: PendingInvitation) => {
    setAcceptingInvitation(invitation.id);

    const { data, error } = await apiInvoke<{ success: boolean; error?: string; organization_name?: string }>('accept-my-pending-invitation', {
      body: { p_invitation_id: invitation.id },
    });

    if (error || !data?.success) {
      const errCode = data?.error || 'unknown';
      const messages: Record<string, string> = {
        email_mismatch: 'Tu email no coincide con la invitación.',
        invitation_expired: 'La invitación ha expirado. Pide al administrador que envíe una nueva.',
        invitation_revoked: 'La invitación fue revocada.',
        invitation_already_accepted: 'Esta invitación ya fue aceptada.',
      };
      toast({
        title: 'Error',
        description: messages[errCode] || 'No se pudo aceptar la invitación.',
        variant: 'destructive',
      });
      setAcceptingInvitation(null);
      return;
    }

    await refreshProfile();

    toast({
      title: '¡Bienvenido!',
      description: `Te has unido a ${data?.organization_name}`,
    });

    navigate('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Double-check: only superadmin can create organizations
    if (!isSuperAdmin) {
      toast({
        title: 'Sin permisos',
        description: 'Solo el administrador de la plataforma puede crear organizaciones.',
        variant: 'destructive',
      });
      return;
    }

    const validation = orgSchema.safeParse({ name });
    if (!validation.success) {
      toast({
        title: 'Error de validación',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    const { data: newOrgId, error: rpcError } = await supabase.rpc('create_organization_with_owner', {
      p_name: name,
      p_vertical_preset: selectedPreset || undefined,
    });

    if (rpcError) {
      console.error('Error creating organization:', rpcError);
      const msg = rpcError.message || '';
      if (msg.includes('INVALID_SESSION') || msg.includes('NOT_AUTHENTICATED')) {
        toast({ title: 'Sesión inválida', description: 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.', variant: 'destructive' });
        await signOut();
      } else if (msg.includes('ALREADY_HAS_ORG')) {
        toast({ title: 'Ya tienes organización', description: 'Ya perteneces a una organización.', variant: 'destructive' });
        await refreshProfile();
        navigate('/dashboard');
      } else {
        toast({ title: 'Error', description: 'Error al crear la organización. Intenta de nuevo.', variant: 'destructive' });
      }
      setLoading(false);
      return;
    }

    await refreshProfile();
    toast({ title: '¡Organización creada!', description: `${name} ha sido creada exitosamente` });
    navigate('/dashboard');
  };

  // Still checking invitations
  if (checkingInvitations) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // ─── Show pending invitations UI (for all users) ───
  if (pendingInvitations.length > 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <div className="w-full max-w-lg animate-in">
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="space-y-1 text-center pb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                <Mail className="h-7 w-7 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">
                {pendingInvitations.length === 1 ? 'Invitación pendiente' : 'Invitaciones pendientes'}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Has sido invitado a unirte a una organización
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingInvitations.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{inv.organization_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Rol: {ROLE_LABELS[inv.role] || inv.role}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 gap-1.5"
                    disabled={acceptingInvitation !== null}
                    onClick={() => handleAcceptInvitation(inv)}
                  >
                    {acceptingInvitation === inv.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        Aceptar
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </CardContent>
            {isSuperAdmin && (
              <CardFooter className="flex-col gap-3 pt-2">
                <div className="relative w-full">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">o</span>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={() => navigate('/onboarding/create-organization?force=1')}
                >
                  Crear nueva organización (Superadmin)
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    );
  }

  // ─── Superadmin: show create organization form ───
  if (isSuperAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
        <div className="w-full max-w-lg animate-in">
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="space-y-1 text-center pb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                <Building2 className="h-7 w-7 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl font-bold tracking-tight">Crear Organización</CardTitle>
              <CardDescription className="text-muted-foreground">
                Crea una nueva organización para gestionar equipos
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-sm font-medium">Nombre de la organización</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Mi Empresa"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-11"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium">¿Qué tipo de organización? (opcional)</Label>
                  <RadioGroup
                    value={selectedPreset || ''}
                    onValueChange={(value) => setSelectedPreset(value as VerticalPresetKey || null)}
                    className="grid gap-3"
                  >
                    {Object.values(VERTICAL_PRESETS).map((preset) => (
                      <div key={preset.key}>
                        <RadioGroupItem
                          value={preset.key}
                          id={preset.key}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={preset.key}
                          className="flex items-start gap-3 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                        >
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-primary">
                            {PRESET_ICONS[preset.key]}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{preset.name}</p>
                            <p className="text-sm text-muted-foreground">{preset.description}</p>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground">
                    Selecciona una plantilla para activar los módulos recomendados. Puedes cambiar esto después.
                  </p>
                </div>

                <div className="rounded-xl bg-primary/5 border border-primary/10 p-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-sm">
                      <p className="font-medium text-foreground">Serás administrador</p>
                      <p className="text-muted-foreground mt-0.5">
                        Tendrás acceso completo para gestionar el equipo, áreas, tareas y configuración.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex-col gap-3 pt-2">
                <Button type="submit" className="w-full h-11 gap-2" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Crear Organización
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Regular user without organization and no pending invitations ───
  // Show a "waiting" page - they need to be invited by an admin
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="w-full max-w-lg animate-in">
        <Card className="border-border/50 shadow-xl">
          <CardHeader className="space-y-1 text-center pb-6">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-amber-600 shadow-lg">
              <Clock className="h-7 w-7 text-white" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Esperando invitación</CardTitle>
            <CardDescription className="text-muted-foreground">
              Tu cuenta ha sido creada correctamente, pero aún no perteneces a ninguna organización.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted/50 border border-border p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">¿Cómo acceder?</p>
                  <p className="text-muted-foreground mt-1">
                    Un administrador debe invitarte a su organización. Contacta con tu administrador para que te envíe una invitación.
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-xl bg-muted/50 border border-border p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                </div>
                <div className="text-sm">
                  <p className="font-medium text-foreground">¿Ya tienes una invitación?</p>
                  <p className="text-muted-foreground mt-1">
                    Revisa tu email y haz clic en el enlace de invitación para unirte automáticamente.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3 pt-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => {
                // Refresh to check if an invitation has been accepted or profile updated
                refreshProfile().then(() => {
                  if (profile?.organization_id) {
                    navigate('/dashboard');
                  } else {
                    // Re-check pending invitations
                    apiInvoke<PendingInvitation[]>('get-my-pending-invitations').then(({ data }) => {
                      if (data && Array.isArray(data) && data.length > 0) {
                        setPendingInvitations(data);
                      } else {
                        toast({
                          title: 'Sin invitaciones',
                          description: 'Aún no tienes invitaciones pendientes. Contacta con tu administrador.',
                        });
                      }
                    });
                  }
                });
              }}
            >
              <CheckCircle2 className="h-4 w-4" />
              Comprobar invitaciones
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground gap-2"
              onClick={() => signOut()}
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
