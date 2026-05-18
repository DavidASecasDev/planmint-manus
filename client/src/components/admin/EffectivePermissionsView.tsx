/**
 * EffectivePermissionsView — Admin panel tab that shows the final computed
 * permissions for every member, after applying:
 *   1. System role defaults (from role_permissions table)
 *   2. Custom role permissions_json (if role is custom:xxx)
 *   3. User-specific overrides (from user_permissions table — highest priority)
 *
 * Colour legend:
 *   - Green badge  = permission granted
 *   - Red badge    = permission denied
 *   - Blue ring    = value comes from a user override (not inherited)
 */
import { useState, useMemo } from 'react';
import { useOrganizationMembers, useRolePermissions, useUserPermissionOverrides, OrgRole } from '@/hooks/usePermissions';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { PERMISSION_CATEGORIES, type PermissionCategory } from '@/lib/permissionDefinitions';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Search, Eye, ShieldCheck, ShieldX, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';

const SYSTEM_ROLES = ['owner', 'admin', 'manager', 'member', 'read_only'];

const systemRoleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  manager: 'Manager',
  member: 'Miembro',
  read_only: 'Solo lectura',
};

// ─── Helper: flatten custom role permissions_json ────────────────────────────
// Mirrors the logic in MemberPermissionsEditor.tsx mapCustomRoleToFlatPermissions
function mapCustomRoleToFlatPermissions(pj: Record<string, any>): Record<string, boolean> {
  const flat: Record<string, boolean> = {};

  // Tasks
  flat['tasks.view'] = pj?.tasks?.view ?? false;
  flat['tasks.create'] = pj?.tasks?.create ?? false;
  flat['tasks.update'] = pj?.tasks?.update ?? false;
  flat['tasks.delete'] = pj?.tasks?.delete ?? false;
  flat['tasks.assign'] = pj?.tasks?.update ?? false;
  flat['tasks.change_status'] = pj?.tasks?.change_status ?? pj?.tasks?.update ?? false;
  flat['tasks.manage_columns'] = pj?.tasks?.manage_columns ?? pj?.tasks?.delete ?? false;
  // Areas
  flat['areas.view'] = pj?.areas?.view ?? false;
  flat['areas.create'] = pj?.areas?.manage ?? false;
  flat['areas.update'] = pj?.areas?.manage ?? false;
  flat['areas.delete'] = pj?.areas?.manage ?? false;
  flat['areas.manage_visibility'] = pj?.areas?.manage ?? false;
  flat['areas.manage_access_rules'] = pj?.areas?.manage_access_rules ?? pj?.areas?.manage ?? false;
  // Tags
  flat['tags.view'] = pj?.tags?.view ?? false;
  flat['tags.create'] = pj?.tags?.create ?? false;
  flat['tags.update'] = pj?.tags?.manage ?? false;
  flat['tags.delete'] = pj?.tags?.manage ?? false;
  flat['tags.manage'] = pj?.tags?.manage ?? false;
  // Templates
  flat['templates.view'] = pj?.templates?.view ?? pj?.templates?.read ?? false;
  flat['templates.apply'] = pj?.templates?.read ?? false;
  flat['templates.create'] = pj?.templates?.manage ?? false;
  flat['templates.delete'] = pj?.templates?.manage ?? false;
  // Teams
  flat['teams.view'] = pj?.team?.read ?? false;
  // Automations
  flat['automations.view'] = pj?.automations?.view ?? pj?.automations?.read ?? false;
  flat['automations.create'] = pj?.automations?.manage ?? false;
  flat['automations.manage'] = pj?.automations?.manage ?? false;
  // Reports
  flat['reports.view'] = pj?.reports?.view ?? false;
  flat['reports.export'] = pj?.reports?.export ?? pj?.reports?.view ?? false;
  flat['reports.view_financial'] = pj?.reports?.view_financial ?? pj?.reports?.view ?? false;
  // Billing
  flat['billing.view'] = pj?.billing?.view ?? pj?.billing?.read ?? false;
  flat['billing.manage'] = pj?.billing?.manage ?? false;
  // Members
  flat['members.view'] = pj?.team?.read ?? false;
  flat['members.invite'] = pj?.team?.manage ?? false;
  flat['members.change_role'] = pj?.team?.manage ?? false;
  flat['members.manage_permissions'] = pj?.team?.manage ?? false;
  flat['members.suspend'] = pj?.team?.suspend ?? pj?.team?.manage ?? false;
  // Security
  flat['security.view_audit_logs'] = pj?.audit_logs?.read ?? false;
  flat['integrations.manage_api_keys'] = pj?.integrations?.manage ?? false;
  // Reservations
  flat['reservations.view'] = pj?.reservations?.view ?? false;
  flat['reservations.create'] = pj?.reservations?.create ?? false;
  flat['reservations.manage'] = pj?.reservations?.manage ?? false;
  // Garatech
  flat['garatech.view'] = pj?.garatech?.view ?? false;
  flat['garatech.create'] = pj?.garatech?.create ?? pj?.garatech?.manage ?? false;
  flat['garatech.update'] = pj?.garatech?.update ?? pj?.garatech?.manage ?? false;
  flat['garatech.change_status'] = pj?.garatech?.change_status ?? pj?.garatech?.manage ?? false;
  flat['garatech.edit_dates'] = pj?.garatech?.edit_dates ?? false;
  flat['garatech.manage_catalog'] = pj?.garatech?.manage_catalog ?? pj?.garatech?.manage ?? false;
  flat['garatech.manage_accidents'] = pj?.garatech?.manage_accidents ?? pj?.garatech?.manage ?? false;
  flat['garatech.manage'] = pj?.garatech?.manage ?? false;
  // Transfers
  flat['transfers.view'] = pj?.transfers?.view ?? false;
  flat['transfers.create'] = pj?.transfers?.create ?? pj?.transfers?.manage ?? false;
  flat['transfers.update'] = pj?.transfers?.update ?? pj?.transfers?.manage ?? false;
  flat['transfers.change_status'] = pj?.transfers?.change_status ?? pj?.transfers?.manage ?? false;
  flat['transfers.delete'] = pj?.transfers?.delete ?? false;
  flat['transfers.manage_pricing'] = pj?.transfers?.manage_pricing ?? pj?.transfers?.manage ?? false;
  flat['transfers.manage_brokers'] = pj?.transfers?.manage_brokers ?? pj?.transfers?.manage ?? false;
  flat['transfers.manage'] = pj?.transfers?.manage ?? false;
  // Forms
  flat['forms.view'] = pj?.forms?.view ?? false;
  flat['forms.create'] = pj?.forms?.create ?? false;
  flat['forms.update'] = pj?.forms?.update ?? pj?.forms?.manage ?? false;
  flat['forms.delete'] = pj?.forms?.delete ?? pj?.forms?.manage ?? false;
  flat['forms.view_responses'] = pj?.forms?.view_responses ?? pj?.forms?.view ?? false;
  flat['forms.manage'] = pj?.forms?.manage ?? false;
  // Vehicles
  flat['vehicles.view'] = pj?.vehicles?.view ?? false;
  flat['vehicles.create'] = pj?.vehicles?.create ?? pj?.vehicles?.manage ?? false;
  flat['vehicles.update'] = pj?.vehicles?.update ?? pj?.vehicles?.manage ?? false;
  flat['vehicles.archive'] = pj?.vehicles?.archive ?? pj?.vehicles?.manage ?? false;
  flat['vehicles.manage_daily_tasks'] = pj?.vehicles?.manage_daily_tasks ?? pj?.vehicles?.manage ?? false;
  flat['vehicles.change_status'] = pj?.vehicles?.change_status ?? false;
  flat['vehicles.complete_tasks'] = pj?.vehicles?.complete_tasks ?? false;
  flat['vehicles.manage_locations'] = pj?.vehicles?.manage_locations ?? pj?.vehicles?.manage ?? false;
  flat['vehicles.sync'] = pj?.vehicles?.sync ?? pj?.vehicles?.manage ?? false;
  flat['vehicles.import'] = pj?.vehicles?.import ?? pj?.vehicles?.manage ?? false;
  flat['vehicles.manage'] = pj?.vehicles?.manage ?? false;
  // Time Tracking
  flat['time_tracking.view'] = pj?.time_tracking?.view ?? false;
  flat['time_tracking.view_team'] = pj?.time_tracking?.view_team ?? pj?.time_tracking?.manage ?? false;
  flat['time_tracking.create'] = pj?.time_tracking?.create ?? pj?.time_tracking?.view ?? false;
  flat['time_tracking.manage'] = pj?.time_tracking?.manage ?? false;
  // Movements
  flat['movements.view'] = pj?.movements?.view ?? false;
  flat['movements.create'] = pj?.movements?.create ?? false;
  flat['movements.manage'] = pj?.movements?.manage ?? false;
  flat['movements.delete'] = pj?.movements?.delete ?? pj?.movements?.manage ?? false;
  flat['movements.edit_photos'] = pj?.movements?.edit_photos ?? pj?.movements?.manage ?? false;
  flat['movements.upload_receipt'] = pj?.movements?.upload_receipt ?? pj?.movements?.manage ?? false;
  // Daily Tasks
  flat['daily_tasks.view'] = pj?.daily_tasks?.view ?? false;
  flat['daily_tasks.view_other_days'] = pj?.daily_tasks?.view_other_days ?? pj?.daily_tasks?.manage ?? false;
  flat['daily_tasks.complete'] = pj?.daily_tasks?.complete ?? false;
  flat['daily_tasks.manage'] = pj?.daily_tasks?.manage ?? false;
  // Fleet
  flat['fleet.view'] = pj?.fleet?.view ?? false;
  flat['fleet.manage'] = pj?.fleet?.manage ?? false;
  flat['fleet.import'] = pj?.fleet?.import ?? pj?.fleet?.manage ?? false;
  // Schedules (Horarios)
  flat['schedules.view'] = pj?.schedules?.view ?? false;
  flat['schedules.assign'] = pj?.schedules?.assign ?? pj?.schedules?.manage ?? false;
  flat['schedules.manage_templates'] = pj?.schedules?.manage_templates ?? pj?.schedules?.manage ?? false;
  flat['schedules.view_directiva'] = pj?.schedules?.view_directiva ?? pj?.schedules?.manage ?? false;
  flat['schedules.manage_notes'] = pj?.schedules?.manage_notes ?? pj?.schedules?.manage ?? false;
  flat['schedules.manage'] = pj?.schedules?.manage ?? false;

  return flat;
}

