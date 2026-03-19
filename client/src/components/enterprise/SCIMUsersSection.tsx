import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Users, UserX } from 'lucide-react';
import { useSCIMProvisioning } from '@/hooks/useSCIMProvisioning';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export function SCIMUsersSection() {
  const {
    identities,
    groups,
    memberships,
    isLoading,
    deactivateUser,
  } = useSCIMProvisioning();

  const { members, isLoading: isLoadingMembers } = useOrganizationMembers();

  if (isLoading || isLoadingMembers) {
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

  // Get user groups
  const getUserGroups = (userId: string) => {
    const userMemberships = memberships.filter(m => m.user_id === userId);
    return userMemberships
      .map(m => groups.find(g => g.id === m.scim_group_id)?.display_name)
      .filter(Boolean);
  };

  // Get member profile
  const getMemberProfile = (userId: string) => {
    return members.find(m => m.id === userId);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Usuarios Aprovisionados
        </CardTitle>
        <CardDescription>
          Usuarios creados o sincronizados vía SCIM
        </CardDescription>
      </CardHeader>
      <CardContent>
        {identities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>No hay usuarios aprovisionados vía SCIM</p>
            <p className="text-sm">Los usuarios aparecerán aquí cuando tu IdP los cree vía SCIM</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>External ID</TableHead>
                <TableHead>Grupos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Creado</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {identities.map((identity) => {
                const profile = getMemberProfile(identity.user_id);
                const userGroups = getUserGroups(identity.user_id);

                return (
                  <TableRow key={identity.id}>
                    <TableCell>
                      <div>
                        <span className="font-medium">
                          {profile?.name || 'Usuario'}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {identity.scim_user_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">
                        {identity.scim_external_id}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {userGroups.length > 0 ? (
                          userGroups.map((group, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {group}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={identity.is_active ? 'default' : 'secondary'}>
                        {identity.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(identity.created_at), { 
                        addSuffix: true, 
                        locale: es 
                      })}
                    </TableCell>
                    <TableCell>
                      {identity.is_active && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deactivateUser(identity.user_id)}
                        >
                          <UserX className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
