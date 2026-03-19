import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Download, 
  FileSpreadsheet, 
  FileJson,
  CheckSquare,
  Folder,
  Tag,
  Zap,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { useDataExport } from '@/hooks/useDataExport';
import { useSubscription } from '@/hooks/useSubscription';
import { useState } from 'react';
import { UpgradeModal } from '@/components/subscription/UpgradeModal';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

export function DataExportSection() {
  const { isExporting, exportTasks, exportAreas, exportTags, exportAutomations } = useDataExport();
  const { isProPlan, isTeamPlan } = useSubscription();
  const { profile, organization, signOut } = useAuth();
  const { isOwner } = usePermissions();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showDeleteOrgDialog, setShowDeleteOrgDialog] = useState(false);
  const [confirmOrgName, setConfirmOrgName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Gate by subscription plan
  const canExport = isProPlan || isTeamPlan;
  const canExportAutomations = isTeamPlan;

  const handleExportAutomations = () => {
    if (!canExportAutomations) {
      setShowUpgradeModal(true);
      return;
    }
    exportAutomations();
  };

  const handleDeleteOrganization = async () => {
    if (!profile?.organization_id) return;
    
    setIsDeleting(true);
    try {
      // This would need a proper implementation with cascade delete
      // For now, we'll just log the audit event and show a message
      const { error } = await supabase.from('audit_logs').insert({
        organization_id: profile.organization_id,
        actor_user_id: profile.id,
        actor_role: profile.role,
        action: 'org.delete_requested',
        entity_type: 'organization',
        entity_id: profile.organization_id,
        metadata_json: { requested_at: new Date().toISOString() },
      });

      if (error) throw error;

      toast.success('Solicitud de eliminación registrada. Contacta con soporte para completar el proceso.');
      setShowDeleteOrgDialog(false);
      setConfirmOrgName('');
      setConfirmDelete(false);
    } catch (error) {
      toast.error('Error al procesar la solicitud');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            <CardTitle>Exportar datos</CardTitle>
            {!canExport && <Badge variant="secondary">Pro</Badge>}
          </div>
          <CardDescription>
            Descarga tus datos en formato CSV o JSON
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Tasks CSV */}
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                <CheckSquare className="h-5 w-5 text-blue-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Tareas</p>
                <p className="text-sm text-muted-foreground">CSV</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={canExport ? exportTasks : () => setShowUpgradeModal(true)}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Areas CSV */}
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="h-10 w-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <Folder className="h-5 w-5 text-green-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Áreas</p>
                <p className="text-sm text-muted-foreground">CSV</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={canExport ? exportAreas : () => setShowUpgradeModal(true)}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Tags CSV */}
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                <Tag className="h-5 w-5 text-purple-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Etiquetas</p>
                <p className="text-sm text-muted-foreground">CSV</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={canExport ? exportTags : () => setShowUpgradeModal(true)}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
              </Button>
            </div>

            {/* Automations JSON */}
            <div className="flex items-center gap-3 p-4 border rounded-lg">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium">Automatizaciones</p>
                <p className="text-sm text-muted-foreground">
                  JSON {!canExportAutomations && <Badge variant="secondary" className="ml-1">Team</Badge>}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportAutomations}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileJson className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      {isOwner && (
        <Card className="border-destructive/50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-destructive">Zona de peligro</CardTitle>
            </div>
            <CardDescription>
              Acciones irreversibles que afectan a toda la organización
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border border-destructive/30 rounded-lg bg-destructive/5">
              <div>
                <p className="font-medium">Eliminar organización</p>
                <p className="text-sm text-muted-foreground">
                  Elimina permanentemente toda la organización y sus datos
                </p>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteOrgDialog(true)}
              >
                Eliminar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Delete Organization Dialog */}
      <AlertDialog open={showDeleteOrgDialog} onOpenChange={setShowDeleteOrgDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Solicitar eliminación de organización?</AlertDialogTitle>
            <AlertDialogDescription>
              Al confirmar, se registrará una solicitud de eliminación que será procesada por nuestro equipo de soporte. Se eliminarán:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Todas las tareas y objetivos</li>
                <li>Áreas y etiquetas</li>
                <li>Automatizaciones</li>
                <li>Plantillas</li>
                <li>Historial de auditoría</li>
                <li>Todos los miembros perderán acceso</li>
              </ul>
              <strong className="block mt-2">El equipo de soporte te contactará para confirmar el proceso.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                Escribe el nombre de la organización para confirmar
              </Label>
              <Input
                value={confirmOrgName}
                onChange={(e) => setConfirmOrgName(e.target.value)}
                placeholder="Nombre de la organización"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="confirm-delete"
                checked={confirmDelete}
                onCheckedChange={(checked) => setConfirmDelete(!!checked)}
              />
              <Label htmlFor="confirm-delete" className="text-sm">
                Entiendo que esta acción es irreversible
              </Label>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDeleteOrganization}
              disabled={!confirmDelete || confirmOrgName.trim() !== organization?.name || isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar permanentemente
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeModal
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        limitMessage="Actualiza tu plan para exportar datos"
        suggestedPlan="pro"
      />
    </div>
  );
}
