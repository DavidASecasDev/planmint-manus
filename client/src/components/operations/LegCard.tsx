import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Play, CheckCircle, AlertTriangle, User, Users } from 'lucide-react';
import { LegStatusBadge } from './LegStatusBadge';
import { DEFAULT_CHECKLIST, type OperationLeg } from '@/types/operations';

interface LegCardProps {
  leg: OperationLeg;
  onStart: (legId: string) => Promise<unknown>;
  onComplete: (legId: string) => Promise<unknown>;
  onReportIssue: (legId: string, notes: string) => Promise<unknown>;
  onChecklistChange: (legId: string, key: string, value: boolean) => Promise<unknown>;
  isLoading?: boolean;
}

export function LegCard({
  leg,
  onStart,
  onComplete,
  onReportIssue,
  onChecklistChange,
  isLoading,
}: LegCardProps) {
  const [issueDialogOpen, setIssueDialogOpen] = useState(false);
  const [issueNotes, setIssueNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const isPrimary = leg.leg_type === 'primary';
  const canStart = leg.status === 'pending';
  const canComplete = leg.status === 'en_route';
  const canReportIssue = leg.status !== 'done';

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await onStart(leg.id);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    setActionLoading(true);
    try {
      await onComplete(leg.id);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReportIssue = async () => {
    setActionLoading(true);
    try {
      await onReportIssue(leg.id, issueNotes);
      setIssueDialogOpen(false);
      setIssueNotes('');
    } finally {
      setActionLoading(false);
    }
  };

  const checklist = leg.checklist_json || {};

  return (
    <>
      <Card className={isPrimary ? 'border-primary/50' : 'border-muted'}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              {isPrimary ? (
                <User className="h-4 w-4" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              {isPrimary ? 'Operario Principal' : 'Operario de Apoyo'}
            </CardTitle>
            <LegStatusBadge status={leg.status} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Assignee */}
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>
                {leg.assignee?.name?.charAt(0) || '?'}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium">
              {leg.assignee?.name || 'Sin asignar'}
            </span>
          </div>

          {/* Timestamps */}
          {leg.started_at && (
            <p className="text-xs text-muted-foreground">
              Iniciado: {new Date(leg.started_at).toLocaleString('es-ES')}
            </p>
          )}
          {leg.completed_at && (
            <p className="text-xs text-muted-foreground">
              Completado: {new Date(leg.completed_at).toLocaleString('es-ES')}
            </p>
          )}

          {/* Checklist */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Checklist</p>
            {Object.entries(DEFAULT_CHECKLIST).map(([key, { label }]) => (
              <div key={key} className="flex items-center gap-2">
                <Checkbox
                  id={`${leg.id}-${key}`}
                  checked={checklist[key] || false}
                  onCheckedChange={(checked) =>
                    onChecklistChange(leg.id, key, checked as boolean)
                  }
                  disabled={leg.status === 'done' || isLoading}
                />
                <label
                  htmlFor={`${leg.id}-${key}`}
                  className="text-sm text-muted-foreground"
                >
                  {label}
                </label>
              </div>
            ))}
          </div>

          {/* Notes (if issue) */}
          {leg.status === 'issue' && leg.notes && (
            <div className="p-2 bg-destructive/10 rounded-md">
              <p className="text-sm text-destructive font-medium">Incidencia:</p>
              <p className="text-sm text-muted-foreground">{leg.notes}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            {canStart && (
              <Button
                size="sm"
                onClick={handleStart}
                disabled={actionLoading}
                className="flex-1"
              >
                <Play className="h-4 w-4 mr-1" />
                Iniciar
              </Button>
            )}
            {canComplete && (
              <Button
                size="sm"
                onClick={handleComplete}
                disabled={actionLoading}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-1" />
                Completar
              </Button>
            )}
            {canReportIssue && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setIssueDialogOpen(true)}
                disabled={actionLoading}
              >
                <AlertTriangle className="h-4 w-4 mr-1" />
                Incidencia
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Issue Dialog */}
      <Dialog open={issueDialogOpen} onOpenChange={setIssueDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reportar Incidencia</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Describe la incidencia..."
              value={issueNotes}
              onChange={(e) => setIssueNotes(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReportIssue}
              disabled={!issueNotes.trim() || actionLoading}
            >
              Reportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
