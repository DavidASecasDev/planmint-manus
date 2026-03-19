import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle2, Zap, Loader2, Building2, Users, BarChart3 } from 'lucide-react';
import { 
  VERTICAL_PRESETS, 
  VerticalPresetKey, 
  getModulesToActivate,
  MODULE_DISPLAY_NAMES,
} from '@/lib/verticalPresets';

interface ApplyPresetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationName: string;
  currentModules: Record<string, boolean>;
  onConfirm: (presetKey: VerticalPresetKey, reason: string) => void;
  isLoading?: boolean;
}

const PRESET_ICONS: Record<VerticalPresetKey, React.ElementType> = {
  internal_teams: Users,
  agencies: Building2,
  operations: BarChart3,
};

export function ApplyPresetDialog({
  open,
  onOpenChange,
  organizationName,
  currentModules,
  onConfirm,
  isLoading = false,
}: ApplyPresetDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState<VerticalPresetKey | null>(null);
  const [reason, setReason] = useState('');

  // Calculate what would be activated for the selected preset
  const modulesToActivate = useMemo(() => {
    if (!selectedPreset) return [];
    return getModulesToActivate(VERTICAL_PRESETS[selectedPreset], currentModules);
  }, [selectedPreset, currentModules]);

  const handleConfirm = () => {
    if (selectedPreset && reason.trim().length >= 5) {
      onConfirm(selectedPreset, reason.trim());
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setSelectedPreset(null);
      setReason('');
      onOpenChange(false);
    }
  };

  const isValid = selectedPreset && reason.trim().length >= 5;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Aplicar preset de vertical
          </DialogTitle>
          <DialogDescription>
            Selecciona un preset para <strong>{organizationName}</strong>. 
            Solo se <strong>activarán</strong> los módulos recomendados, no se desactivará ninguno existente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Preset selection */}
          <div className="grid gap-3">
            {Object.values(VERTICAL_PRESETS).map((preset) => {
              const Icon = PRESET_ICONS[preset.key];
              const isSelected = selectedPreset === preset.key;
              const activationCount = getModulesToActivate(preset, currentModules).length;

              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => setSelectedPreset(preset.key)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{preset.name}</span>
                        {activationCount > 0 && (
                          <Badge variant="secondary" className="text-xs">
                            +{activationCount} módulo{activationCount > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        {preset.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Preview of changes */}
          {selectedPreset && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label className="text-sm font-medium">Vista previa de cambios</Label>
                {modulesToActivate.length > 0 ? (
                  <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                      <CheckCircle2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Módulos que se activarán:</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {modulesToActivate.map((moduleKey) => (
                        <Badge key={moduleKey} variant="outline" className="bg-background">
                          {MODULE_DISPLAY_NAMES[moduleKey] || moduleKey}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg bg-muted border">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm">
                        Todos los módulos del preset ya están activos. No se realizarán cambios.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Reason input */}
          {selectedPreset && modulesToActivate.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="reason">
                Motivo <span className="text-destructive">*</span>
              </Label>
              <Input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Cliente solicitó configuración para agencias"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                Mínimo 5 caracteres. Este cambio quedará registrado en auditoría.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || modulesToActivate.length === 0 || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Aplicando...
              </>
            ) : (
              'Aplicar preset'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
