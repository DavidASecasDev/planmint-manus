import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useTheme, ThemePreference } from '@/contexts/ThemeContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { 
  Loader2, User, Building2, Save, Monitor, Sun, Moon, Palette, 
  Settings as SettingsIcon, BarChart3, Bell, Plug,
  Shield, FileText, Users, Laptop, Download, Car
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { useOrganizationModules } from '@/hooks/useOrganizationModules';
import { TransferSettingsSection } from '@/components/transfers/TransferSettingsSection';
import { ProviderTemplateManager } from '@/components/transfers/ProviderTemplateManager';

import { UsageDashboard } from '@/components/analytics/UsageDashboard';
import { NotificationPreferencesSection } from '@/components/settings/NotificationPreferencesSection';
import { PushNotificationManager } from '@/components/notifications/PushNotificationManager';
import { IntegrationSettingsSection } from '@/components/settings/IntegrationSettingsSection';
import { SecuritySettingsSection } from '@/components/settings/SecuritySettingsSection';
import { AuditLogsSection } from '@/components/settings/AuditLogsSection';
import { RolesSection } from '@/components/settings/RolesSection';
import { SessionsSection } from '@/components/settings/SessionsSection';
import { DataExportSection } from '@/components/settings/DataExportSection';
import { ProfileAvatarUpload } from '@/components/settings/ProfileAvatarUpload';

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    value: 'system', 
    label: 'Sistema', 
    icon: <Monitor className="h-5 w-5" />,
    description: 'Sigue la configuración de tu dispositivo'
  },
  { 
    value: 'light', 
    label: 'Claro', 
    icon: <Sun className="h-5 w-5" />,
    description: 'Tema claro siempre activo'
  },
  { 
    value: 'dark', 
    label: 'Oscuro', 
    icon: <Moon className="h-5 w-5" />,
    description: 'Tema oscuro siempre activo'
  },
];

