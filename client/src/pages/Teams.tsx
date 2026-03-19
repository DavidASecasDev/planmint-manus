import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTeams, Team } from '@/hooks/useTeams';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Users, Shield, ArrowRight } from 'lucide-react';
import { TeamCard } from '@/components/teams/TeamCard';
import { TeamFormDialog } from '@/components/teams/TeamFormDialog';
import { Link } from 'react-router-dom';

export default function Teams() {
  const navigate = useNavigate();
  const { teams, isLoading, createTeam, updateTeam, deleteTeam, isCreating, isUpdating } = useTeams();
  const { canAccessAdminPanel, hasPermission, isLoading: permissionsLoading } = usePermissions();
  
  const [formOpen, setFormOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const canManageTeams = !permissionsLoading && hasPermission('members.change_role');

  const handleCreate = (data: { name: string; description?: string; color?: string }) => {
    createTeam(data, {
      onSuccess: () => setFormOpen(false),
    });
  };

  const handleEdit = (team: Team) => {
    setEditingTeam(team);
    setFormOpen(true);
  };

  const handleUpdate = (data: { name: string; description?: string; color?: string }) => {
    if (!editingTeam) return;
    updateTeam({ id: editingTeam.id, ...data }, {
      onSuccess: () => {
        setFormOpen(false);
        setEditingTeam(null);
      },
    });
  };

  const handleDelete = (team: Team) => {
    if (confirm(`¿Estás seguro de que quieres eliminar el equipo "${team.name}"?`)) {
      deleteTeam(team.id);
    }
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingTeam(null);
  };

  if (isLoading) {
    return (
      <AppLayout title="Teams">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Teams">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Teams</h1>
            <p className="text-muted-foreground">
              Organiza a los miembros en equipos de trabajo
            </p>
          </div>
          {canManageTeams && (
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear equipo
            </Button>
          )}
        </div>

        {/* Teams Grid */}
        {teams.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No hay equipos</h3>
              <p className="text-muted-foreground text-center mb-4">
                Crea equipos para organizar a los miembros de tu organización
              </p>
              {canManageTeams && (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Crear primer equipo
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                canManage={canManageTeams}
                onClick={() => navigate(`/teams/${team.id}`)}
                onEdit={() => handleEdit(team)}
                onDelete={() => handleDelete(team)}
              />
            ))}
          </div>
        )}

        {/* Link to Admin Panel */}
        {canAccessAdminPanel && (
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Gestionar roles y permisos</CardTitle>
                    <CardDescription>
                      Para cambiar roles globales o gestionar permisos individuales
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

        {/* Form Dialog */}
        <TeamFormDialog
          open={formOpen}
          onOpenChange={handleCloseForm}
          team={editingTeam}
          onSubmit={editingTeam ? handleUpdate : handleCreate}
          isLoading={isCreating || isUpdating}
        />
      </div>
    </AppLayout>
  );
}
