import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  ChevronRight, 
  ChevronLeft, 
  Plus, 
  Trash2,
  Zap,
  Filter,
  Play
} from 'lucide-react';
import { useAutomationRules } from '@/hooks/useAutomationRules';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { useTags } from '@/hooks/useTags';
import { useAreas } from '@/hooks/useAreas';
import {
  AutomationRule,
  Condition,
  AutomationAction,
  TriggerType,
  ConditionField,
  ConditionOperator,
  ActionType,
  TRIGGER_OPTIONS,
  CONDITION_FIELD_OPTIONS,
  OPERATOR_OPTIONS,
  ACTION_TYPE_OPTIONS,
  isTransferTrigger,
  TRANSFER_STATUS_OPTIONS,
} from '@/types/automations';
import { TASK_STATUS_OPTIONS, TASK_PRIORITY_OPTIONS, TASK_TYPE_OPTIONS } from '@/types/tasks';

interface AutomationRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingRule: AutomationRule | null;
}

export function AutomationRuleDialog({ open, onOpenChange, editingRule }: AutomationRuleDialogProps) {
  const { createRule, updateRule, currentPlan } = useAutomationRules();
  const { members } = useOrganizationMembers();
  const { tags } = useTags();
  const { areas } = useAreas();
  
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('task_created');
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [actions, setActions] = useState<AutomationAction[]>([]);
  const [throttleMinutes, setThrottleMinutes] = useState(60);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingRule) {
      setName(editingRule.name);
      setTriggerType(editingRule.trigger_type);
      setConditions(editingRule.conditions_json.all || []);
      setActions(editingRule.actions_json.actions || []);
      setThrottleMinutes(editingRule.throttle_minutes);
    } else {
      setName('');
      setTriggerType('task_created');
      setConditions([]);
      setActions([]);
      setThrottleMinutes(60);
    }
    setStep(1);
  }, [editingRule, open]);

  const handleSave = async () => {
    if (!name.trim()) return;
    
    setSaving(true);
    try {
      const data = {
        name: name.trim(),
        trigger_type: triggerType,
        conditions_json: { all: conditions },
        actions_json: { actions },
        throttle_minutes: throttleMinutes,
      };

      if (editingRule) {
        await updateRule(editingRule.id, data);
      } else {
        await createRule(data);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const addCondition = () => {
    setConditions([...conditions, { field: 'status', op: 'equals', value: 'pending' }]);
  };

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    setConditions(conditions.map((c, i) => i === index ? { ...c, ...updates } : c));
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const addAction = () => {
    setActions([...actions, { type: 'create_in_app_notification', target: 'assigned_to', title: '', body: '' }]);
  };

  const updateAction = (index: number, updates: Partial<AutomationAction>) => {
    setActions(actions.map((a, i) => i === index ? { ...a, ...updates } : a));
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const getFieldValueOptions = (field: ConditionField) => {
    switch (field) {
      case 'status':
        return TASK_STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }));
      case 'priority':
        return TASK_PRIORITY_OPTIONS.map(o => ({ value: o.value, label: o.label }));
      case 'type':
        return TASK_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }));
      case 'assigned_to':
        return [
          { value: 'is_null', label: 'Sin asignar' },
          ...members.map(m => ({ value: m.id, label: m.name || m.id })),
        ];
      case 'has_tag':
        return tags.map(t => ({ value: t.id, label: t.name }));
      case 'has_area':
        return areas.map(a => ({ value: a.id, label: a.name }));
      case 'is_overdue':
        return [
          { value: 'true', label: 'Sí' },
          { value: 'false', label: 'No' },
        ];
      default:
        return [];
    }
  };

  const isActionAvailable = (actionType: ActionType) => {
    const action = ACTION_TYPE_OPTIONS.find(a => a.value === actionType);
    if (!action?.requiresPlan) return true;
    if (action.requiresPlan === 'team' && currentPlan !== 'team') return false;
    if (action.requiresPlan === 'pro' && currentPlan === 'free') return false;
    return true;
  };

  const renderStep1 = () => (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Nombre de la regla</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Notificar bloqueos urgentes"
        />
      </div>

      <div className="space-y-2">
        <Label>Trigger (¿Cuándo se ejecuta?)</Label>
        <Select value={triggerType} onValueChange={(v) => setTriggerType(v as TriggerType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Tareas</div>
            {TRIGGER_OPTIONS.filter(o => o.category === 'tasks').map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div>
                  <span className="font-medium">{option.label}</span>
                  <span className="text-muted-foreground text-xs ml-2">{option.description}</span>
                </div>
              </SelectItem>
            ))}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-1.5">Transfers</div>
            {TRIGGER_OPTIONS.filter(o => o.category === 'transfers').map((option) => (
              <SelectItem key={option.value} value={option.value}>
                <div>
                  <span className="font-medium">{option.label}</span>
                  <span className="text-muted-foreground text-xs ml-2">{option.description}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Anti-spam (minutos entre ejecuciones)</Label>
        <Input
          type="number"
          min={1}
          max={1440}
          value={throttleMinutes}
          onChange={(e) => setThrottleMinutes(parseInt(e.target.value) || 60)}
        />
        <p className="text-xs text-muted-foreground">
          Evita que la misma regla se ejecute repetidamente para la misma entidad
        </p>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">Condiciones (opcional)</Label>
        <Button variant="outline" size="sm" onClick={addCondition}>
          <Plus className="h-4 w-4 mr-1" />
          Añadir
        </Button>
      </div>

      {conditions.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-center text-muted-foreground">
            <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin condiciones. La regla se ejecutará siempre que ocurra el trigger.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conditions.map((condition, index) => (
            <Card key={index}>
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Select
                    value={condition.field}
                    onValueChange={(v) => updateCondition(index, { field: v as ConditionField, value: '' })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_FIELD_OPTIONS
                        .filter(f => !f.category || f.category === (isTransferTrigger(triggerType) ? 'transfers' : 'tasks'))
                        .map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select
                    value={condition.op}
                    onValueChange={(v) => updateCondition(index, { op: v as ConditionOperator })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {OPERATOR_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {!['exists', 'missing'].includes(condition.op) && (
                    <Select
                      value={String(condition.value)}
                      onValueChange={(v) => updateCondition(index, { value: v })}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Seleccionar valor" />
                      </SelectTrigger>
                      <SelectContent>
                        {getFieldValueOptions(condition.field).map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Button variant="ghost" size="icon" onClick={() => removeCondition(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base">Acciones</Label>
        <Button variant="outline" size="sm" onClick={addAction}>
          <Plus className="h-4 w-4 mr-1" />
          Añadir
        </Button>
      </div>

      {actions.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-center text-muted-foreground">
            <Play className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Añade al menos una acción para que la regla haga algo</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {actions.map((action, index) => (
            <Card key={index}>
              <CardContent className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Select
                    value={action.type}
                    onValueChange={(v) => updateAction(index, { type: v as ActionType })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_TYPE_OPTIONS
                        .filter(a => !a.category || a.category === 'general' || a.category === (isTransferTrigger(triggerType) ? 'transfers' : 'tasks'))
                        .map((a) => (
                        <SelectItem 
                          key={a.value} 
                          value={a.value}
                          disabled={!isActionAvailable(a.value)}
                        >
                          <div className="flex items-center gap-2">
                            <span>{a.label}</span>
                            {a.requiresPlan && (
                              <Badge variant="outline" className="text-xs">
                                {a.requiresPlan}
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => removeAction(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Action-specific fields */}
                {['set_status'].includes(action.type) && (
                  <Select
                    value={action.value || ''}
                    onValueChange={(v) => updateAction(index, { value: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar estado" />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUS_OPTIONS.map((s) => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {['set_priority'].includes(action.type) && (
                  <Select
                    value={action.value || ''}
                    onValueChange={(v) => updateAction(index, { value: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_PRIORITY_OPTIONS.map((p) => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {['assign_to'].includes(action.type) && (
                  <Select
                    value={action.value || ''}
                    onValueChange={(v) => updateAction(index, { value: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name || m.id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {['add_tag'].includes(action.type) && (
                  <Select
                    value={action.value || ''}
                    onValueChange={(v) => updateAction(index, { value: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar etiqueta" />
                    </SelectTrigger>
                    <SelectContent>
                      {tags.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {['add_area'].includes(action.type) && (
                  <Select
                    value={action.value || ''}
                    onValueChange={(v) => updateAction(index, { value: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar área" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {['create_subtask', 'create_update'].includes(action.type) && (
                  <Input
                    value={action.value || ''}
                    onChange={(e) => updateAction(index, { value: e.target.value })}
                    placeholder={action.type === 'create_subtask' ? 'Título de la subtarea' : 'Texto del update'}
                  />
                )}

                {['create_in_app_notification', 'send_push', 'send_email'].includes(action.type) && (
                  <>
                    <Select
                      value={action.target || 'assigned_to'}
                      onValueChange={(v) => updateAction(index, { target: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Destinatario" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="assigned_to">Asignado</SelectItem>
                        <SelectItem value="created_by">Creador</SelectItem>
                        <SelectItem value="role:admin">Administradores</SelectItem>
                        <SelectItem value="role:manager">Managers</SelectItem>
                        {members.map((m) => (
                          <SelectItem key={m.id} value={m.id}>{m.name || m.id}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={action.title || ''}
                      onChange={(e) => updateAction(index, { title: e.target.value })}
                      placeholder="Título de la notificación"
                    />
                    <Input
                      value={action.body || ''}
                      onChange={(e) => updateAction(index, { body: e.target.value })}
                      placeholder="Mensaje de la notificación"
                    />
                  </>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim().length > 0;
      case 2:
        return true; // Conditions are optional
      case 3:
        return actions.length > 0;
      default:
        return false;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            {editingRule ? 'Editar regla' : 'Nueva regla de automatización'}
          </DialogTitle>
          <DialogDescription>
            Configura triggers, condiciones y acciones para automatizar flujos de trabajo.
          </DialogDescription>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 py-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                s === step
                  ? 'bg-primary text-primary-foreground'
                  : s < step
                  ? 'bg-primary/20 text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s}
            </div>
          ))}
        </div>

        <div className="text-center text-sm text-muted-foreground mb-4">
          {step === 1 && 'Configuración básica'}
          {step === 2 && 'Condiciones'}
          {step === 3 && 'Acciones'}
        </div>

        <Separator />

        <div className="py-4 min-h-[300px]">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>

        <Separator />

        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>

          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || !canProceed()}>
              {saving ? 'Guardando...' : editingRule ? 'Guardar cambios' : 'Crear regla'}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
