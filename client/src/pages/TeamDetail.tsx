import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTeam, useTeamMembers, useTeams } from '@/hooks/useTeams';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, UserPlus, Trash2, Users, Pencil, Shield, ArrowRight } from 'lucide-react';
import { AddTeamMemberDialog } from '@/components/teams/AddTeamMemberDialog';
import { TeamFormDialog } from '@/components/teams/TeamFormDialog';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function TeamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { team, isLoading: loadingTeam } = useTeam(id);
  const { members, isLoading: loadingMembers, addMember, removeMember, isAdding, isRemoving } = useTeamMembers(id);
  const { updateTeam, deleteTeam, isUpdating, isDeleting } = useTeams();
  const { hasPermission, canAccessAdminPanel, isLoading: permissionsLoading } = usePermissions();

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const canManage = !permissionsLoading && hasPermission('members.change_role');

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleAddMember = (userId: string) => {
    addMember(userId, {
      onSuccess: () => setAddMemberOpen(false),
    });
  };

  const handleRemoveMember = (membershipId: string, memberName: string) => {
    if (confirm(`¿Eliminar a ${memberName} del equipo?`)) {
      removeMember(membershipId);
    }
  };

  const handleUpdateTeam = (data: { name: string; description?: string; color?: string }) => {
    if (!team) return;
    updateTeam({ id: team.id, ...data }, {
      onSuccess: () => setEditOpen(false),
    });
  };

  const handleDeleteTeam = () => {
    if (!team) return;
    if (confirm(`¿Estás seguro de que quieres eliminar el equipo "${team.name}"? Esta acción no se puede deshacer.`)) {
      deleteTeam(team.id, {
        onSuccess: () => navigate('/teams'),
      });
    }
  };

  if (loadingTeam) {
    return (
      <AppLayout title="Team">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!team) {
    return (
      <AppLayout title="Equipo no encontrado">
        <div className="container max-w-lg py-16">
          <div className="text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Users className="h-8 w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">Equipo no disponible</h1>
              <p className="text-muted-foreground max-w-md mx-auto">
                Este equipo fue eliminado o ya no existe. Es posible que haya sido borrado por un administrador.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button onClick={() => navigate('/teams')} className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver a Equipos
              </Button>
              <Button variant="outline" onClick={() => navigate('/notifications')} className="gap-2">
                Ver notificaciones
              </Button>
            </div>
            {id && (
              <p className="text-xs text-muted-foreground/60 font-mono">
                ID: {id}
              </p>
            )}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title={team.name}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/teams')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-12 w-12" style={{ backgroundColor: team.color || undefined }}>
              <AvatarFallback className="text-white font-bold text-lg">
                {team.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-2xl font-bold">{team.name}</h1>
              {team.description && (
                <p className="text-muted-foreground">{team.description}</p>
              )}
            </div>
          </div>
          {canManage && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button variant="destructive" onClick={handleDeleteTeam} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              </Button>
            </div>
          )}
        </div>

        {/* Members */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Miembros del equipo ({members.length})
                </CardTitle>
                <CardDescription>
                  Miembros que pertenecen a este equipo
                </CardDescription>
              </div>
              {canManage && (
                <Button onClick={() => setAddMemberOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Añadir miembro
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loadingMembers ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Este equipo no tiene miembros</p>
                {canManage && (
                  <Button variant="link" onClick={() => setAddMemberOpen(true)}>
                    Añadir el primer miembro
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Miembro</TableHead>
                    <TableHead>Añadido</TableHead>
                    {canManage && <TableHead className="text-right">Acciones</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {getInitials(member.profile?.name)}
                            </AvatarFallback>
                          </Avatar>
                          <p className="font-medium">{member.profile?.name || 'Sin nombre'}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {format(new Date(member.created_at), 'PP', { locale: es })}
                      </TableCell>
                      {canManage && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id, member.profile?.name || 'este miembro')}
                            disabled={isRemoving}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Link to Admin */}
        {canAccessAdminPanel && (
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">¿Necesitas cambiar roles o permisos?</CardTitle>
                    <CardDescription>
                      Los roles globales se gestionan desde Administración
                    </CardDescription>
                  </div>
                </div>
                <Button variant="outline" asChild>
                  <Link to="/settings/admin">
                    Ir a Administración
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
          </Card>
        )}

        {/* Dialogs */}
        <AddTeamMemberDialog
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
          currentMembers={members}
          onAdd={handleAddMember}
          isLoading={isAdding}
        />

        <TeamFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          team={team}
          onSubmit={handleUpdateTeam}
          isLoading={isUpdating}
        />
      </div>
    </AppLayout>
  );
}
