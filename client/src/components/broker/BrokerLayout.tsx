import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useBrokerAuth } from '@/contexts/BrokerAuthContext';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { LogOut, Plus } from 'lucide-react';
import { BrokerNotificationBell } from '@/components/broker/BrokerNotificationBell';

interface BrokerLayoutProps {
  children: React.ReactNode;
}

export function BrokerLayout({ children }: BrokerLayoutProps) {
  const { broker, logout } = useBrokerAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error during broker logout:', error);
    }
    navigate('/broker/login');
  };

  return (
    <TooltipProvider>
      <div
        className="min-h-screen flex flex-col"
        style={{ backgroundColor: '#0D1117', color: '#E6EDF3' }}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-50"
          style={{
            backgroundColor: 'rgba(13, 17, 23, 0.95)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(163, 230, 53, 0.15)',
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
                  <div
                    className="h-9 w-9 rounded-lg flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: '#A3E635', color: '#0D1117' }}
                  >
                    AC
                  </div>
                )}
                <div className="hidden sm:block">
                  <span
                    className="font-semibold text-lg tracking-tight"
                    style={{ color: '#E6EDF3' }}
                  >
                    {broker?.organization_name || 'Portal de Broker'}
                  </span>
                </div>
              </Link>

              {/* Right side */}
              <div className="flex items-center gap-2">
                <Link to="/broker/new">
                  <Button
                    size="sm"
                    className="hidden sm:flex gap-2 font-semibold uppercase text-xs tracking-wider transition-all hover:brightness-110"
                    style={{
                      backgroundColor: '#A3E635',
                      color: '#0D1117',
                      border: 'none',
                    }}
                  >
                    <Plus className="h-4 w-4" />
                    Nueva Solicitud
                  </Button>
                  <Button
                    size="icon"
                    className="sm:hidden"
                    style={{
                      backgroundColor: '#A3E635',
                      color: '#0D1117',
                      border: 'none',
                    }}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>

                <div
                  className="hidden md:flex items-center gap-2 text-sm px-3"
                  style={{ color: 'rgba(230, 237, 243, 0.7)' }}
                >
                  <span>Hola,</span>
                  <span className="font-medium" style={{ color: '#E6EDF3' }}>
                    {broker?.name}
                  </span>
                </div>

                <BrokerNotificationBell />

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleLogout}
                      className="transition-colors"
                      style={{ color: 'rgba(230, 237, 243, 0.7)' }}
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline text-xs uppercase tracking-wider">
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

          {/* Green accent line */}
          <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, #A3E635, #65A30D, #A3E635)' }} />
        </header>

        {/* Main Content */}
        <main className="flex-1">{children}</main>

        {/* Footer */}
        <footer
          className="py-4 text-center text-xs uppercase tracking-wider"
          style={{
            backgroundColor: '#0D1117',
            color: 'rgba(230, 237, 243, 0.4)',
            borderTop: '1px solid rgba(163, 230, 53, 0.1)',
          }}
        >
          <div className="max-w-7xl mx-auto px-4">
            <p>
              © {new Date().getFullYear()}{' '}
              {broker?.organization_name || 'Transfer Management'}. Todos los
              derechos reservados.
            </p>
          </div>
        </footer>
      </div>
    </TooltipProvider>
  );
}