export default function Settings() {
  const { profile, organization, refreshProfile } = useAuth();
  const { isAdmin, isOwner, role } = usePermissions();
  const { theme, setTheme } = useTheme();
  const { isModuleEnabled } = useOrganizationModules();
  const [profileName, setProfileName] = useState(profile?.name || '');
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  
  const transfersEnabled = isModuleEnabled('transfers');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSavingProfile(true);

    const { error } = await supabase
      .from('profiles')
      .update({ name: profileName })
      .eq('id', profile.id);

    if (error) {
      toast({ title: 'Error', description: 'Error al actualizar el perfil', variant: 'destructive' });
    } else {
      await refreshProfile();
      toast({ title: 'Perfil actualizado', description: 'Tu nombre ha sido actualizado correctamente' });
    }
    setSavingProfile(false);
  };

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization || !isAdmin) return;
    setSavingOrg(true);

    const { error } = await supabase
      .from('organizations')
      .update({ name: orgName })
      .eq('id', organization.id);

    if (error) {
      toast({ title: 'Error', description: 'Error al actualizar la organización', variant: 'destructive' });
    } else {
      await refreshProfile();
      toast({ title: 'Organización actualizada', description: 'El nombre de la organización ha sido actualizado' });
    }
    setSavingOrg(false);
  };

  const handleThemeChange = async (value: string) => {
    await setTheme(value as ThemePreference);
    toast({ title: 'Tema actualizado', description: 'Tu preferencia de tema ha sido guardada' });
  };

  return (
    <AppLayout title="Ajustes">
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title="Ajustes"
          description="Gestiona tu perfil, apariencia y configuración de la organización."
          icon={SettingsIcon}
        />

        <div className="space-y-6">
          {/* Profile Settings */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <User className="h-5 w-5" />
                </div>
                Perfil
              </CardTitle>
              <CardDescription>Gestiona tu información personal</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile} className="space-y-5">
                <ProfileAvatarUpload />
                <div className="space-y-2">
                  <Label htmlFor="profileName">Nombre completo</Label>
                  <Input id="profileName" value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="Tu nombre" className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>Rol</Label>
                  <Input value={role === 'owner' ? 'Propietario' : role === 'admin' ? 'Administrador' : role === 'manager' ? 'Manager' : role === 'member' ? 'Miembro' : role || 'Miembro'} disabled className="bg-muted/50 h-11" />
                  <p className="text-xs text-muted-foreground">El rol es asignado por un administrador</p>
                </div>
                <Button type="submit" disabled={savingProfile} className="gap-2">
                  {savingProfile && <Loader2 className="h-4 w-4 animate-spin" />}
                  <Save className="h-4 w-4" />
                  Guardar Cambios
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Appearance Settings */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                  <Palette className="h-5 w-5" />
                </div>
                Apariencia
              </CardTitle>
              <CardDescription>Personaliza el aspecto de la aplicación</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label>Tema</Label>
                <RadioGroup value={theme} onValueChange={handleThemeChange} className="grid gap-3">
                  {THEME_OPTIONS.map((option) => (
                    <Label
                      key={option.value}
                      htmlFor={`theme-${option.value}`}
                      className={`flex items-center gap-4 rounded-xl border p-4 cursor-pointer transition-all duration-200 hover:bg-muted/50 ${
                        theme === option.value ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border/50'
                      }`}
                    >
                      <RadioGroupItem value={option.value} id={`theme-${option.value}`} className="sr-only" />
                      <div className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                        theme === option.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                      }`}>
                        {option.icon}
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold">{option.label}</p>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
                      </div>
                      {theme === option.value && <div className="h-2.5 w-2.5 rounded-full bg-primary" />}
                    </Label>
                  ))}
                </RadioGroup>
                <p className="text-xs text-muted-foreground mt-3">Tu elección se guardará y se aplicará automáticamente en todos tus dispositivos.</p>
              </div>
            </CardContent>
          </Card>

          {/* Organization Settings */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 text-green-500">
                  <Building2 className="h-5 w-5" />
                </div>
                Organización
              </CardTitle>
              <CardDescription>{isAdmin ? 'Gestiona la configuración de tu organización' : 'Información de tu organización'}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveOrg} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="orgName">Nombre de la organización</Label>
                  <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Nombre de la organización" disabled={!isAdmin} className={`h-11 ${!isAdmin ? 'bg-muted/50' : ''}`} />
                  {!isAdmin && <p className="text-xs text-muted-foreground">Solo los administradores pueden editar el nombre</p>}
                </div>
                {isAdmin && (
                  <Button type="submit" disabled={savingOrg} className="gap-2">
                    {savingOrg && <Loader2 className="h-4 w-4 animate-spin" />}
                    <Save className="h-4 w-4" />
                    Guardar Cambios
                  </Button>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Security Settings (Owner Only — no plan gate) */}
          {isOwner && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-500">
                    <Shield className="h-5 w-5" />
                  </div>
                  Seguridad
                </CardTitle>
                <CardDescription>Configura dominios permitidos y timeouts de sesión</CardDescription>
              </CardHeader>
              <CardContent>
                <SecuritySettingsSection />
              </CardContent>
            </Card>
          )}

          {/* Roles Management (Admin Only — no plan gate) */}
          {isAdmin && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500">
                    <Users className="h-5 w-5" />
                  </div>
                  Roles y Permisos
                </CardTitle>
                <CardDescription>Gestiona roles personalizados y permisos granulares</CardDescription>
              </CardHeader>
              <CardContent>
                <RolesSection />
              </CardContent>
            </Card>
          )}

          {/* Sessions Management (Admin Only — no plan gate) */}
          {isAdmin && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-500">
                    <Laptop className="h-5 w-5" />
                  </div>
                  Sesiones Activas
                </CardTitle>
                <CardDescription>Gestiona las sesiones activas de tu cuenta</CardDescription>
              </CardHeader>
              <CardContent>
                <SessionsSection />
              </CardContent>
            </Card>
          )}

          {/* Audit Logs (Admin Only — no plan gate, no day limit) */}
          {isAdmin && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-500/10 text-slate-500">
                    <FileText className="h-5 w-5" />
                  </div>
                  Registros de Auditoría
                </CardTitle>
                <CardDescription>Historial de actividad de tu organización</CardDescription>
              </CardHeader>
              <CardContent>
                <AuditLogsSection />
              </CardContent>
            </Card>
          )}

          {/* Data Export (Admin Only) */}
          {isAdmin && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                    <Download className="h-5 w-5" />
                  </div>
                  Exportación de Datos
                </CardTitle>
                <CardDescription>Exporta y gestiona los datos de tu organización</CardDescription>
              </CardHeader>
              <CardContent>
                <DataExportSection />
              </CardContent>
            </Card>
          )}

          {/* Notification Preferences */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-orange-500/10 text-orange-500">
                  <Bell className="h-5 w-5" />
                </div>
                Notificaciones
              </CardTitle>
              <CardDescription>Configura cómo y cuándo recibir notificaciones</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <PushNotificationManager />
              <NotificationPreferencesSection />
            </CardContent>
          </Card>

          {/* Integration Settings (Admin Only) */}
          {isAdmin && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-500">
                    <Plug className="h-5 w-5" />
                  </div>
                  Integraciones
                </CardTitle>
                <CardDescription>Configura Slack, Email y WhatsApp para tu organización</CardDescription>
              </CardHeader>
              <CardContent>
                <IntegrationSettingsSection />
              </CardContent>
            </Card>
          )}

          {/* Transfer Settings (Admin Only, Module Enabled) */}
          {isAdmin && transfersEnabled && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-500/10 text-teal-500">
                    <Car className="h-5 w-5" />
                  </div>
                  Transfers
                </CardTitle>
                <CardDescription>Gestiona los brokers y proveedores externos</CardDescription>
              </CardHeader>
              <CardContent>
                <TransferSettingsSection />
              </CardContent>
            </Card>
          )}

          {/* Provider Parsing Templates (Admin Only, Transfers Enabled) */}
          {isAdmin && transfersEnabled && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500">
                    <FileText className="h-5 w-5" />
                  </div>
                  Plantillas de Presupuesto
                </CardTitle>
                <CardDescription>Configura reglas de parsing por proveedor para mejorar la lectura automática de PDFs</CardDescription>
              </CardHeader>
              <CardContent>
                <ProviderTemplateManager />
              </CardContent>
            </Card>
          )}

          {/* Usage Analytics (Admin Only) */}
          {isAdmin && (
            <Card className="border-border/50 shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2.5 text-lg">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-500">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  Uso y Actividad
                </CardTitle>
                <CardDescription>Estadísticas de uso de tu organización</CardDescription>
              </CardHeader>
              <CardContent>
                <UsageDashboard />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
