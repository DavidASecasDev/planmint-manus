import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, User, Zap, LayoutTemplate } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { MODULE_DISPLAY_NAMES } from '@/lib/verticalPresets';

interface ModuleHistorySectionProps {
  organizationId: string;
}

interface HistoryEntry {
  id: string;
  action: string;
  created_at: string;
  reason: string | null;
  metadata_json: {
    preset_key?: string;
    preset_name?: string;
    modules_activated?: string[];
    module_key?: string;
    enabled?: boolean;
  } | null;
  actor_user_id: string | null;
  profiles?: { name: string | null } | null;
}

export function ModuleHistorySection({ organizationId }: ModuleHistorySectionProps) {
  const { data: history, isLoading } = useQuery({
    queryKey: ['module-history', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('super_admin_actions')
        .select(`
          id,
          action,
          created_at,
          reason,
          metadata_json,
          actor_user_id
        `)
        .eq('entity_type', 'organization')
        .eq('entity_id', organizationId)
        .in('action', ['preset_apply', 'module_toggle'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Fetch actor names separately
      const actorIds = Array.from(new Set((data || []).map(d => d.actor_user_id).filter(Boolean)));
      let profilesMap: Record<string, string> = {};
      
      if (actorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', actorIds);
        
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = p.name || 'Sistema';
            return acc;
          }, {} as Record<string, string>);
        }
      }

      return (data || []).map(entry => ({
        ...entry,
        metadata_json: entry.metadata_json as HistoryEntry['metadata_json'],
        profiles: entry.actor_user_id ? { name: profilesMap[entry.actor_user_id] || null } : null,
      })) as HistoryEntry[];
    },
    enabled: !!organizationId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Cambios
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!history || history.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Historial de Cambios
          </CardTitle>
          <CardDescription>
            Últimos cambios en módulos y presets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay cambios registrados
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Historial de Cambios
        </CardTitle>
        <CardDescription>
          Últimos {history.length} cambios en módulos y presets
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {history.map((entry) => (
              <HistoryItem key={entry.id} entry={entry} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function HistoryItem({ entry }: { entry: HistoryEntry }) {
  const isPreset = entry.action === 'preset_apply';
  const metadata = entry.metadata_json;
  const actorName = entry.profiles?.name || 'Sistema';

  const getDescription = () => {
    if (isPreset && metadata) {
      const modules = metadata.modules_activated || [];
      const moduleNames = modules.map(m => MODULE_DISPLAY_NAMES[m] || m).join(', ');
      return `Preset "${metadata.preset_name}" aplicado. Módulos: ${moduleNames}`;
    }
    
    if (metadata?.module_key) {
      const moduleName = MODULE_DISPLAY_NAMES[metadata.module_key] || metadata.module_key;
      return `Módulo "${moduleName}" ${metadata.enabled ? 'activado' : 'desactivado'}`;
    }

    return 'Cambio en módulos';
  };

  return (
    <div className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors">
      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        {isPreset ? (
          <LayoutTemplate className="h-4 w-4 text-primary" />
        ) : (
          <Zap className="h-4 w-4 text-primary" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge variant={isPreset ? 'default' : 'secondary'} className="text-xs">
            {isPreset ? 'Preset' : 'Módulo'}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(new Date(entry.created_at), "d MMM yyyy, HH:mm", { locale: es })}
          </span>
        </div>
        <p className="text-sm font-medium truncate">{getDescription()}</p>
        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span>{actorName}</span>
          {entry.reason && (
            <>
              <span className="mx-1">•</span>
              <span className="truncate" title={entry.reason}>{entry.reason}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
