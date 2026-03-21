/*
 * Azul Cars Brand — Broker Layout
 * Dark mode: uses CSS variables via .dark class on <html>
 * Header: always dark navy (brand identity)
 * Body: bg-background (warm off-white / deep navy)
 * Gold accent: oklch(0.72 0.10 80)
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { useBrokerTheme } from '@/contexts/BrokerThemeContext';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LogOut, Plus, Sun, Moon, Monitor } from 'lucide-react';
import { BrokerNotificationBell } from '@/components/broker/BrokerNotificationBell';

const brand = {
  navy: '#001321',
  gold: 'oklch(0.72 0.10 80)',
  goldHover: 'oklch(0.78 0.10 80)',
};

interface BrokerLayoutProps {
  children: React.ReactNode;
}

export function BrokerLayout({ children }: BrokerLayoutProps) {
  const { broker, logout } = useBrokerAuth();
  const { theme, resolvedTheme, setTheme } = useBrokerTheme();
  const navigate = useNavigate();
  const isDark = resolvedTheme === 'dark';

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during broker logout:', error);
    }
    navigate('/broker/login');
  };

  const themeOptions = [
    { value: 'light' as const, label: 'Claro', icon: Sun },
    { value: 'dark' as const, label: 'Oscuro', icon: Moon },
    { value: 'system' as const, label: 'Sistema', icon: Monitor },
  ];

  return (
    <TooltipProvider>
      <div
        className="min-h-screen flex flex-col bg-background text-foreground"
        style={{ fontFamily: 'Barlow, sans-serif' }}
      >
        {/* Header - always dark navy (brand identity) */}
        <header
          className="sticky top-0 z-50"
          style={{
            backgroundColor: brand.navy,
            borderBottom: 'none',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo / Brand */}
              <Link to="/broker" className="flex items-center gap-3 group">
                {broker?.organization_logo ? (
                  <img
                    src={broker.organization_logo}
                    alt={broker.organization_name}
                    className="h-8 w-auto"
                  />
                ) : (
                  <span
                    className="text-xl tracking-tight"
                    style={{
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 800,
                      color: '#FFFFFF',
                      letterSpacing: '-0.02em',
                    }}
                  >
                    AZUL<span style={{ color: brand.gold }}>.</span>
                  </span>
                )}
                <div className="hidden sm:block">
                  <span
                    className="text-sm"
                    style={{
                      fontFamily: 'Barlow, sans-serif',
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.65)',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase' as const,
                    }}
                  >
                    Portal Transfers
                  </span>
                </div>
              </Link>

              {/* Right side */}
              <div className="flex items-center gap-2 sm:gap-3">
                <Link to="/broker/new">
                  <Button
                    size="sm"
                    className="hidden sm:flex gap-2 transition-all hover:brightness-110"
                    style={{
                      backgroundColor: brand.gold,
                      color: brand.navy,
                      border: 'none',
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 700,
                      fontSize: '11px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const,
                      borderRadius: '4px',
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Nueva Solicitud
                  </Button>
                  <Button
                    size="icon"
                    className="sm:hidden"
                    style={{
                      backgroundColor: brand.gold,
                      color: brand.navy,
                      border: 'none',
                      borderRadius: '4px',
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>

                <div
                  className="hidden md:flex items-center gap-2 text-sm px-3"
                  style={{
                    color: 'rgba(255,255,255,0.65)',
                    fontFamily: 'Barlow, sans-serif',
                  }}
                >
                  <span>Hola,</span>
                  <span style={{ color: '#FFFFFF', fontWeight: 600 }}>
                    {broker?.name}
                  </span>
                </div>

                <BrokerNotificationBell />

                {/* Theme Toggle */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 transition-colors hover:bg-white/10"
                      style={{ color: 'rgba(255,255,255,0.8)' }}
                      aria-label="Cambiar tema"
                    >
                      <Sun className="h-[1.1rem] w-[1.1rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                      <Moon className="absolute h-[1.1rem] w-[1.1rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[140px]">
                    {themeOptions.map(({ value, label, icon: Icon }) => (
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

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="transition-colors hover:bg-white/10"
                      style={{ color: 'rgba(255,255,255,0.65)' }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      <span
                        className="hidden sm:inline"
                        style={{
                          fontFamily: 'Montserrat, sans-serif',
                          fontWeight: 600,
                          fontSize: '10px',
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase' as const,
                        }}
                      >
                        Salir
                      </span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Cerrar sesión</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
          </div>

          {/* Gold accent line */}
          <div
            className="h-[2px]"
            style={{
              background: `linear-gradient(90deg, transparent, ${brand.gold}, transparent)`,
            }}
          />
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer
          className="py-6 text-center"
          style={{
            backgroundColor: brand.navy,
            color: 'rgba(255,255,255,0.65)',
            fontFamily: 'Barlow, sans-serif',
            fontSize: '13px',
          }}
        >
          <div className="max-w-7xl mx-auto px-4">
            <p style={{ letterSpacing: '0.05em' }}>
              © {new Date().getFullYear()}{' '}
              {broker?.organization_name || 'Azul Cars'}. Todos los derechos
              reservados.
            </p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
