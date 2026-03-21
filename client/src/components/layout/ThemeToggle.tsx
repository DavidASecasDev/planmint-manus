/*
 * Azul Cars — Theme Toggle
 * Animated sun/moon switch for the AppHeader.
 * Dropdown: light / dark / system
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
  const isDark = resolvedTheme === 'dark';

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative h-9 w-9 rounded-full overflow-hidden"
              aria-label="Cambiar tema"
            >
              {/* Sun icon — visible in light mode */}
              <Sun
                className="absolute h-[1.15rem] w-[1.15rem] text-muted-foreground"
                style={{
                  transform: isDark ? 'rotate(-90deg) scale(0)' : 'rotate(0deg) scale(1)',
                  opacity: isDark ? 0 : 1,
                  transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms ease',
                }}
              />
              {/* Moon icon — visible in dark mode */}
              <Moon
                className="absolute h-[1.15rem] w-[1.15rem] text-muted-foreground"
                style={{
                  transform: isDark ? 'rotate(0deg) scale(1)' : 'rotate(90deg) scale(0)',
                  opacity: isDark ? 1 : 0,
                  transition: 'transform 500ms cubic-bezier(0.4, 0, 0.2, 1), opacity 400ms ease',
                }}
              />
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
              <span
                className="ml-auto h-1.5 w-1.5 rounded-full bg-primary"
                style={{
                  animation: 'theme-dot-pop 300ms ease-out',
                }}
              />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
