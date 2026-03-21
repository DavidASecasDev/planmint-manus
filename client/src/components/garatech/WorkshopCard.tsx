import { Building2, Phone, Mail, MapPin, Eye, History, Trash2, MoreVertical, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import type { Workshop } from '@/types/garatech';

interface WorkshopCardProps {
  workshop: Workshop;
  onEdit?: (workshop: Workshop) => void;
  onDelete?: (workshop: Workshop) => void;
  onViewDetails: (workshop: Workshop) => void;
  onViewHistory: (workshop: Workshop) => void;
  onRatingChange?: (workshopId: string, rating: number) => void;
}

export function WorkshopCard({ workshop, onEdit, onDelete, onViewDetails, onViewHistory, onRatingChange }: WorkshopCardProps) {
  const specialties = workshop.notes?.split(',').map(s => s.trim()).filter(Boolean) || [];
  const currentRating = workshop.rating || 0;
  
  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-border/50 hover:border-primary/20">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate">{workshop.name}</h3>
                <Badge 
                  variant={workshop.is_active ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {workshop.is_active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              {/* Interactive Rating */}
              <div className="flex items-center gap-1 mt-1">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => onRatingChange?.(workshop.id, star)}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm transition-transform hover:scale-110"
                      aria-label={`Valorar ${star} de 5 estrellas`}
                    >
                      <Star 
                        className={`h-3.5 w-3.5 cursor-pointer ${
                          star <= currentRating 
                            ? 'text-yellow-400 fill-yellow-400 dark:text-yellow-300 dark:fill-yellow-300' 
                            : 'text-muted-foreground/30 hover:text-yellow-300 dark:hover:text-yellow-200'
                        }`}
                      />
                    </button>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground ml-1">
                  {currentRating > 0 ? currentRating.toFixed(1) : '—'}
                </span>
              </div>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit?.(workshop)}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive"
                onClick={() => onDelete?.(workshop)}
              >
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Contact Info */}
        <div className="space-y-2 mb-4">
          {workshop.address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <span className="text-muted-foreground">{workshop.address}</span>
            </div>
          )}
          {workshop.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <a href={`tel:${workshop.phone}`} className="text-muted-foreground hover:text-primary transition-colors">
                {workshop.phone}
              </a>
            </div>
          )}
          {workshop.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <a href={`mailto:${workshop.email}`} className="text-primary hover:underline truncate">
                {workshop.email}
              </a>
            </div>
          )}
        </div>

        {/* Specialties */}
        {specialties.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-foreground mb-2">Especialidades:</p>
            <div className="flex flex-wrap gap-1.5">
              {specialties.slice(0, 3).map((specialty, index) => (
                <Badge 
                  key={index} 
                  variant="outline" 
                  className="text-xs bg-primary/5 border-primary/20 text-primary"
                >
                  {specialty}
                </Badge>
              ))}
              {specialties.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{specialties.length - 3}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-3 border-t border-border/50">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={() => onViewDetails(workshop)}
          >
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Ver Detalles
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs"
            onClick={() => onViewHistory(workshop)}
          >
            <History className="h-3.5 w-3.5 mr-1.5" />
            Historial
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete?.(workshop)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
