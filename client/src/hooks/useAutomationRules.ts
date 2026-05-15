import { useState, useEffect, useCallback } from 'react';
import { supabaseQuery } from '@/lib/supabaseQuery';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { 
  AutomationRule, 
  AutomationRun, 
  CreateAutomationRuleData, 
  UpdateAutomationRuleData,
  ConditionsJson,
  ActionsJson,
  TriggerType
} from '@/types/automations';
// useEntitlements removed (internal app, no limits)

export const useAutomationRules = () => {
  const { profile } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runsLoading, setRunsLoading] = useState(false);

  const organizationId = profile?.organization_id;
  const currentPlan = 'team';
  const ruleLimit = Infinity;
  const canCreateRules = true;
  // Use permissions from RPC instead of profile.role
  const canManageRules = hasPermission('automations.manage');

  const fetchRules = useCallback(async () => {
    if (!organizationId || !canManageRules) {
      setRules([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabaseQuery
        .from('automation_rules')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Cast the data to handle jsonb fields
      const typedRules: AutomationRule[] = (data || []).map((rule: any) => ({
        ...rule,
        conditions_json: rule.conditions_json as unknown as ConditionsJson,
        actions_json: rule.actions_json as unknown as ActionsJson,
        trigger_type: rule.trigger_type as TriggerType,
      }));
      
      setRules(typedRules);
    } catch (error: any) {
      console.error('Error fetching automation rules:', error);
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las reglas de automatización',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [organizationId, canManageRules, toast]);

  const fetchRuns = useCallback(async (ruleId?: string, limit = 50) => {
    if (!organizationId || !canManageRules) {
      setRuns([]);
      return;
    }

    setRunsLoading(true);
    try {
      let query = supabaseQuery
        .from('automation_runs')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (ruleId) {
        query = query.eq('rule_id', ruleId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      setRuns((data || []) as AutomationRun[]);
    } catch (error: any) {
      console.error('Error fetching automation runs:', error);
    } finally {
      setRunsLoading(false);
    }
  }, [organizationId, canManageRules]);

  const createRule = async (data: CreateAutomationRuleData): Promise<AutomationRule | null> => {
    if (!organizationId || !profile?.id || !canManageRules) {
      toast({
        title: 'Error',
        description: 'No tienes permisos para crear reglas',
        variant: 'destructive',
      });
      return null;
    }

    if (!canCreateRules) {
      toast({
        title: 'Límite alcanzado',
        description: `Tu plan ${currentPlan} permite hasta ${ruleLimit} reglas. Actualiza a un plan superior.`,
        variant: 'destructive',
      });
      return null;
    }

    try {
      const insertData = {
        organization_id: organizationId,
        created_by: profile.id,
        name: data.name,
        trigger_type: data.trigger_type,
        conditions_json: data.conditions_json,
        actions_json: data.actions_json,
        throttle_minutes: data.throttle_minutes || 60,
        is_active: data.is_active ?? true,
      };

      const { data: newRule, error } = await supabaseQuery
        .from('automation_rules')
        .insert(insertData as any)
        .select()
        .single();

      if (error) throw error;

      const typedRule: AutomationRule = {
        ...newRule,
        conditions_json: newRule.conditions_json as unknown as ConditionsJson,
        actions_json: newRule.actions_json as unknown as ActionsJson,
        trigger_type: newRule.trigger_type as TriggerType,
      };

      setRules(prev => [typedRule, ...prev]);
      toast({
        title: 'Regla creada',
        description: 'La automatización se ha creado correctamente',
      });
      return typedRule;
    } catch (error: any) {
      console.error('Error creating automation rule:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la regla',
        variant: 'destructive',
      });
      return null;
    }
  };

  const updateRule = async (id: string, data: UpdateAutomationRuleData): Promise<boolean> => {
    if (!canManageRules) {
      toast({
        title: 'Error',
        description: 'No tienes permisos para editar reglas',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const updateData: Record<string, unknown> = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.trigger_type !== undefined) updateData.trigger_type = data.trigger_type;
      if (data.conditions_json !== undefined) updateData.conditions_json = data.conditions_json;
      if (data.actions_json !== undefined) updateData.actions_json = data.actions_json;
      if (data.throttle_minutes !== undefined) updateData.throttle_minutes = data.throttle_minutes;
      if (data.is_active !== undefined) updateData.is_active = data.is_active;

      const { error } = await supabaseQuery
        .from('automation_rules')
        .update(updateData)
        .eq('id', id);

      if (error) throw error;

      setRules(prev => prev.map(rule => 
        rule.id === id ? { ...rule, ...data } as AutomationRule : rule
      ));
      toast({
        title: 'Regla actualizada',
        description: 'Los cambios se han guardado correctamente',
      });
      return true;
    } catch (error: any) {
      console.error('Error updating automation rule:', error);
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la regla',
        variant: 'destructive',
      });
      return false;
    }
  };

  const toggleRule = async (id: string, isActive: boolean): Promise<boolean> => {
    return updateRule(id, { is_active: isActive });
  };

  const deleteRule = async (id: string): Promise<boolean> => {
    if (!canManageRules) {
      toast({
        title: 'Error',
        description: 'No tienes permisos para eliminar reglas',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const { error } = await supabaseQuery
        .from('automation_rules')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setRules(prev => prev.filter(rule => rule.id !== id));
      toast({
        title: 'Regla eliminada',
        description: 'La automatización se ha eliminado correctamente',
      });
      return true;
    } catch (error: any) {
      console.error('Error deleting automation rule:', error);
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la regla',
        variant: 'destructive',
      });
      return false;
    }
  };

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  return {
    rules,
    runs,
    loading,
    runsLoading,
    canCreateRules,
    canManageRules,
    ruleLimit,
    currentPlan,
    rulesCount: rules.length,
    fetchRules,
    fetchRuns,
    createRule,
    updateRule,
    toggleRule,
    deleteRule,
  };
};
