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

/*
 * Azul Cars Brand Tokens
 * Nav/Header: #001321 (dark navy)
 * Gold accent: oklch(0.72 0.10 80) ≈ #C9A96E
 * Body bg: #F5F3EF (warm off-white)
 * Card bg: #FFFFFF
 * Headings: Montserrat 700-900
 * Body: Barlow 400-600
 * Labels: Montserrat 700, uppercase, tracking 1.5px
 * Text dark: #0F1216
 * Text muted: #52555B
 */

const brand = {
  navy: '#001321',
  navyLight: '#0A1E30',
  gold: 'oklch(0.72 0.10 80)',
  goldHover: 'oklch(0.78 0.10 80)',
  warmBg: '#F5F3EF',
  white: '#FFFFFF',
  textDark: '#0F1216',
  textMuted: '#52555B',
  textOnDark: '#FFFFFF',
  textOnDarkMuted: 'rgba(255,255,255,0.65)',
  borderLight: 'rgba(0,19,33,0.08)',
};

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
        style={{
          backgroundColor: brand.warmBg,
          color: brand.textDark,
          fontFamily: 'Barlow, sans-serif',
        }}
      >
        {/* Header - dark navy like azulcars.com */}
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
                      color: brand.textOnDark,
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
                      color: brand.textOnDarkMuted,
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
                    color: brand.textOnDarkMuted,
                    fontFamily: 'Barlow, sans-serif',
                  }}
                >
                  <span>Hola,</span>
                  <span style={{ color: brand.textOnDark, fontWeight: 600 }}>
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
                      className="transition-colors hover:bg-white/10"
                      style={{ color: brand.textOnDarkMuted }}
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

          {/* Gold accent line - like the Azul Cars nav bottom */}
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
            color: brand.textOnDarkMuted,
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
