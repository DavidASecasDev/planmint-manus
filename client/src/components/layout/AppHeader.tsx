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

  // Global keyboard shortcut for search
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

  // Use role from organization_members (via usePermissions) with fallback
  const displayRole = role;

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 backdrop-blur-xl px-4 md:px-6">
        {/* Left: Hamburger (mobile) + Title */}
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="md:hidden h-10 w-10 shrink-0"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          {/* Search bar - hidden on mobile, visible on sm+ */}
          <Button
            variant="outline"
            className="hidden sm:flex relative h-10 w-72 justify-start text-sm text-muted-foreground bg-muted/40 border-border/50 hover:bg-muted/60 hover:border-border transition-colors shadow-sm"
            onClick={() => setSearchOpen(true)}
          >
            <Search className="mr-2.5 h-4 w-4" />
            <span className="flex-1 text-left">Buscar...</span>
            <kbd className="pointer-events-none hidden h-6 select-none items-center gap-1 rounded-md border border-border/80 bg-background px-2 font-mono text-[11px] font-medium text-muted-foreground sm:flex shadow-sm">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          {/* Search icon - only on mobile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            className="sm:hidden h-10 w-10"
            aria-label="Buscar"
          >
            <Search className="h-5 w-5" />
          </Button>

          {/* Super Admin (hidden on mobile) */}
          {isSuperAdmin && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="hidden sm:flex relative h-10 w-10 text-muted-foreground hover:text-primary"
                  onClick={() => navigate('/super-admin')}
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
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:ring-2 hover:ring-primary/20 transition-all">
                <Avatar className="h-10 w-10 ring-2 ring-border shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-semibold">
                    {getInitials(profile?.name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-64 p-2" align="end" forceMount>
              <DropdownMenuLabel className="font-normal p-3">
                <div className="flex flex-col space-y-1.5">
                  <p className="text-sm font-semibold leading-none">{profile?.name || 'Usuario'}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {displayRoleLabel(displayRole)}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem 
                onClick={() => navigate('/settings')}
                className="gap-2.5 py-2.5 px-3 cursor-pointer rounded-lg"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Ajustes</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuItem 
                onClick={signOut} 
                className="gap-2.5 py-2.5 px-3 cursor-pointer rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10"
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
