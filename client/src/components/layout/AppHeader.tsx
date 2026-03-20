/*
 * Azul Cars Brand — App Header
 * Background: warm off-white #F5F3EF (via --background)
 * Text: #0F1216 dark | Muted: #52555B
 * Accent: gold oklch(0.72 0.10 80)
 * Headings: Montserrat | Body: Barlow
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { getRoleLabel } from '@/lib/roleHierarchy';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { LogOut, Menu, Search, Settings, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { GlobalSearchPalette } from '@/components/search/GlobalSearchPalette';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/components/ui/sidebar';

const brand = {
  navy: '#001321',
  gold: 'oklch(0.72 0.10 80)',
  textDark: '#0F1216',
  textMuted: '#52555B',
  warmBg: '#F5F3EF',
  borderLight: 'rgba(0,19,33,0.08)',
};

interface AppHeaderProps {
  title: string;
}

export function AppHeader({ title }: AppHeaderProps) {
  const { profile, signOut } = useAuth();
  const { role } = usePermissions();
  const { isSuperAdmin } = useSuperAdmin();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const { toggleSidebar } = useSidebar();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const displayRoleLabel = (roleStr: string | null | undefined) => {
    if (!roleStr) return 'Miembro';
    return getRoleLabel(roleStr);
  };

  const displayRole = role;

  return (
    <>
      <header
        className="sticky top-0 z-30 flex h-14 items-center justify-between px-4 md:px-6 backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(245,243,239,0.85)',
          borderBottom: `1px solid ${brand.borderLight}`,
        }}
      >
        {/* Left: Hamburger (mobile) + Title */}
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="md:hidden h-10 w-10 shrink-0"
            aria-label="Abrir menú"
            style={{ color: brand.textDark }}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1
            className="text-lg truncate"
            style={{
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 700,
              color: brand.textDark,
              letterSpacing: '-0.01em',
            }}
          >
            {title}
          </h1>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Search bar - desktop */}
          <Button
            variant="outline"
            className="hidden sm:flex relative h-9 w-64 justify-start text-sm shadow-none"
            onClick={() => setSearchOpen(true)}
            style={{
              backgroundColor: '#FFFFFF',
              color: brand.textMuted,
              borderColor: brand.borderLight,
              fontFamily: 'Barlow, sans-serif',
            }}
          >
            <Search className="mr-2 h-4 w-4" style={{ color: brand.textMuted }} />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd
              className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium sm:flex"
              style={{
                borderColor: brand.borderLight,
                backgroundColor: brand.warmBg,
                color: brand.textMuted,
              }}
            >
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          {/* Search icon - mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            className="sm:hidden h-10 w-10"
            aria-label="Buscar"
            style={{ color: brand.textMuted }}
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Super Admin */}
          {isSuperAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:flex relative h-10 w-10"
                  onClick={() => navigate('/super-admin')}
                  style={{ color: brand.textMuted }}
                >
                  <Shield className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Panel Super Admin</TooltipContent>
            </Tooltip>
          )}

          <NotificationBell />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 transition-all hover:ring-2" style={{ '--tw-ring-color': brand.gold } as any}>
                <Avatar className="h-9 w-9 shadow-sm" style={{ border: `2px solid ${brand.borderLight}` }}>
                  <AvatarFallback
                    className="text-xs font-semibold"
                    style={{
                      backgroundColor: brand.gold,
                      color: brand.navy,
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 700,
                    }}
                  >
                    {getInitials(profile?.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col space-y-1.5">
                  <p
                    className="text-sm leading-none"
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 700,
                      color: brand.textDark,
                    }}
                  >
                    {profile?.name || 'Usuario'}
                  </p>
                  <p
                    className="text-xs leading-none"
                    style={{
                      fontFamily: 'Barlow, sans-serif',
                      color: brand.textMuted,
                    }}
                  >
                    {displayRoleLabel(displayRole)}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem 
                onClick={() => navigate('/settings')}
                className="gap-2.5 py-2.5 px-3 cursor-pointer rounded-lg"
                style={{ fontFamily: 'Barlow, sans-serif' }}
              >
                <Settings className="h-4 w-4" style={{ color: brand.textMuted }} />
                <span>Ajustes</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem 
                onClick={signOut} 
                className="gap-2.5 py-2.5 px-3 cursor-pointer rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10"
                style={{ fontFamily: 'Barlow, sans-serif' }}
              >
                <LogOut className="h-4 w-4" />
                <span>Cerrar sesión</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <GlobalSearchPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
}
