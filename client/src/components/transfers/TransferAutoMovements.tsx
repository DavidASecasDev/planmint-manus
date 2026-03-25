import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  Truck, ChevronDown, MapPin, Clock, ArrowRight, 
  FileText, ExternalLink, CheckCircle2, XCircle, 
  Loader2, RotateCcw, Bot
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import type { VehicleMovement } from '@/hooks/useMovements';

interface TransferAutoMovementsProps {
  requestId: string;
  /** Optional: document IDs to filter movements by */
  documentIds?: string[];
}

interface AutoMovement extends VehicleMovement {
  isReturn: boolean;
  sourceDocId: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  en_curso: { label: 'En curso', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: Loader2 },
  completado: { label: 'Completado', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  cancelado: { label: 'Cancelado', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', icon: XCircle },
};

const TYPE_LABELS: Record<string, string> = {
  entrega: 'Entrega',
  recogida: 'Recogida',
  escoba: 'Escoba',
  limpieza: 'Limpieza',
};

export function TransferAutoMovements({ requestId, documentIds }: TransferAutoMovementsProps) {
  const { profile } = useAuth();
  const [movements, setMovements] = useState<AutoMovement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(true);

  useEffect(() => {
    if (!profile?.organization_id || !requestId) {
      setIsLoading(false);
      return;
    }

    const orgId = profile.organization_id;

    const fetchAutoMovements = async () => {
      setIsLoading(true);
      try {
        // Query movements that have the auto-generated marker in notes
        const { data, error } = await supabase
          .from('vehicle_movements')
          .select('*, driver:profiles!vehicle_movements_driver_id_fkey(id, name)')
          .eq('organization_id', orgId)
          .like('notes', '%Generado desde presupuesto%')
          .order('started_at', { ascending: true });

        if (error) {
          console.error('[TransferAutoMovements] Error fetching:', error);
          setMovements([]);
          return;
        }

        // Filter movements that belong to this transfer's documents
        const autoMovements: AutoMovement[] = (data || [])
          .map((m: any) => {
            const notes = m.notes || '';
            // Extract doc ID from notes: "Generado desde presupuesto (doc: abcdef12)"
            const docMatch = notes.match(/\(doc:\s*([a-f0-9]+)\)/);
            const sourceDocId = docMatch ? docMatch[1] : null;
            const isReturn = notes.startsWith('VUELTA:');

            return {
              ...m,
              isReturn,
              sourceDocId,
            } as AutoMovement;
          })
          .filter((m: AutoMovement) => {
            // If we have specific document IDs, filter by them
            if (documentIds && documentIds.length > 0) {
              return documentIds.some(docId => 
                m.sourceDocId && docId.startsWith(m.sourceDocId)
              );
            }
            // Otherwise show all auto-generated movements for this org
            return true;
          });

        setMovements(autoMovements);
      } catch (err) {
        console.error('[TransferAutoMovements] Unexpected error:', err);
        setMovements([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAutoMovements();
  }, [profile?.organization_id, requestId, documentIds]);

  const stats = useMemo(() => {
    const total = movements.length;
    const completed = movements.filter(m => m.status === 'completado').length;
    const inProgress = movements.filter(m => m.status === 'en_curso').length;
    const cancelled = movements.filter(m => m.status === 'cancelado').length;
    return { total, completed, inProgress, cancelled };
  }, [movements]);

  // Don't render if no auto-created movements exist
  if (!isLoading && movements.length === 0) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('es-ES', { 
        day: '2-digit', month: '2-digit', year: '2-digit' 
      });
    } catch {
      return '—';
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleTimeString('es-ES', { 
        hour: '2-digit', minute: '2-digit' 
      });
    } catch {
      return '—';
    }
  };

  const parseNotesLocations = (notes: string | null): { pickup: string; dropoff: string } | null => {
    if (!notes) return null;
    // Parse "Recogida: X | Destino: Y" from notes
    const pickupMatch = notes.match(/Recogida:\s*([^|]+)/);
    const dropoffMatch = notes.match(/Destino:\s*([^|]+)/);
    // Also parse "VUELTA: X → Y" format
    const returnMatch = notes.match(/VUELTA:\s*(.+?)\s*→\s*([^|]+)/);
    
    if (returnMatch) {
      return { pickup: returnMatch[1].trim(), dropoff: returnMatch[2].trim() };
    }
    if (pickupMatch || dropoffMatch) {
      return { 
        pickup: pickupMatch ? pickupMatch[1].trim() : '—', 
        dropoff: dropoffMatch ? dropoffMatch[1].trim() : '—' 
      };
    }
    return null;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="border-blue-200/50 dark:border-blue-800/30">
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  Movimientos Auto-generados
                  <Badge variant="outline" className="text-xs font-normal bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 border-blue-200">
                    {isLoading ? '...' : stats.total}
                  </Badge>
                </h3>
                {!isLoading && stats.total > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stats.completed > 0 && `${stats.completed} completados`}
                    {stats.completed > 0 && stats.inProgress > 0 && ' · '}
                    {stats.inProgress > 0 && `${stats.inProgress} en curso`}
                    {(stats.completed > 0 || stats.inProgress > 0) && stats.cancelled > 0 && ' · '}
                    {stats.cancelled > 0 && `${stats.cancelled} cancelados`}
                  </p>
                )}
              </div>
            </div>
            <ChevronDown className={cn('h-5 w-5 text-muted-foreground transition-transform', isOpen && 'rotate-180')} />
          </div>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                <span className="text-sm">Cargando movimientos...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {movements.map((movement) => {
                  const statusConfig = STATUS_CONFIG[movement.status] || STATUS_CONFIG.en_curso;
                  const StatusIcon = statusConfig.icon;
                  const locations = parseNotesLocations(movement.notes);

                  return (
                    <div 
                      key={movement.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-muted/30 transition-colors group"
                    >
                      {/* Status icon */}
                      <div className="shrink-0">
                        <StatusIcon className={cn(
                          'h-4 w-4',
                          movement.status === 'en_curso' && 'animate-spin text-blue-500',
                          movement.status === 'completado' && 'text-green-500',
                          movement.status === 'cancelado' && 'text-red-500',
                        )} />
                      </div>

                      {/* Main info */}
                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={cn('text-xs', statusConfig.color)}>
                            {statusConfig.label}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {TYPE_LABELS[movement.movement_type] || movement.movement_type}
                          </Badge>
                          {movement.isReturn && (
                            <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 border-amber-200">
                              <RotateCcw className="h-3 w-3 mr-1" />
                              Vuelta
                            </Badge>
                          )}
                          <span className="text-xs font-mono text-muted-foreground">
                            {movement.matricula}
                          </span>
                        </div>

                        {/* Route */}
                        {locations && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{locations.pickup}</span>
                            <ArrowRight className="h-3 w-3 shrink-0" />
                            <span className="truncate">{locations.dropoff}</span>
                          </div>
                        )}

                        {/* Date & time */}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDate(movement.started_at)} {formatTime(movement.started_at)}
                          </span>
                          {movement.driver?.name && (
                            <span>· {movement.driver.name}</span>
                          )}
                        </div>
                      </div>

                      {/* Source badge */}
                      <div className="shrink-0 hidden sm:flex items-center gap-1">
                        <Badge variant="outline" className="text-xs gap-1 bg-muted/50">
                          <FileText className="h-3 w-3" />
                          PDF
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
