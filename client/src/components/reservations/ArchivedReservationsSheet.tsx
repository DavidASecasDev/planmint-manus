import { Archive, RotateCcw, Calendar, Car, User } from 'lucide-react';
import { useState } from 'react';
import { Search } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { Reservation } from '@/types/reservations';

interface ArchivedReservationsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservations: Reservation[];
  onRestore: (reservationId: string) => void;
  isRestoring: boolean;
  archiveDays?: number;
}

export function ArchivedReservationsSheet({
  open,
  onOpenChange,
  reservations,
  onRestore,
  isRestoring,
  archiveDays = 10,
}: ArchivedReservationsSheetProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Extract date components directly from ISO string to avoid timezone conversion
  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, year, month, day] = match;
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year}`;
    }
    return '-';
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      return `${parseInt(day)} ${months[parseInt(month) - 1]} ${year} ${hour}:${minute}`;
    }
    return '-';
  };

  const getClientName = (r: Reservation) => {
    const parts = [r.cliente_nombre, r.cliente_apellido].filter(Boolean);
    return parts.join(' ') || 'Sin nombre';
  };

  // Filter reservations by search query (reservation number, client name, vehicle)
  const filteredReservations = searchQuery.trim()
    ? reservations.filter((r) => {
        const q = searchQuery.toLowerCase();
        const resId = (r.external_reservation_id || '').toLowerCase();
        const client = getClientName(r).toLowerCase();
        const vehicle = (r.auto || '').toLowerCase();
        const model = (r.modelo || '').toLowerCase();
        return resId.includes(q) || client.includes(q) || vehicle.includes(q) || model.includes(q);
      })
    : reservations;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-muted-foreground" />
            Reservas Archivadas
          </SheetTitle>
          <SheetDescription>
            Las reservas con fecha de devolución hace más de {archiveDays} días se archivan automáticamente.
            Puedes restaurarlas si es necesario.
          </SheetDescription>
        </SheetHeader>

        {/* Search input */}
        {reservations.length > 0 && (
          <div className="mt-4 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nº reserva, cliente o matrícula..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        <ScrollArea className="mt-6 h-[calc(100vh-200px)]">
          {filteredReservations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">{searchQuery ? 'Sin resultados' : 'No hay reservas archivadas'}</p>
              <p className="text-sm">{searchQuery ? `No se encontró "${searchQuery}"` : 'Las reservas antiguas aparecerán aquí'}</p>
            </div>
          ) : (
            <div className="space-y-3 pr-4">
              {filteredReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="p-3 rounded-lg border bg-card"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-mono font-semibold text-sm">
                          #{reservation.external_reservation_id}
                        </h4>
                        <Badge variant="secondary" className="text-xs">
                          {reservation.estado || 'Sin estado'}
                        </Badge>
                      </div>
                      
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span className="truncate">{getClientName(reservation)}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Car className="h-3 w-3" />
                          <span>{reservation.modelo || 'Sin modelo'}</span>
                          {reservation.auto && (
                            <span className="font-mono">• {reservation.auto}</span>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {formatDateTime(reservation.desde)} → {formatDateTime(reservation.hasta)}
                          </span>
                        </div>
                        
                        <p className="text-muted-foreground/70 mt-1">
                          Archivada: {formatDate(reservation.archived_at)}
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onRestore(reservation.id)}
                      disabled={isRestoring}
                      title="Restaurar reserva"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {reservations.length > 0 && (
          <div className="mt-4 pt-4 border-t text-xs text-muted-foreground text-center">
            {searchQuery
              ? `${filteredReservations.length} de ${reservations.length} reservas`
              : `${reservations.length} reserva${reservations.length !== 1 ? 's' : ''} archivada${reservations.length !== 1 ? 's' : ''}`
            }
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
