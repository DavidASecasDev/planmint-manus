import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Users, ArrowRight } from 'lucide-react';
import { useSCIMProvisioning } from '@/hooks/useSCIMProvisioning';
import { useCustomRoles } from '@/hooks/useCustomRoles';
import { Skeleton } from '@/components/ui/skeleton';

export function SCIMGroupMappingsSection() {
  const {
    groups,
    mappings,
    isLoading,
    upsertMapping,
    getGroupMembersCount,
    getGroupMapping,
    isUpdating,
  } = useSCIMProvisioning();

  const { roles, isLoading: isLoadingRoles } = useCustomRoles();

  if (isLoading || isLoadingRoles) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Grupos y Mappings SCIM
        </CardTitle>
        <CardDescription>
          Mapea grupos SCIM a roles internos de PlanMint
        </CardDescription>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No hay grupos SCIM detectados</p>
            <p className="text-sm">Los grupos aparecerán aquí cuando tu IdP los envíe vía SCIM</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Grupo SCIM</TableHead>
                <TableHead>Miembros</TableHead>
                <TableHead className="w-8"></TableHead>
                <TableHead>Mapear a Rol</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((group) => {
                const mapping = getGroupMapping(group.id);
                const membersCount = getGroupMembersCount(group.id);

                return (
                  <TableRow key={group.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{group.display_name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {group.scim_group_external_id}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{membersCount}</Badge>
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={mapping?.map_to_id || ''}
                        onValueChange={(roleId) => {
                          if (roleId) {
                            upsertMapping({
                              scim_group_id: group.id,
                              map_to_type: 'role',
                              map_to_id: roleId,
                            });
                          }
                        }}
                        disabled={isUpdating}
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Seleccionar rol..." />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.id} value={role.id}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            <strong>Prioridad de roles:</strong> Si un usuario pertenece a múltiples grupos,
            se asignará el rol con mayor prioridad (Admin {'>'} Manager {'>'} Member {'>'} Read-only).
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
