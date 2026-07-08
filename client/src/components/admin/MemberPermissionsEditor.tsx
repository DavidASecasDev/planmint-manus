import { useState, useMemo } from 'react';
import { useUserPermissionOverrides, useRolePermissions, OrgRole, PermissionKey } from '@/hooks/usePermissions';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, RotateCcw, Search } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { PERMISSION_CATEGORIES } from '@/lib/permissionDefinitions';

interface MemberPermissionsEditorProps {
  userId: string;
  memberRole: OrgRole | string;
}

const SYSTEM_ROLES = ['owner', 'admin', 'manager', 'member', 'read_only'];

// Helper to map custom role permissions_json to flat permission format
// Maps the nested structure (e.g. { tasks: { create: true } }) to flat keys (e.g. 'tasks.create')
function mapCustomRoleToFlatPermissions(permissionsJson: Record<string, any>): Record<string, boolean> {
  const flat: Record<string, boolean> = {};

  // Tasks
  flat['tasks.view'] = permissionsJson?.tasks?.view ?? false;
  flat['tasks.create'] = permissionsJson?.tasks?.create ?? false;
  flat['tasks.update'] = permissionsJson?.tasks?.update ?? false;
  flat['tasks.delete'] = permissionsJson?.tasks?.delete ?? false;
  flat['tasks.assign'] = permissionsJson?.tasks?.update ?? false;
  flat['tasks.change_status'] = permissionsJson?.tasks?.change_status ?? permissionsJson?.tasks?.update ?? false;
  flat['tasks.manage_columns'] = permissionsJson?.tasks?.manage_columns ?? permissionsJson?.tasks?.delete ?? false;
  // Areas
  flat['areas.view'] = permissionsJson?.areas?.view ?? false;
  flat['areas.create'] = permissionsJson?.areas?.manage ?? false;
  flat['areas.update'] = permissionsJson?.areas?.manage ?? false;
  flat['areas.delete'] = permissionsJson?.areas?.manage ?? false;
  flat['areas.manage_visibility'] = permissionsJson?.areas?.manage ?? false;
  flat['areas.manage_access_rules'] = permissionsJson?.areas?.manage_access_rules ?? permissionsJson?.areas?.manage ?? false;
  // Tags
  flat['tags.view'] = permissionsJson?.tags?.view ?? false;
  flat['tags.create'] = permissionsJson?.tags?.create ?? false;
  flat['tags.update'] = permissionsJson?.tags?.manage ?? false;
  flat['tags.delete'] = permissionsJson?.tags?.manage ?? false;
  flat['tags.manage'] = permissionsJson?.tags?.manage ?? false;
  // Templates
  flat['templates.view'] = permissionsJson?.templates?.view ?? permissionsJson?.templates?.read ?? false;
  flat['templates.apply'] = permissionsJson?.templates?.read ?? false;
  flat['templates.create'] = permissionsJson?.templates?.manage ?? false;
  flat['templates.delete'] = permissionsJson?.templates?.manage ?? false;
  // Teams
  flat['teams.view'] = permissionsJson?.team?.read ?? false;
  // Automations
  flat['automations.view'] = permissionsJson?.automations?.view ?? permissionsJson?.automations?.read ?? false;
  flat['automations.create'] = permissionsJson?.automations?.manage ?? false;
  flat['automations.manage'] = permissionsJson?.automations?.manage ?? false;
  // Reports
  flat['reports.view'] = permissionsJson?.reports?.view ?? false;
  flat['reports.export'] = permissionsJson?.reports?.export ?? permissionsJson?.reports?.view ?? false;
  flat['reports.view_financial'] = permissionsJson?.reports?.view_financial ?? permissionsJson?.reports?.view ?? false;
  // Billing
  flat['billing.view'] = permissionsJson?.billing?.view ?? permissionsJson?.billing?.read ?? false;
  flat['billing.manage'] = permissionsJson?.billing?.manage ?? false;
  // Members
  flat['members.view'] = permissionsJson?.team?.read ?? false;
  flat['members.invite'] = permissionsJson?.team?.manage ?? false;
  flat['members.change_role'] = permissionsJson?.team?.manage ?? false;
  flat['members.manage_permissions'] = permissionsJson?.team?.manage ?? false;
  flat['members.suspend'] = permissionsJson?.team?.suspend ?? permissionsJson?.team?.manage ?? false;
  // Security
  flat['security.view_audit_logs'] = permissionsJson?.audit_logs?.read ?? false;
  flat['integrations.manage_api_keys'] = permissionsJson?.integrations?.manage ?? false;
  // Reservations
  flat['reservations.view'] = permissionsJson?.reservations?.view ?? false;
  flat['reservations.create'] = permissionsJson?.reservations?.create ?? false;
  flat['reservations.manage'] = permissionsJson?.reservations?.manage ?? false;
  // Garatech
  flat['garatech.view'] = permissionsJson?.garatech?.view ?? false;
  flat['garatech.create'] = permissionsJson?.garatech?.create ?? permissionsJson?.garatech?.manage ?? false;
  flat['garatech.update'] = permissionsJson?.garatech?.update ?? permissionsJson?.garatech?.manage ?? false;
  flat['garatech.change_status'] = permissionsJson?.garatech?.change_status ?? permissionsJson?.garatech?.manage ?? false;
  flat['garatech.edit_dates'] = permissionsJson?.garatech?.edit_dates ?? false;
  flat['garatech.manage_catalog'] = permissionsJson?.garatech?.manage_catalog ?? permissionsJson?.garatech?.manage ?? false;
  flat['garatech.manage_accidents'] = permissionsJson?.garatech?.manage_accidents ?? permissionsJson?.garatech?.manage ?? false;
  flat['garatech.manage'] = permissionsJson?.garatech?.manage ?? false;
  // Transfers
  flat['transfers.view'] = permissionsJson?.transfers?.view ?? false;
  flat['transfers.create'] = permissionsJson?.transfers?.create ?? permissionsJson?.transfers?.manage ?? false;
  flat['transfers.update'] = permissionsJson?.transfers?.update ?? permissionsJson?.transfers?.manage ?? false;
  flat['transfers.change_status'] = permissionsJson?.transfers?.change_status ?? permissionsJson?.transfers?.manage ?? false;
  flat['transfers.delete'] = permissionsJson?.transfers?.delete ?? false;
  flat['transfers.manage_brokers'] = permissionsJson?.transfers?.manage_brokers ?? permissionsJson?.transfers?.manage ?? false;
  flat['transfers.manage'] = permissionsJson?.transfers?.manage ?? false;
  // Forms
  flat['forms.view'] = permissionsJson?.forms?.view ?? false;
  flat['forms.create'] = permissionsJson?.forms?.create ?? false;
  flat['forms.update'] = permissionsJson?.forms?.update ?? permissionsJson?.forms?.manage ?? false;
  flat['forms.delete'] = permissionsJson?.forms?.delete ?? permissionsJson?.forms?.manage ?? false;
  flat['forms.view_responses'] = permissionsJson?.forms?.view_responses ?? permissionsJson?.forms?.view ?? false;
  flat['forms.manage'] = permissionsJson?.forms?.manage ?? false;
  // Vehicles
  flat['vehicles.view'] = permissionsJson?.vehicles?.view ?? false;
  flat['vehicles.create'] = permissionsJson?.vehicles?.create ?? permissionsJson?.vehicles?.manage ?? false;
  flat['vehicles.update'] = permissionsJson?.vehicles?.update ?? permissionsJson?.vehicles?.manage ?? false;
  flat['vehicles.archive'] = permissionsJson?.vehicles?.archive ?? permissionsJson?.vehicles?.manage ?? false;
  flat['vehicles.manage_daily_tasks'] = permissionsJson?.vehicles?.manage_daily_tasks ?? permissionsJson?.vehicles?.manage ?? false;
  flat['vehicles.change_status'] = permissionsJson?.vehicles?.change_status ?? false;
  flat['vehicles.complete_tasks'] = permissionsJson?.vehicles?.complete_tasks ?? false;
  flat['vehicles.manage_locations'] = permissionsJson?.vehicles?.manage_locations ?? permissionsJson?.vehicles?.manage ?? false;
  flat['vehicles.sync'] = permissionsJson?.vehicles?.sync ?? permissionsJson?.vehicles?.manage ?? false;
  flat['vehicles.import'] = permissionsJson?.vehicles?.import ?? permissionsJson?.vehicles?.manage ?? false;
  flat['vehicles.manage'] = permissionsJson?.vehicles?.manage ?? false;
  // Time Tracking
  flat['time_tracking.view'] = permissionsJson?.time_tracking?.view ?? false;
  flat['time_tracking.view_team'] = permissionsJson?.time_tracking?.view_team ?? permissionsJson?.time_tracking?.manage ?? false;
  flat['time_tracking.create'] = permissionsJson?.time_tracking?.create ?? permissionsJson?.time_tracking?.view ?? false;
  flat['time_tracking.manage'] = permissionsJson?.time_tracking?.manage ?? false;
  // Movements
  flat['movements.view'] = permissionsJson?.movements?.view ?? false;
  flat['movements.create'] = permissionsJson?.movements?.create ?? false;
  flat['movements.manage'] = permissionsJson?.movements?.manage ?? false;
  flat['movements.delete'] = permissionsJson?.movements?.delete ?? permissionsJson?.movements?.manage ?? false;
  flat['movements.edit_photos'] = permissionsJson?.movements?.edit_photos ?? permissionsJson?.movements?.manage ?? false;
  flat['movements.upload_receipt'] = permissionsJson?.movements?.upload_receipt ?? permissionsJson?.movements?.manage ?? false;
  // Daily Tasks
  flat['daily_tasks.view'] = permissionsJson?.daily_tasks?.view ?? false;
  flat['daily_tasks.view_other_days'] = permissionsJson?.daily_tasks?.view_other_days ?? permissionsJson?.daily_tasks?.manage ?? false;
  flat['daily_tasks.complete'] = permissionsJson?.daily_tasks?.complete ?? false;
  flat['daily_tasks.manage'] = permissionsJson?.daily_tasks?.manage ?? false;
  // Fleet
  flat['fleet.view'] = permissionsJson?.fleet?.view ?? false;
  flat['fleet.manage'] = permissionsJson?.fleet?.manage ?? false;
  flat['fleet.import'] = permissionsJson?.fleet?.import ?? permissionsJson?.fleet?.manage ?? false;
  flat['fleet.gps'] = permissionsJson?.fleet?.gps ?? false;
  // Schedules (Horarios)
  flat['schedules.view'] = permissionsJson?.schedules?.view ?? false;
  flat['schedules.assign'] = permissionsJson?.schedules?.assign ?? permissionsJson?.schedules?.manage ?? false;
  flat['schedules.manage_templates'] = permissionsJson?.schedules?.manage_templates ?? permissionsJson?.schedules?.manage ?? false;
  flat['schedules.view_directiva'] = permissionsJson?.schedules?.view_directiva ?? permissionsJson?.schedules?.manage ?? false;
  flat['schedules.manage_notes'] = permissionsJson?.schedules?.manage_notes ?? permissionsJson?.schedules?.manage ?? false;
  flat['schedules.manage'] = permissionsJson?.schedules?.manage ?? false;
  // Preparation
  flat['preparation.view'] = permissionsJson?.preparation?.view ?? false;
  flat['preparation.manage'] = permissionsJson?.preparation?.manage ?? false;
  // Lost & Found
  flat['lost_found.view'] = permissionsJson?.lost_found?.view ?? false;
  flat['lost_found.create'] = permissionsJson?.lost_found?.create ?? permissionsJson?.lost_found?.manage ?? false;
  flat['lost_found.update'] = permissionsJson?.lost_found?.update ?? permissionsJson?.lost_found?.manage ?? false;
  flat['lost_found.manage'] = permissionsJson?.lost_found?.manage ?? false;
  // Rently (Bidirectional Sync)
  flat['rently.booking_confirm'] = permissionsJson?.rently?.booking_confirm ?? permissionsJson?.rently?.manage ?? false;
  flat['rently.booking_cancel'] = permissionsJson?.rently?.booking_cancel ?? permissionsJson?.rently?.manage ?? false;
  flat['rently.booking_uncancel'] = permissionsJson?.rently?.booking_uncancel ?? permissionsJson?.rently?.manage ?? false;
  flat['rently.booking_update'] = permissionsJson?.rently?.booking_update ?? permissionsJson?.rently?.manage ?? false;
  flat['rently.booking_create'] = permissionsJson?.rently?.booking_create ?? permissionsJson?.rently?.manage ?? false;
  flat['rently.operations_delivery'] = permissionsJson?.rently?.operations_delivery ?? permissionsJson?.rently?.manage ?? false;
  flat['rently.operations_return'] = permissionsJson?.rently?.operations_return ?? permissionsJson?.rently?.manage ?? false;
  flat['rently.customer_manage'] = permissionsJson?.rently?.customer_manage ?? permissionsJson?.rently?.manage ?? false;
  flat['rently.cars_relocate'] = permissionsJson?.rently?.cars_relocate ?? permissionsJson?.rently?.manage ?? false;
  flat['rently.manage'] = permissionsJson?.rently?.manage ?? false;

  return flat;
}

