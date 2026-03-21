/*
 * Azul Cars — Theme Toggle
 * Compact sun/moon switch for the AppHeader.
 * Cycles: light → dark → system → light …
 * Gold accent: oklch(0.72 0.10 80)
 */
import { useTheme, ThemePreference } from '@/contexts/ThemeContext';
import { Sun, Moon, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const options: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  const currentIcon = theme === 'system' ? Monitor : resolvedTheme === 'dark' ? Moon : Sun;
  const CurrentIcon = currentIcon;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-full"
              aria-label="Cambiar tema"
            >
              <Sun className="h-[1.15rem] w-[1.15rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-muted-foreground" />
              <Moon className="absolute h-[1.15rem] w-[1.15rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-muted-foreground" />
              <span className="sr-only">Cambiar tema</span>
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <span style={{ fontFamily: 'Barlow, sans-serif', fontSize: '12px' }}>
            Tema: {options.find(o => o.value === theme)?.label}
          </span>
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        {options.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="gap-2.5 cursor-pointer"
            style={{ fontFamily: 'Barlow, sans-serif' }}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            {theme === value && (
              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
