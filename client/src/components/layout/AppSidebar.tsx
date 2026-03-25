/*
 * Azul Cars Brand — Sidebar
 * Background: #001321 (dark navy) via --sidebar-background
 * Active item: gold oklch(0.72 0.10 80) via --sidebar-primary
 * Text: white on navy | Muted: rgba(255,255,255,0.55)
 * Headings: Montserrat | Body: Barlow
 * Labels: Montserrat 700, uppercase, tracking 0.1em
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, ChevronLeft, ChevronRight, ChevronDown, LogOut, Layers, ClipboardList, Tag, Bell, Columns, CalendarDays, MessageSquare, Zap, LayoutTemplate, BarChart3, Shield, CarFront, Timer, FileText, Car, BookOpen, Wrench, Hammer, AlertTriangle, Building2, FileSpreadsheet, Ship, Plus, ClipboardCheck, Route, Warehouse } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { DockContainer, DockItem } from '@/components/ui/dock-sidebar';
import { usePermissions } from '@/hooks/usePermissions';
import { useOrganizationModules, ModuleKey, OPTIONAL_MODULES } from '@/hooks/useOrganizationModules';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { FeedbackModal } from '@/components/feedback/FeedbackModal';

import { PermissionKey } from '@/hooks/usePermissions';

// Map menu items to their module keys (only for optional modules)
const MENU_MODULE_MAP: Record<string, ModuleKey> = {
  '/reservations': 'reservations',
  '/automations': 'automations',
  '/reports': 'reports',
  '/templates': 'templates',
  '/teams': 'teams',
  '/time-tracking': 'time_tracking',
  '/vehicles': 'vehicle_status',
  '/tasks/daily': 'daily_tasks',
  '/garatech': 'garatech',
  '/garatech/repairs': 'garatech',
  '/garatech/accidents': 'garatech',
  '/garatech/workshops': 'garatech',
  '/garatech/catalog': 'garatech',
  '/garatech/reports': 'garatech',
  '/transfers': 'transfers',
  '/transfers/new': 'transfers',
  '/transfers/brokers': 'transfers',
  '/transfers/forms': 'transfers',
  '/movements': 'movements',
  '/fleet': 'fleet',
  '/fleet/audits': 'fleet',
  '/fleet/damages': 'garatech',
  '/garatech/damages': 'garatech',
};

// Garatech submenu items with permission gates
const garatechSubItems = [
  { title: 'Dashboard', url: '/garatech', icon: LayoutDashboard },
  { title: 'Reparaciones', url: '/garatech/repairs', icon: Hammer },
  { title: 'Accidentes', url: '/garatech/accidents', icon: AlertTriangle, permission: 'garatech.manage_accidents' as const },
  { title: 'Talleres', url: '/garatech/workshops', icon: Building2 },
  { title: 'Daños y Cobros', url: '/garatech/damages', icon: AlertTriangle },
];

// Transfers submenu items
const transfersSubItems = [
  { title: 'Solicitudes', url: '/transfers', icon: Ship },
  { title: 'Nueva Solicitud', url: '/transfers/new', icon: Plus, permission: 'transfers.create' as const },
  { title: 'Gestión Brokers', url: '/transfers/brokers', icon: Users, permission: 'transfers.manage_brokers' as const },
  { title: 'Formularios', url: '/transfers/forms', icon: FileText },
];

// Fleet submenu items
const fleetSubItems = [
  { title: 'Vehículos', url: '/fleet', icon: Warehouse },
  { title: 'Auditorías', url: '/fleet/audits', icon: ClipboardCheck },
];

// Tasks submenu items
const tasksSubItems = [
  { title: 'Lista', url: '/tasks', icon: ClipboardList },
  { title: 'Kanban', url: '/tasks/kanban', icon: Columns },
  { title: 'Calendario', url: '/tasks/calendar', icon: CalendarDays },
  { title: 'Tareas Diarias', url: '/tasks/daily', icon: ClipboardCheck },
];

// Map menu items to required permissions
const MENU_PERMISSION_MAP: Partial<Record<string, PermissionKey>> = {
  '/tasks': 'tasks.view',
  '/tasks/kanban': 'tasks.view',
  '/tasks/calendar': 'tasks.view',
  '/areas': 'areas.view',
  '/tags': 'tags.view',
  '/automations': 'automations.view',
  '/templates': 'templates.view',
  '/teams': 'teams.view',
  '/time-tracking': 'time_tracking.view',
  '/vehicles': 'vehicles.view',
  '/reports': 'reports.view',
  '/reservations': 'reservations.view',
  '/reminders': 'tasks.view',
  '/movements': 'movements.view',
  '/tasks/daily': 'daily_tasks.view',
  '/fleet': 'fleet.view',
};

const menuItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Tiempo', url: '/time-tracking', icon: Timer },
  { title: 'Reservas', url: '/reservations', icon: CarFront },
  { title: 'Estado Coches', url: '/vehicles', icon: Car },
  { title: 'Movimientos', url: '/movements', icon: Route },
  { title: 'Recordatorios', url: '/reminders', icon: Bell },
  { title: 'Áreas', url: '/areas', icon: Layers },
  { title: 'Etiquetas', url: '/tags', icon: Tag },
  { title: 'Automatizaciones', url: '/automations', icon: Zap },
  { title: 'Plantillas', url: '/templates', icon: LayoutTemplate },
  { title: 'Reportes', url: '/reports', icon: BarChart3 },
  { title: 'Teams', url: '/teams', icon: Users },
  { title: 'Ajustes', url: '/settings', icon: Settings },
];

/* ── Inline style constants for navy sidebar ── */
const navyBg = '#001321';
const navyLight = '#0A1E30';
const goldAccent = 'oklch(0.72 0.10 80)';
const textWhite = '#FFFFFF';
const textMuted = 'rgba(255,255,255,0.55)';
const borderColor = 'rgba(255,255,255,0.08)';