export function MemberPermissionsEditor({ userId, memberRole }: MemberPermissionsEditorProps) {
  const { overrides, isLoading, setPermissionOverride, removeOverride, resetAllOverrides, isUpdating } = useUserPermissionOverrides(userId);
  const { getDefaultsForRole, isLoading: roleLoading } = useRolePermissions();
  const { roles: customRoles, isLoading: customRolesLoading } = useCustomRoles();
  const [searchQuery, setSearchQuery] = useState('');

  const isCustomRole = !SYSTEM_ROLES.includes(memberRole);
  const isOwnerRole = memberRole === 'owner';

  const customRole = useMemo(() => {
    if (!isCustomRole || !customRoles) return null;
    return customRoles.find(r => 
      r.id === memberRole.replace('custom:', '') || 
      r.name.toLowerCase() === memberRole.toLowerCase()
    );
  }, [isCustomRole, customRoles, memberRole]);

  const roleDefaults = useMemo(() => {
    if (isCustomRole && customRole) {
      return mapCustomRoleToFlatPermissions(customRole.permissions_json as Record<string, any>);
    }
    return getDefaultsForRole(memberRole as OrgRole);
  }, [isCustomRole, customRole, memberRole, getDefaultsForRole]);

  if (isLoading || roleLoading || customRolesLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const overrideMap = new Map(overrides.map(o => [o.permission_key, o.enabled]));

  const getEffectiveValue = (permissionKey: string): boolean => {
    if (overrideMap.has(permissionKey)) {
      return overrideMap.get(permissionKey)!;
    }
    return roleDefaults[permissionKey] ?? false;
  };

  const hasOverride = (permissionKey: string): boolean => {
    return overrideMap.has(permissionKey);
  };

  const handleToggle = (permissionKey: string, currentValue: boolean) => {
    const newValue = !currentValue;
    const roleDefault = roleDefaults[permissionKey] ?? false;

    if (newValue === roleDefault && hasOverride(permissionKey)) {
      removeOverride(permissionKey);
    } else {
      setPermissionOverride({ permissionKey, enabled: newValue });
    }
  };

  const handleSelectAllCategory = (permissionKeys: PermissionKey[], allEnabled: boolean) => {
    permissionKeys.forEach(key => {
      const roleDefault = roleDefaults[key] ?? false;
      const newValue = !allEnabled;
      if (newValue === roleDefault && hasOverride(key)) {
        removeOverride(key);
      } else if (newValue !== getEffectiveValue(key)) {
        setPermissionOverride({ permissionKey: key, enabled: newValue });
      }
    });
  };

  const filteredCategories = PERMISSION_CATEGORIES.filter(category => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      category.label.toLowerCase().includes(query) ||
      category.permissions.some(p => 
        p.label.toLowerCase().includes(query) || 
        p.description.toLowerCase().includes(query)
      )
    );
  });

  const hasAnyOverrides = overrides.length > 0;

  return (
    <div className="space-y-4">
      {/* Search and Reset */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar permisos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        {hasAnyOverrides && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => resetAllOverrides()}
            disabled={isUpdating}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Resetear todos
          </Button>
        )}
      </div>

      {/* Info */}
      <div className="flex gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Badge variant="outline">Heredado</Badge>
          <span>Valor del rol</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="default">Override</Badge>
          <span>Valor personalizado</span>
        </div>
      </div>

      {/* Owner warning */}
      {isOwnerRole && (
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            Los owners siempre tienen todos los permisos. Los overrides no tienen efecto.
          </p>
        </div>
      )}

      {/* Custom role info */}
      {isCustomRole && customRole && (
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Este usuario tiene el rol personalizado "{customRole.name}". Los valores heredados corresponden a ese rol.
          </p>
        </div>
      )}

      {/* Permissions by Category */}
      <Accordion type="multiple" defaultValue={PERMISSION_CATEGORIES.map(c => c.id)} className="space-y-2">
        {filteredCategories.map((category) => {
          const Icon = category.icon;
          const visiblePermissions = category.permissions.filter(p =>
            !searchQuery || 
            p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description.toLowerCase().includes(searchQuery.toLowerCase())
          );
          const enabledCount = visiblePermissions.filter(p => getEffectiveValue(p.key)).length;
          const allEnabled = enabledCount === visiblePermissions.length && visiblePermissions.length > 0;
          const someEnabled = enabledCount > 0 && !allEnabled;

          return (
            <AccordionItem key={category.id} value={category.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{category.label}</span>
                  <Badge variant="outline" className="text-xs font-normal">
                    {enabledCount}/{visiblePermissions.length}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-1 pb-2">
                  {/* Select All */}
                  {visiblePermissions.length > 1 && (
                    <div className="flex items-center gap-3 py-2 px-3 border-b border-border/50 mb-2">
                      <Checkbox
                        checked={allEnabled}
                        {...(someEnabled ? { 'data-state': 'indeterminate' } : {})}
                        onCheckedChange={() => handleSelectAllCategory(visiblePermissions.map(p => p.key), allEnabled)}
                        disabled={isUpdating || isOwnerRole}
                      />
                      <span className="text-sm font-medium text-muted-foreground">Seleccionar todos</span>
                    </div>
                  )}
                  {visiblePermissions.map((perm) => {
                    const effectiveValue = getEffectiveValue(perm.key);
                    const isOverride = hasOverride(perm.key);
                    const roleDefault = roleDefaults[perm.key] ?? false;

                    return (
                      <div
                        key={perm.key}
                        className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/50"
                      >
                        <div className="flex-1 min-w-0 mr-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{perm.label}</span>
                            {isOverride ? (
                              <Badge variant="default" className="text-xs">Override</Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs">
                                Heredado ({roleDefault ? 'sí' : 'no'})
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{perm.description}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {isOverride && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeOverride(perm.key)}
                              disabled={isUpdating}
                            >
                              <RotateCcw className="h-3 w-3" />
                            </Button>
                          )}
                          <Switch
                            checked={effectiveValue}
                            onCheckedChange={() => handleToggle(perm.key, effectiveValue)}
                            disabled={isUpdating || isOwnerRole}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
