import { TagIcon } from './TagIcon';
import { cn } from '@/lib/utils';

interface TagBadgeData {
  id: string;
  name: string;
  color: string;
  icon: string;
}

interface TagBadgeProps {
  tag: TagBadgeData;
  size?: 'sm' | 'md';
  showName?: boolean;
  className?: string;
}

export function TagBadge({ tag, size = 'sm', showName = true, className }: TagBadgeProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm',
        className
      )}
      style={{
        backgroundColor: `${tag.color}15`,
        borderColor: `${tag.color}40`,
        color: tag.color,
      }}
    >
      <TagIcon icon={tag.icon} size={size === 'sm' ? 12 : 14} />
      {showName && <span>{tag.name}</span>}
    </div>
  );
}
