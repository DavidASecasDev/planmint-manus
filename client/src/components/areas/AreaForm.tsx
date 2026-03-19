import { useState, useEffect, useRef } from 'react';
import { Area, CreateAreaData, AREA_ICONS, AREA_COLORS, AreaVisibility, VISIBILITY_OPTIONS } from '@/types/areas';
import { useAuth } from '@/contexts/AuthContext';
import { useAreaAccess } from '@/hooks/useAreaAccess';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AreaIcon } from './AreaIcon';
import { AreaAccessManager } from './AreaAccessManager';
import { cn } from '@/lib/utils';
import { Loader2, Check, Users, Shield, Settings } from 'lucide-react';

interface AreaFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  area?: Area | null;
  onSubmit: (data: CreateAreaData & { is_archived?: boolean }, accessSubjects?: Array<{ type: 'user' | 'role' | 'team'; id: string }>) => Promise<boolean>;
}

export function AreaForm({ open, onOpenChange, area, onSubmit }: AreaFormProps) {
  const { profile } = useAuth();
  const { hasPermission } = usePermissions();
  const { accessRules, availableUsers, availableRoles, setAccessRulesForArea, loading: accessLoading } = useAreaAccess(area?.id);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState<string>(AREA_COLORS[0].value);
  const [icon, setIcon] = useState('folder');
  const [isArchived, setIsArchived] = useState(false);
  const [visibility, setVisibility] = useState<AreaVisibility>('org');
  const [accessSubjects, setAccessSubjects] = useState<Array<{ type: 'user' | 'role' | 'team'; id: string; name?: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasLoadedAccessSubjects, setHasLoadedAccessSubjects] = useState(false);

  // Refs para controlar cuándo inicializar el formulario
  const prevAreaIdRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

  const isEditing = !!area;
  // Use permission engine instead of profile.role - owner/admin/manager can manage visibility
  const canManageVisibility = hasPermission('areas.manage_visibility');

  // Inicializar formulario SOLO cuando el sheet se abre o el area.id cambia
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    const areaChanged = area?.id !== prevAreaIdRef.current;
    
    if (justOpened || areaChanged) {
      if (area) {
        setName(area.name);
        setDescription(area.description || '');
        setColor(area.color);
        setIcon(area.icon);
        setIsArchived(area.is_archived);
        setVisibility(area.visibility || 'org');
        setHasLoadedAccessSubjects(false);
      } else {
        setName('');
        setDescription('');
        setColor(AREA_COLORS[0].value);
        setIcon('folder');
        setIsArchived(false);
        setVisibility('org');
        setAccessSubjects([]);
        setHasLoadedAccessSubjects(false);
      }
      setErrors({});
      prevAreaIdRef.current = area?.id || null;
    }
    
    wasOpenRef.current = open;
  }, [area, open]);

  // Sincronizar accessRules del hook con accessSubjects del formulario
  // Se ejecuta cuando el fetch termina (!accessLoading) y no se han cargado aún
  useEffect(() => {
    if (area && visibility === 'custom' && !hasLoadedAccessSubjects && !accessLoading) {
      const getSubjectName = (rule: { subject_type: string; subject_id: string }) => {
        if (rule.subject_type === 'user') {
          const user = availableUsers.find(u => u.id === rule.subject_id);
          return user?.name || 'Usuario';
        } else if (rule.subject_type === 'role') {
          const role = availableRoles.find(r => r.id === rule.subject_id);
          return role?.name || 'Rol';
        }
        return 'Desconocido';
      };

      const subjects = accessRules.map(rule => ({
        type: rule.subject_type as 'user' | 'role' | 'team',
        id: rule.subject_id,
        name: getSubjectName(rule),
      }));
      setAccessSubjects(subjects);
      setHasLoadedAccessSubjects(true);
    }
  }, [area, visibility, accessRules, availableUsers, availableRoles, hasLoadedAccessSubjects, accessLoading]);

  // Limpiar accessSubjects cuando se cambia de custom a otra visibilidad
  useEffect(() => {
    if (visibility !== 'custom') {
      setAccessSubjects([]);
    }
  }, [visibility]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'El nombre es obligatorio';
    }

    if (visibility === 'custom' && accessSubjects.length === 0) {
      newErrors.access = 'Debes agregar al menos un usuario o rol con acceso';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    const data = {
      name: name.trim(),
      description: description.trim() || undefined,
      color,
      icon,
      visibility,
      ...(isEditing && { is_archived: isArchived }),
    };

    const success = await onSubmit(data, visibility === 'custom' ? accessSubjects : undefined);

    setLoading(false);

    if (success) {
      onOpenChange(false);
    }
  };

  const getVisibilityIcon = (vis: string) => {
    switch (vis) {
      case 'org':
        return <Users className="h-4 w-4" />;
      case 'admins':
        return <Shield className="h-4 w-4" />;
      case 'custom':
        return <Settings className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Área' : 'Nueva Área'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Modifica los datos del área'
              : 'Crea una nueva área para organizar tu trabajo'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Trabajo, Casa, Finanzas..."
              className={cn("h-11", errors.name && 'border-destructive focus-visible:ring-destructive')}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe brevemente esta área..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Color */}
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {AREA_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={cn(
                    'h-9 w-9 rounded-full transition-all duration-200 flex items-center justify-center',
                    'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                    color === c.value && 'ring-2 ring-ring ring-offset-2 scale-110'
                  )}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                >
                  {color === c.value && (
                    <Check className="h-4 w-4 text-white drop-shadow-sm" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Icon */}
          <div className="space-y-2">
            <Label>Icono</Label>
            <div className="grid grid-cols-6 gap-2">
              {AREA_ICONS.map((i) => (
                <button
                  key={i.name}
                  type="button"
                  onClick={() => setIcon(i.name)}
                  className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl border-2 transition-all duration-200',
                    'hover:border-primary/50 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
                    icon === i.name
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground'
                  )}
                  title={i.label}
                >
                  <AreaIcon icon={i.name} className="h-5 w-5" />
                </button>
              ))}
            </div>
          </div>

          {/* Visibility - Only for admins */}
          {canManageVisibility && (
            <div className="space-y-3">
              <Label>Visibilidad</Label>
              <RadioGroup
                value={visibility}
                onValueChange={(v) => setVisibility(v as AreaVisibility)}
                className="space-y-2"
              >
                {VISIBILITY_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={cn(
                      'flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors',
                      visibility === option.value
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-muted/50'
                    )}
                    onClick={() => setVisibility(option.value)}
                  >
                    <RadioGroupItem value={option.value} id={`vis-${option.value}`} />
                    <div className="flex items-center gap-2 flex-1">
                      {getVisibilityIcon(option.value)}
                      <Label htmlFor={`vis-${option.value}`} className="cursor-pointer font-normal">
                        {option.label}
                      </Label>
                    </div>
                  </div>
                ))}
              </RadioGroup>

              {/* Custom access configuration */}
              {visibility === 'custom' && (
                <div className="mt-4 p-4 rounded-xl border border-border bg-muted/30 space-y-3">
                  <Label>Configurar acceso personalizado</Label>
                  <AreaAccessManager
                    areaId={area?.id}
                    selectedSubjects={accessSubjects}
                    onSubjectsChange={setAccessSubjects}
                  />
                  {errors.access && (
                    <p className="text-sm text-destructive">{errors.access}</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Preview */}
          <div className="space-y-2">
            <Label>Vista previa</Label>
            <Card className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl transition-transform"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    <AreaIcon icon={icon} className="h-5 w-5" style={{ color }} />
                  </div>
                  <div>
                    <p className="font-semibold">{name || 'Nombre del área'}</p>
                    <p className="text-sm text-muted-foreground">
                      {description || 'Sin descripción'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Archived (only in edit mode) */}
          {isEditing && (
            <div className="flex items-center justify-between rounded-xl border border-border/50 p-4 bg-muted/30">
              <div>
                <Label htmlFor="archived" className="cursor-pointer font-medium">
                  Área archivada
                </Label>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Las áreas archivadas no se muestran por defecto
                </p>
              </div>
              <Switch
                id="archived"
                checked={isArchived}
                onCheckedChange={setIsArchived}
              />
            </div>
          )}

          <SheetFooter className="gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="shadow-sm">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditing ? 'Guardar cambios' : 'Crear área'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
