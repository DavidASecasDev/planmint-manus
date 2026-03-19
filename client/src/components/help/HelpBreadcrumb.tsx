import { ChevronRight, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface HelpBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export function HelpBreadcrumb({ items, className }: HelpBreadcrumbProps) {
  return (
    <nav className={cn('flex items-center text-sm', className)}>
      <button
        onClick={items[0]?.onClick}
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-4 w-4" />
        <span className="hidden sm:inline">Ayuda</span>
      </button>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center">
          <ChevronRight className="h-4 w-4 mx-2 text-muted-foreground/50" />
          <button
            onClick={item.onClick}
            className={cn(
              'transition-colors',
              index === items.length - 1
                ? 'text-foreground font-medium cursor-default'
                : 'text-muted-foreground hover:text-foreground'
            )}
            disabled={index === items.length - 1}
          >
            {item.label}
          </button>
        </div>
      ))}
    </nav>
  );
}
