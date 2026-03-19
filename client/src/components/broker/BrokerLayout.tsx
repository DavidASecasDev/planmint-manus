import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { BrokerThemeProvider, useBrokerTheme } from '@/contexts/BrokerThemeContext';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LogOut, Ship, Plus, Sun, Moon, Monitor } from 'lucide-react';

interface BrokerLayoutProps {
  children: React.ReactNode;
}

function ThemeToggle() {
  const { theme, setTheme } = useBrokerTheme();

  const cycle = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  const label =
    theme === 'light' ? 'Tema: Claro' : theme === 'dark' ? 'Tema: Oscuro' : 'Tema: Sistema';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={cycle}
          className="text-white/90 hover:text-white hover:bg-white/10 h-9 w-9"
          aria-label={label}
        >
          {theme === 'light' && <Sun className="h-4 w-4" />}
          {theme === 'dark' && <Moon className="h-4 w-4" />}
          {theme === 'system' && <Monitor className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function BrokerLayoutInner({ children }: BrokerLayoutProps) {
  const { broker, logout } = useBrokerAuth();
  const { resolvedTheme } = useBrokerTheme();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during broker logout:', error);
    }
    navigate('/broker/login');
  };

  const isDark = resolvedTheme === 'dark';

  return (
    <TooltipProvider>
      <div
        className={`${resolvedTheme} min-h-screen flex flex-col`}
        style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc' }}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-50 shadow-lg"
          style={{ backgroundColor: '#1a365d' }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* Logo / Brand */}
              <Link to="/broker" className="flex items-center gap-3">
                {broker?.organization_logo ? (
                  <img
                    src={broker.organization_logo}
                    alt={broker.organization_name}
                    className="h-8 w-auto"
                  />
                ) : (
                  <Ship className="h-8 w-8 text-white" />
                )}
                <div className="hidden sm:block">
                  <span className="text-white font-semibold text-lg">
                    {broker?.organization_name || 'Portal de Broker'}
                  </span>
                </div>
              </Link>

              {/* Right side */}
              <div className="flex items-center gap-2">
                <Link to="/broker/new">
                  <Button
                    size="sm"
                    className="hidden sm:flex"
                    style={{
                      backgroundColor: '#b8860b',
                      color: 'white',
                      border: 'none',
                    }}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nueva Solicitud
                  </Button>
                  <Button
                    size="icon"
                    className="sm:hidden"
                    style={{
                      backgroundColor: '#b8860b',
                      color: 'white',
                      border: 'none',
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>

                <div className="hidden md:flex items-center gap-2 text-white/90 text-sm px-2">
                  <span>Hola,</span>
                  <span className="font-medium text-white">{broker?.name}</span>
                </div>

                <ThemeToggle />

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLogout}
                  className="text-white/90 hover:text-white hover:bg-white/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Salir</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Gold accent line */}
          <div className="h-1" style={{ backgroundColor: '#b8860b' }} />
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer
          className="py-4 text-center text-sm"
          style={{ backgroundColor: '#1a365d', color: 'rgba(255,255,255,0.8)' }}
        >
          <div className="max-w-7xl mx-auto px-4">
            <p>
              © {new Date().getFullYear()}{' '}
              {broker?.organization_name || 'Transfer Management'}. Todos los derechos reservados.
            </p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}

export function BrokerLayout({ children }: BrokerLayoutProps) {
  return (
    <BrokerThemeProvider>
      <BrokerLayoutInner>{children}</BrokerLayoutInner>
    </BrokerThemeProvider>
  );
}