// ─── Types ───────────────────────────────────────────────────────────────────
interface EffectivePermission {
  key: string;
  granted: boolean;
  source: 'role' | 'custom_role' | 'override';
  overrideValue?: boolean;
  roleDefault: boolean;
}

interface MemberEffective {
  userId: string;
  name: string;
  role: string;
  roleName: string;
  overrideCount: number;
  permissions: Record<string, EffectivePermission>;
  grantedCount: number;
  totalCount: number;
}

// ─── Component ───────────────────────────────────────────────────────────────
export function EffectivePermissionsView() {
  const { profile, organization } = useAuth();
  const organizationId = organization?.id || profile?.organization_id;
  const { members, isLoading: membersLoading } = useOrganizationMembers();
  const { getDefaultsForRole, isLoading: roleLoading } = useRolePermissions();
  const { roles: customRoles, isLoading: customRolesLoading } = useCustomRoles();

  const [selectedMemberId, setSelectedMemberId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Fetch all user_permissions for the org via backend (bypasses RLS)
  const { data: allOverrides = [], isLoading: overridesLoading } = useQuery({
    queryKey: ['all-user-permissions', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const result = await apiInvoke<{ data: any[]; error: string | null }>('get-user-permission-overrides', {
        body: { p_organization_id: organizationId },
      });
      if (result.error || !result.data) {
        console.error('Error fetching all user permissions:', result.error?.message);
        return [];
      }
      return result.data.data || [];
    },
    enabled: !!organizationId,
    staleTime: 60 * 1000,
  });

  // All permission keys from the definitions
  const allPermissionKeys = useMemo(() =>
    PERMISSION_CATEGORIES.flatMap(cat => cat.permissions.map(p => p.key)),
    []
  );

  // Compute effective permissions for each member
  const memberEffectives: MemberEffective[] = useMemo(() => {
    if (!members.length) return [];

    return members
      .filter(m => m.status === 'active')
      .map(member => {
        const role = member.role;
        const isCustomRole = role.startsWith('custom:') || !SYSTEM_ROLES.includes(role);
        const isOwner = role === 'owner';

        // Get role defaults
        let roleDefaults: Record<string, boolean>;
        if (isCustomRole) {
          const customRoleId = role.startsWith('custom:') ? role.replace('custom:', '') : role;
          const cr = customRoles?.find(r => r.id === customRoleId);
          roleDefaults = cr
            ? mapCustomRoleToFlatPermissions(cr.permissions_json as Record<string, any>)
            : {};
        } else {
          roleDefaults = getDefaultsForRole(role as OrgRole);
        }

        // Get user overrides
        const userOverrides = allOverrides.filter(o => o.user_id === member.user_id);
        const overrideMap = new Map(userOverrides.map(o => [o.permission_key, o.enabled]));

        // Compute effective for each key
        const permissions: Record<string, EffectivePermission> = {};
        let grantedCount = 0;

        for (const key of allPermissionKeys) {
          const roleDefault = isOwner ? true : (roleDefaults[key] ?? false);
          let granted = roleDefault;
          let source: 'role' | 'custom_role' | 'override' = isCustomRole ? 'custom_role' : 'role';

          if (overrideMap.has(key)) {
            granted = overrideMap.get(key)!;
            source = 'override';
          }

          if (isOwner) {
            granted = true;
            source = 'role';
          }

          if (granted) grantedCount++;

          permissions[key] = {
            key,
            granted,
            source,
            overrideValue: overrideMap.has(key) ? overrideMap.get(key) : undefined,
            roleDefault,
          };
        }

        // Role display name
        let roleName = systemRoleLabels[role] || role;
        if (isCustomRole) {
          const customRoleId = role.startsWith('custom:') ? role.replace('custom:', '') : role;
          const cr = customRoles?.find(r => r.id === customRoleId);
          roleName = cr ? cr.name : role;
        }

        return {
          userId: member.user_id,
          name: member.profile?.name || 'Sin nombre',
          role,
          roleName,
          overrideCount: userOverrides.length,
          permissions,
          grantedCount,
          totalCount: allPermissionKeys.length,
        };
      });
  }, [members, customRoles, getDefaultsForRole, allOverrides, allPermissionKeys]);

  const isLoading = membersLoading || roleLoading || customRolesLoading || overridesLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Filter categories
  const filteredCategories = PERMISSION_CATEGORIES.filter(cat => {
    if (categoryFilter !== 'all' && cat.id !== categoryFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      cat.label.toLowerCase().includes(q) ||
      cat.permissions.some(p =>
        p.label.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.key.toLowerCase().includes(q)
      )
    );
  });

  // Filter members
  const filteredMembers = selectedMemberId === 'all'
    ? memberEffectives
    : memberEffectives.filter(m => m.userId === selectedMemberId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Permisos efectivos
        </CardTitle>
        <CardDescription>
          Vista consolidada de los permisos finales de cada miembro, después de aplicar: rol base, rol personalizado y overrides individuales. Los overrides siempre tienen prioridad.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
            <SelectTrigger className="w-full sm:w-[250px]">
              <SelectValue placeholder="Seleccionar miembro" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los miembros</SelectItem>
              {memberEffectives.map(m => (
                <SelectItem key={m.userId} value={m.userId}>
                  {m.name} ({m.roleName})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Módulo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los módulos</SelectItem>
              {PERMISSION_CATEGORIES.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar permisos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground border rounded-lg p-3 bg-muted/30">
          <div className="flex items-center gap-1.5">
            <Badge className="bg-emerald-500/90 text-white text-xs px-1.5">✓</Badge>
            <span>Concedido</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-muted-foreground text-xs px-1.5">✗</Badge>
            <span>Denegado</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-3 rounded-full border-2 border-blue-500" />
            <span>Override individual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            <span>Hover para ver detalles</span>
          </div>
        </div>

        {/* Summary cards */}
        {selectedMemberId === 'all' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {memberEffectives.map(m => (
              <button
                key={m.userId}
                onClick={() => setSelectedMemberId(m.userId)}
                className="text-left p-3 rounded-lg border hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <p className="font-medium text-sm truncate">{m.name}</p>
                <p className="text-xs text-muted-foreground">{m.roleName}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {m.grantedCount}/{m.totalCount}
                  </Badge>
                  {m.overrideCount > 0 && (
                    <Badge className="bg-blue-500/90 text-white text-xs">
                      {m.overrideCount} overrides
                    </Badge>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Detailed permission table */}
        {filteredMembers.length > 0 && (selectedMemberId !== 'all' || filteredMembers.length <= 6) && (
          <TooltipProvider delayDuration={200}>
            <Accordion
              type="multiple"
              defaultValue={filteredCategories.map(c => c.id)}
              className="space-y-2"
            >
              {filteredCategories.map(category => {
                const Icon = category.icon;
                const visiblePermissions = category.permissions.filter(p => {
                  if (!searchQuery) return true;
                  const q = searchQuery.toLowerCase();
                  return (
                    p.label.toLowerCase().includes(q) ||
                    p.description.toLowerCase().includes(q) ||
                    p.key.toLowerCase().includes(q)
                  );
                });

                if (visiblePermissions.length === 0) return null;

                return (
                  <AccordionItem key={category.id} value={category.id} className="border rounded-lg px-2">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-3">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{category.label}</span>
                        <Badge variant="outline" className="text-xs font-normal">
                          {visiblePermissions.length} permisos
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="min-w-[200px]">Permiso</TableHead>
                              {filteredMembers.map(m => (
                                <TableHead key={m.userId} className="text-center min-w-[100px]">
                                  <div className="flex flex-col items-center gap-0.5">
                                    <span className="text-xs font-medium truncate max-w-[90px]">{m.name}</span>
                                    <span className="text-[10px] text-muted-foreground">{m.roleName}</span>
                                  </div>
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {visiblePermissions.map(perm => (
                              <TableRow key={perm.key}>
                                <TableCell>
                                  <div>
                                    <span className="text-sm font-medium">{perm.label}</span>
                                    <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                                  </div>
                                </TableCell>
                                {filteredMembers.map(m => {
                                  const ep = m.permissions[perm.key];
                                  if (!ep) return <TableCell key={m.userId} className="text-center">-</TableCell>;

                                  const isOverride = ep.source === 'override';
                                  const tooltipText = isOverride
                                    ? `Override individual: ${ep.granted ? 'concedido' : 'denegado'} (rol: ${ep.roleDefault ? 'sí' : 'no'})`
                                    : ep.source === 'custom_role'
                                      ? `Heredado del rol personalizado "${m.roleName}"`
                                      : `Heredado del rol "${m.roleName}"`;

                                  return (
                                    <TableCell key={m.userId} className="text-center">
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <span className={`inline-flex items-center justify-center ${isOverride ? 'ring-2 ring-blue-500 ring-offset-1 rounded-md' : ''}`}>
                                            {ep.granted ? (
                                              <Badge className="bg-emerald-500/90 text-white text-xs px-1.5">
                                                <ShieldCheck className="h-3 w-3" />
                                              </Badge>
                                            ) : (
                                              <Badge variant="outline" className="text-muted-foreground text-xs px-1.5">
                                                <ShieldX className="h-3 w-3" />
                                              </Badge>
                                            )}
                                          </span>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="max-w-xs">
                                          <p className="text-xs">{tooltipText}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TableCell>
                                  );
                                })}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </TooltipProvider>
        )}

        {filteredMembers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No hay miembros activos para mostrar.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