export function AppSidebar() {
  const { profile, organization, signOut } = useAuth();
  const { role, canAccessAdminPanel, hasPermission, isManager, isLoading: permissionsLoading } = usePermissions();
  const { isModuleEnabled, isLoading: modulesLoading } = useOrganizationModules();

  // CRITICAL: While auth/permissions/modules are still loading, show ALL menu items
  // to prevent the sidebar from flickering or showing a reduced set of items.
  // Once loading completes, the real filter will apply.
  const dataReady = !permissionsLoading && !modulesLoading;
  const { state, toggleSidebar, isMobile, setOpenMobile } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === 'collapsed';
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [garatechOpen, setGaratechOpen] = useState(location.pathname.startsWith('/garatech'));
  const [transfersOpen, setTransfersOpen] = useState(location.pathname.startsWith('/transfers'));
  const [tasksOpen, setTasksOpen] = useState(location.pathname.startsWith('/tasks'));
  const [fleetOpen, setFleetOpen] = useState(location.pathname.startsWith('/fleet'));

  const isGaratechActive = location.pathname.startsWith('/garatech');
  const isTransfersActive = location.pathname.startsWith('/transfers');
  const isTasksActive = location.pathname.startsWith('/tasks');
  const isFleetActive = location.pathname.startsWith('/fleet');

  // Auto-close sidebar on mobile when navigating
  useEffect(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [location.pathname, isMobile, setOpenMobile]);

  useEffect(() => {
    if (location.pathname.startsWith('/garatech')) setGaratechOpen(true);
    if (location.pathname.startsWith('/transfers')) setTransfersOpen(true);
    if (location.pathname.startsWith('/tasks')) setTasksOpen(true);
    if (location.pathname.startsWith('/fleet')) setFleetOpen(true);
  }, [location.pathname]);

  const filteredMenuItems = useMemo(() => {
    // While data is loading, show all menu items to prevent sidebar flicker
    if (!dataReady) return menuItems;
    return menuItems.filter((item) => {
      const requiredPermission = MENU_PERMISSION_MAP[item.url];
      if (requiredPermission && !hasPermission(requiredPermission)) return false;
      const moduleKey = MENU_MODULE_MAP[item.url] || 
        Object.entries(MENU_MODULE_MAP).find(([path]) => item.url.startsWith(path + '/'))?.[1];
      if (moduleKey && OPTIONAL_MODULES.includes(moduleKey)) return isModuleEnabled(moduleKey);
      return true;
    });
  }, [isModuleEnabled, hasPermission, dataReady]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (r: string | null | undefined) => {
    if (!r) return '';
    const roleLabels: Record<string, string> = {
      owner: 'Owner', admin: 'Admin', manager: 'Manager',
      member: 'Miembro', read_only: 'Solo lectura'
    };
    return roleLabels[r] || r;
  };

  const displayRole = role;

  /* ── Shared style helpers ── */
  const menuItemBase = cn(
    "group flex items-center text-sm transition-all duration-150",
    isCollapsed ? "justify-center !p-0" : "gap-3 px-3",
    // Larger touch targets on mobile (min 44px)
    isCollapsed ? "" : (isMobile ? "py-3.5" : "py-2.5")
  );

  const menuItemDefault = {
    color: textMuted,
    fontFamily: 'Barlow, sans-serif',
    fontWeight: 500,
    borderRadius: '6px',
  };

  const menuItemHover = {
    backgroundColor: navyLight,
    color: textWhite,
  };

  const menuItemActive = {
    backgroundColor: goldAccent,
    color: navyBg,
    fontWeight: 600,
  };

  const subItemActive = {
    backgroundColor: 'rgba(201,169,110,0.15)',
    color: goldAccent,
  };

  /* ── Collapsible menu renderer ── */
  const renderCollapsibleMenu = (
    label: string,
    icon: React.ElementType,
    isOpen: boolean,
    setOpen: (v: boolean) => void,
    isActive: boolean,
    subItems: Array<{ title: string; url: string; icon: React.ElementType; permission?: string }>,
    filterFn?: (item: any) => boolean,
  ) => {
    const Icon = icon;
    return (
      <Collapsible open={isOpen} onOpenChange={setOpen} className="mt-0.5">
        <DockItem>
          <Tooltip>
            <TooltipTrigger asChild>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton
                  className={menuItemBase}
                  style={{
                    ...menuItemDefault,
                    ...(isActive ? { color: goldAccent, backgroundColor: 'rgba(201,169,110,0.08)' } : {}),
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      Object.assign(e.currentTarget.style, menuItemHover);
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = isActive ? 'rgba(201,169,110,0.08)' : 'transparent';
                      e.currentTarget.style.color = isActive ? goldAccent : textMuted;
                    }
                  }}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-left">{label}</span>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        isOpen && "rotate-180"
                      )} style={{ color: 'inherit' }} />
                    </>
                  )}
                </SidebarMenuButton>
              </CollapsibleTrigger>
            </TooltipTrigger>
            {isCollapsed && (
              <TooltipContent side="right" className="font-medium">{label}</TooltipContent>
            )}
          </Tooltip>
        </DockItem>
        {!isCollapsed && (
          <CollapsibleContent className="overflow-hidden data-[state=open]:animate-sidebar-expand data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-150">
            <SidebarMenuSub
              className="ml-4 mt-1 space-y-0.5 pl-3"
              style={{ borderLeft: `1px solid ${borderColor}` }}
            >
              {subItems
                .filter(filterFn || (() => true))
                .map((subItem, subIndex) => {
                  const isSubActive = location.pathname === subItem.url;
                  return (
                    <SidebarMenuSubItem
                      key={subItem.url}
                      className="opacity-0 animate-sidebar-fade-in"
                      style={{ animationDelay: `${subIndex * 40 + 50}ms` }}
                    >
                      <SidebarMenuSubButton asChild isActive={isSubActive}>
                        <NavLink
                          to={subItem.url}
                          className={cn("flex items-center gap-2 px-2 text-sm transition-colors", isMobile ? "py-3" : "py-1.5")}
                          style={{
                            color: isSubActive ? goldAccent : textMuted,
                            backgroundColor: isSubActive ? 'rgba(201,169,110,0.12)' : 'transparent',
                            borderRadius: '4px',
                            fontFamily: 'Barlow, sans-serif',
                            fontWeight: isSubActive ? 600 : 400,
                          }}
                          activeClassName=""
                        >
                          <subItem.icon className={cn(isMobile ? "h-5 w-5" : "h-4 w-4")} />
                          <span>{subItem.title}</span>
                        </NavLink>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  );
                })}
            </SidebarMenuSub>
          </CollapsibleContent>
        )}
      </Collapsible>
    );
  };

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar
        collapsible="icon"
        className="border-r"
        style={{
          backgroundColor: navyBg,
          borderColor: borderColor,
        }}
      >
        {/* ── Header ── */}
        <SidebarHeader
          className="p-4 group-data-[collapsible=icon]:p-2 animate-sidebar-fade-in"
          style={{ borderBottom: `1px solid ${borderColor}` }}
        >
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
            {!isCollapsed && (
              <div className="flex items-center gap-3">
                <span
                  className="text-xl tracking-tight"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 800,
                    color: textWhite,
                    letterSpacing: '-0.02em',
                  }}
                >
                  AZUL<span style={{ color: goldAccent }}>.</span>
                </span>
                <span
                  className="text-[10px]"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
                    color: textMuted,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}
                >
                  Manager
                </span>
              </div>
            )}
            {/* Hide collapse button on mobile — Sheet handles open/close */}
            {!isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="h-8 w-8 transition-colors"
                    style={{ color: textMuted }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = textWhite; e.currentTarget.style.backgroundColor = navyLight; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = textMuted; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {isCollapsed ? 'Expandir' : 'Colapsar'}
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </SidebarHeader>

        {/* ── Gold accent line ── */}
        <div
          className="h-[2px]"
          style={{ background: `linear-gradient(90deg, transparent, ${goldAccent}, transparent)` }}
        />

        {/* ── Content ── */}
        <SidebarContent className="px-3 py-4 group-data-[collapsible=icon]:px-0">
          <SidebarGroup>
            <SidebarGroupLabel
              className={cn(
                "mb-2 px-3",
                isCollapsed && "sr-only"
              )}
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
                fontSize: '10px',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'rgba(255,255,255,0.35)',
              }}
            >
              Menú principal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
              <DockContainer>
                {filteredMenuItems.map((item, index) => {
                  const isItemActive = location.pathname === item.url ||
                    (item.url !== '/dashboard' && location.pathname.startsWith(item.url + '/'));

                  return (
                    <SidebarMenuItem
                      key={item.title}
                      className="opacity-0 animate-sidebar-item-in"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {/* Only the link button gets the dock magnification */}
                      <DockItem>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="w-full">
                              <SidebarMenuButton asChild>
                                <NavLink
                                  to={item.url}
                                  className={menuItemBase}
                                  style={{
                                    ...menuItemDefault,
                                    ...(isItemActive ? menuItemActive : {}),
                                  }}
                                  activeClassName=""
                                >
                                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                                  {!isCollapsed && <span>{item.title}</span>}
                                </NavLink>
                              </SidebarMenuButton>
                            </span>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right" className="font-medium">
                              {item.title}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </DockItem>

                      {/* Collapsible sub-menus are OUTSIDE DockItem so they don't scale */}
                      {item.url === '/dashboard' && renderCollapsibleMenu(
                        'Tareas', ClipboardList, tasksOpen, setTasksOpen, isTasksActive,
                        tasksSubItems,
                        (subItem) => {
                          const moduleKey = MENU_MODULE_MAP[subItem.url];
                          if (moduleKey && OPTIONAL_MODULES.includes(moduleKey)) return isModuleEnabled(moduleKey);
                          return true;
                        }
                      )}

                      {item.url === '/vehicles' && (!dataReady || (isModuleEnabled('transfers') && hasPermission('transfers.view'))) &&
                        renderCollapsibleMenu(
                          'Transfers', Ship, transfersOpen, setTransfersOpen, isTransfersActive,
                          transfersSubItems,
                          (subItem) => {
                            if (!dataReady) return true;
                            if ('permission' in subItem && subItem.permission) return hasPermission(subItem.permission);
                            return true;
                          }
                        )
                      }

                      {item.url === '/vehicles' && (!dataReady || (isModuleEnabled('garatech') && hasPermission('garatech.view'))) &&
                        renderCollapsibleMenu(
                          'Garatech', Wrench, garatechOpen, setGaratechOpen, isGaratechActive,
                          garatechSubItems,
                          (subItem) => {
                            if (!dataReady) return true;
                            if ('permission' in subItem && subItem.permission) return hasPermission(subItem.permission);
                            return true;
                          }
                        )
                      }

                      {item.url === '/movements' && (!dataReady || (isModuleEnabled('fleet') && hasPermission('fleet.view'))) &&
                        renderCollapsibleMenu(
                          'Flota', Warehouse, fleetOpen, setFleetOpen, isFleetActive,
                          fleetSubItems,
                        )
                      }
                    </SidebarMenuItem>
                  );
                })}
                
                {/* Admin Panel */}
                {canAccessAdminPanel && (
                  <SidebarMenuItem>
                    <DockItem>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="w-full">
                            <SidebarMenuButton asChild>
                              <NavLink
                                to="/settings/admin"
                                className={menuItemBase}
                                style={{
                                  ...menuItemDefault,
                                  ...(location.pathname.startsWith('/settings/admin') ? menuItemActive : {}),
                                }}
                                activeClassName=""
                              >
                                <Shield className="h-[18px] w-[18px] shrink-0" />
                                {!isCollapsed && <span>Administración</span>}
                              </NavLink>
                            </SidebarMenuButton>
                          </span>
                        </TooltipTrigger>
                        {isCollapsed && (
                          <TooltipContent side="right" className="font-medium">
                            Administración
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </DockItem>
                  </SidebarMenuItem>
                )}

                {/* Ayuda */}
                <SidebarMenuItem>
                  <DockItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full">
                          <SidebarMenuButton asChild>
                            <NavLink
                              to="/help"
                              className={menuItemBase}
                              style={{
                                ...menuItemDefault,
                                ...(location.pathname === '/help' ? menuItemActive : {}),
                              }}
                              activeClassName=""
                            >
                              <BookOpen className="h-[18px] w-[18px] shrink-0" />
                              {!isCollapsed && <span>Ayuda</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </span>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right" className="font-medium">
                          Ayuda
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </DockItem>
                </SidebarMenuItem>
              </DockContainer>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ── Footer ── */}
        <SidebarFooter
          className="p-4 group-data-[collapsible=icon]:p-2 animate-sidebar-fade-in"
          style={{ borderTop: `1px solid ${borderColor}`, animationDelay: '200ms' }}
        >
          {!isCollapsed ? (
            <div className="space-y-4">
              {/* Feedback */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFeedbackOpen(true)}
                className={cn("w-full gap-2 transition-colors", isMobile && "h-11")}
                style={{
                  color: textMuted,
                  borderColor: borderColor,
                  backgroundColor: 'transparent',
                  fontFamily: 'Barlow, sans-serif',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = textWhite; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = textMuted; e.currentTarget.style.borderColor = borderColor; }}
              >
                <MessageSquare className="h-4 w-4" />
                Enviar feedback
              </Button>

              {/* Organization */}
              <div
                className="rounded-lg p-3"
                style={{ backgroundColor: navyLight }}
              >
                <p
                  className="mb-1"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  Organización
                </p>
                <p
                  className="truncate text-sm"
                  style={{
                    fontFamily: 'Barlow, sans-serif',
                    fontWeight: 600,
                    color: textWhite,
                  }}
                >
                  {organization?.name || 'Sin organización'}
                </p>
              </div>
              
              {/* User */}
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 shadow-sm" style={{ border: `2px solid ${borderColor}` }}>
                  <AvatarFallback
                    className="text-sm font-semibold"
                    style={{
                      backgroundColor: goldAccent,
                      color: navyBg,
                      fontFamily: 'Montserrat, sans-serif',
                      fontWeight: 700,
                    }}
                  >
                    {getInitials(profile?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate text-sm"
                    style={{
                      fontFamily: 'Barlow, sans-serif',
                      fontWeight: 600,
                      color: textWhite,
                    }}
                  >
                    {profile?.name || 'Usuario'}
                  </p>
                  <p
                    className="text-xs"
                    style={{
                      fontFamily: 'Barlow, sans-serif',
                      color: textMuted,
                    }}
                  >
                    {getRoleBadge(displayRole)}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={signOut}
                      className={cn("transition-colors", isMobile ? "h-11 w-11" : "h-9 w-9")}
                      style={{ color: textMuted }}
                      onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.color = textMuted; e.currentTarget.style.backgroundColor = 'transparent'; }}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Cerrar sesión</TooltipContent>
                </Tooltip>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFeedbackOpen(true)}
                    className="h-8 w-8 transition-colors"
                    style={{ color: textMuted }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = textWhite; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = textMuted; }}
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Enviar feedback</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-9 w-9 shadow-sm cursor-pointer" style={{ border: `2px solid ${borderColor}` }}>
                    <AvatarFallback
                      className="text-xs font-semibold"
                      style={{
                        backgroundColor: goldAccent,
                        color: navyBg,
                        fontFamily: 'Montserrat, sans-serif',
                        fontWeight: 700,
                      }}
                    >
                      {getInitials(profile?.name)}
                    </AvatarFallback>
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div>
                    <p className="font-medium">{profile?.name || 'Usuario'}</p>
                    <p className="text-xs text-muted-foreground">{getRoleBadge(displayRole)}</p>
                  </div>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={signOut}
                    className="h-8 w-8 transition-colors"
                    style={{ color: textMuted }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = textMuted; e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Cerrar sesión</TooltipContent>
              </Tooltip>
            </div>
          )}
        </SidebarFooter>

        <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      </Sidebar>
    </TooltipProvider>
  );
}
