// Phase 29: User Template Card Component
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  LayoutTemplate, 
  Star, 
  Download, 
  Heart,
  ArrowRight,
  Lock,
  Users,
  Globe
} from 'lucide-react';
import { UserTemplate, VISIBILITY_LABELS } from '@/types/userTemplates';
import * as LucideIcons from 'lucide-react';

interface UserTemplateCardProps {
  template: UserTemplate;
  isFavorite?: boolean;
  onToggleFavorite?: (id: string) => void;
  showVisibility?: boolean;
  linkPrefix?: string;
}

export const UserTemplateCard = ({ 
  template, 
  isFavorite,
  onToggleFavorite,
  showVisibility = false,
  linkPrefix = '/templates/community'
}: UserTemplateCardProps) => {
  const IconComponent = (LucideIcons as any)[
    (template.icon || 'layout-template').split('-').map((s, i) => 
      i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)
    ).join('')
  ] || LayoutTemplate;

  const VisibilityIcon = template.visibility === 'private' ? Lock 
    : template.visibility === 'org' ? Users 
    : Globe;

  return (
    <Card className="h-full hover:shadow-lg transition-all duration-200 hover:border-primary/50 group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div 
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
            style={{ backgroundColor: `${template.color || '#6366f1'}20` }}
          >
            <IconComponent 
              className="h-6 w-6" 
              style={{ color: template.color || '#6366f1' }} 
            />
          </div>
          <div className="flex items-center gap-2">
            {showVisibility && (
              <Badge variant="outline" className="text-xs gap-1">
                <VisibilityIcon className="h-3 w-3" />
                {VISIBILITY_LABELS[template.visibility]}
              </Badge>
            )}
            {onToggleFavorite && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={(e) => {
                  e.preventDefault();
                  onToggleFavorite(template.id);
                }}
              >
                <Heart 
                  className={`h-4 w-4 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-muted-foreground'}`} 
                />
              </Button>
            )}
          </div>
        </div>
        <Link to={`${linkPrefix}/${template.slug}`}>
          <CardTitle className="text-lg group-hover:text-primary transition-colors cursor-pointer">
            {template.name}
          </CardTitle>
        </Link>
        <CardDescription className="line-clamp-2">
          {template.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Download className="h-3.5 w-3.5" />
              {template.installs_count}
            </span>
            {template.rating_count > 0 && (
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                {template.rating_avg.toFixed(1)}
                <span className="text-xs">({template.rating_count})</span>
              </span>
            )}
          </div>
          <Link to={`${linkPrefix}/${template.slug}`}>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </Link>
        </div>
        {template.creator_name && (
          <p className="text-xs text-muted-foreground mt-2">
            Por {template.creator_name}
          </p>
        )}
      </CardContent>
    </Card>
  );
};
