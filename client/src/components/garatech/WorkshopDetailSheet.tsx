import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Building2, MapPin, Phone, Mail, Calendar, Star, Wrench, CheckCircle2, DollarSign } from 'lucide-react';
import type { Workshop, Repair } from '@/types/garatech';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface WorkshopDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workshop: Workshop | null;
  repairs: Repair[];
  onRatingChange?: (rating: number) => void;
}

export function WorkshopDetailSheet({ 
  open, 
  onOpenChange, 
  workshop, 
  repairs,
  onRatingChange 
}: WorkshopDetailSheetProps) {
  if (!workshop) return null;

  const specialties = workshop.notes?.split(',').map(s => s.trim()).filter(Boolean) || [];
  
  // Calculate stats from repairs
  const workshopRepairs = repairs.filter(r => r.workshop_id === workshop.id);
  const completedRepairs = workshopRepairs.filter(r => r.status === 'finalizado');
  const totalCost = workshopRepairs.reduce((sum, r) => sum + (r.cost_final || r.cost_estimate || 0), 0);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            {workshop.name}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Status & Rating */}
          <div className="flex items-center justify-between">
            <Badge variant={workshop.is_active ? 'default' : 'secondary'}>
              {workshop.is_active ? 'Activo' : 'Inactivo'}
            </Badge>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => onRatingChange?.(star)}
                  className="focus:outline-none transition-transform hover:scale-110"
                >
                  <Star 
                    className={`h-5 w-5 cursor-pointer ${
                      star <= (workshop.rating || 0) 
                        ? 'text-yellow-400 fill-yellow-400 dark:text-yellow-300 dark:fill-yellow-300' 
                        : 'text-muted-foreground/30 hover:text-yellow-300 dark:hover:text-yellow-200'
                    }`}
                  />
                </button>
              ))}
              <span className="text-sm text-muted-foreground ml-2">
                {workshop.rating?.toFixed(1) || '—'}
              </span>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Información de Contacto</h4>
            <div className="space-y-2">
              {workshop.address && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">{workshop.address}</span>
                </div>
              )}
              {workshop.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a href={`tel:${workshop.phone}`} className="text-primary hover:underline">
                    {workshop.phone}
                  </a>
                </div>
              )}
              {workshop.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <a href={`mailto:${workshop.email}`} className="text-primary hover:underline">
                    {workshop.email}
                  </a>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-muted-foreground">
                  Añadido el {format(new Date(workshop.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                </span>
              </div>
            </div>
          </div>

          {/* Specialties */}
          {specialties.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-foreground">Especialidades</h4>
              <div className="flex flex-wrap gap-2">
                {specialties.map((specialty, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="bg-primary/5 border-primary/20 text-primary"
                  >
                    {specialty}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Statistics */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-foreground">Estadísticas</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <Wrench className="h-5 w-5 mx-auto mb-1 text-primary" />
                <p className="text-lg font-semibold">{workshopRepairs.length}</p>
                <p className="text-xs text-muted-foreground">Reparaciones</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500 dark:text-green-400" />
                <p className="text-lg font-semibold">{completedRepairs.length}</p>
                <p className="text-xs text-muted-foreground">Completadas</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-amber-500 dark:text-amber-400" />
                <p className="text-lg font-semibold">
                  {totalCost > 0 ? `${totalCost.toLocaleString()}€` : '—'}
                </p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
