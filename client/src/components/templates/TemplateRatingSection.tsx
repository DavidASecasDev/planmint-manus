// Phase 29: Template Rating Section
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, MessageSquare } from 'lucide-react';
import { TemplateRating } from '@/types/userTemplates';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface TemplateRatingSectionProps {
  templateId: string;
  ratings: TemplateRating[];
  myRating: TemplateRating | null;
  canRate: boolean;
  onRate: (rating: number, review?: string) => void;
  isRating?: boolean;
}

export const TemplateRatingSection = ({
  templateId,
  ratings,
  myRating,
  canRate,
  onRate,
  isRating,
}: TemplateRatingSectionProps) => {
  const [selectedRating, setSelectedRating] = useState(myRating?.rating || 0);
  const [review, setReview] = useState(myRating?.review || '');
  const [hoveredRating, setHoveredRating] = useState(0);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (myRating) {
      setSelectedRating(myRating.rating);
      setReview(myRating.review || '');
    }
  }, [myRating]);

  const handleSubmit = () => {
    if (selectedRating > 0) {
      onRate(selectedRating, review.trim() || undefined);
      setShowForm(false);
    }
  };

  const displayRating = hoveredRating || selectedRating;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Star className="h-4 w-4" />
          Valoraciones
          {ratings.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {ratings.length} {ratings.length === 1 ? 'valoración' : 'valoraciones'}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Rating form */}
        {canRate && (
          <div className="border rounded-lg p-4 bg-muted/30">
            {!showForm && !myRating ? (
              <Button variant="outline" onClick={() => setShowForm(true)}>
                <Star className="h-4 w-4 mr-2" />
                Valorar esta plantilla
              </Button>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-medium">
                  {myRating ? 'Tu valoración' : 'Deja tu valoración'}
                </p>
                
                {/* Stars */}
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="p-1 hover:scale-110 transition-transform"
                      onMouseEnter={() => setHoveredRating(star)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => setSelectedRating(star)}
                    >
                      <Star 
                        className={`h-6 w-6 ${
                          star <= displayRating 
                            ? 'fill-amber-400 text-amber-400' 
                            : 'text-muted-foreground'
                        }`} 
                      />
                    </button>
                  ))}
                </div>

                {/* Review textarea */}
                <Textarea
                  placeholder="Escribe un comentario (opcional, máx 240 caracteres)"
                  value={review}
                  onChange={(e) => setReview(e.target.value.slice(0, 240))}
                  className="resize-none"
                  rows={2}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {review.length}/240
                </p>

                <div className="flex gap-2">
                  <Button 
                    onClick={handleSubmit} 
                    disabled={selectedRating === 0 || isRating}
                    size="sm"
                  >
                    {isRating ? 'Guardando...' : myRating ? 'Actualizar' : 'Enviar'}
                  </Button>
                  {!myRating && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setShowForm(false);
                        setSelectedRating(0);
                        setReview('');
                      }}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ratings list */}
        {ratings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Aún no hay valoraciones. {canRate && '¡Sé el primero!'}
          </p>
        ) : (
          <div className="space-y-3">
            {ratings.slice(0, 5).map((rating) => (
              <div key={rating.id} className="flex gap-3 p-3 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{rating.user_name}</span>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star 
                          key={star}
                          className={`h-3 w-3 ${
                            star <= rating.rating 
                              ? 'fill-amber-400 text-amber-400' 
                              : 'text-muted-foreground'
                          }`} 
                        />
                      ))}
                    </div>
                  </div>
                  {rating.review && (
                    <p className="text-sm text-muted-foreground">{rating.review}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {format(new Date(rating.created_at), "d 'de' MMMM, yyyy", { locale: es })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
