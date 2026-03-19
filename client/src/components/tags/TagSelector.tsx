import { Check } from 'lucide-react';
import { Tag } from '@/types/tags';
import { TagIcon } from './TagIcon';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface TagSelectorProps {
  tags: Tag[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function TagSelector({ tags, selectedTagIds, onChange, disabled }: TagSelectorProps) {
  const toggleTag = (tagId: string) => {
    if (disabled) return;
    
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  if (tags.length === 0) {
    return (
      <div>
        <Label>Etiquetas</Label>
        <p className="text-sm text-muted-foreground mt-2">
          No hay etiquetas disponibles. Los administradores pueden crear etiquetas desde la sección de Etiquetas.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Label>Etiquetas</Label>
      <div className="flex flex-wrap gap-2 mt-2">
        {tags.map((tag) => {
          const isSelected = selectedTagIds.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              onClick={() => toggleTag(tag.id)}
              disabled={disabled}
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm transition-all',
                isSelected ? 'ring-2 ring-offset-1' : 'hover:opacity-80',
                disabled && 'opacity-50 cursor-not-allowed'
              )}
              style={{
                backgroundColor: isSelected ? `${tag.color}25` : `${tag.color}10`,
                borderColor: `${tag.color}50`,
                color: tag.color,
                // @ts-ignore - CSS custom property for ring color
                '--tw-ring-color': tag.color,
              } as React.CSSProperties}
            >
              {isSelected ? (
                <Check className="h-3 w-3" />
              ) : (
                <TagIcon icon={tag.icon} size={12} />
              )}
              <span>{tag.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
