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
import { LayoutDashboard, Users, Settings, ChevronLeft, ChevronRight, ChevronDown, LogOut, Layers, ClipboardList, Tag, Bell, Columns, CalendarDays, MessageSquare, Zap, LayoutTemplate, BarChart3, Shield, CarFront, Timer, FileText, Car, BookOpen, Wrench, Hammer, AlertTriangle, Building2, FileSpreadsheet, Ship, Plus, ClipboardCheck, Route, Warehouse, Baby, ArrowLeftRight, CalendarClock } from 'lucide-react';
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
import { OrgSwitcher } from '@/components/layout/OrgSwitcher';
import { usePrefetch } from '@/hooks/usePrefetch';

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
  '/schedules': 'schedules',
  '/fleet/audits': 'fleet',
  '/fleet/equipment': 'fleet',
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
  { title: 'Equipamiento', url: '/fleet/equipment', icon: Baby },
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
  '/schedules': 'schedules.view',
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
  { title: 'Horarios', url: '/schedules', icon: CalendarClock },
  { title: 'Solicitudes Servicio', url: '/service-requests', icon: ArrowLeftRight },
  { title: 'Ajustes', url: '/settings', icon: Settings },
];

/* ── Sidebar styling now uses CSS variables via Tailwind classes ──
 * --sidebar-background, --sidebar-primary, --sidebar-foreground,
 * --sidebar-accent, --sidebar-accent-foreground, --sidebar-border
 * Defined in index.css — no inline style constants needed.
 */

export function AppSidebar() {
  const { profile, organization, signOut } = useAuth();
  const { role, canAccessAdminPanel, hasPermission, isManager, isLoading: permissionsLoading } = usePermissions();
  const { isModuleEnabled, isLoading: modulesLoading } = useOrganizationModules();
  const { handlePrefetch, cancelPrefetch } = usePrefetch();

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
    "group flex items-center text-sm font-sans rounded-lg transition-all duration-150",
    "text-sidebar-foreground/70",
    isCollapsed ? "justify-center !p-0" : "gap-3 px-3",
    isCollapsed ? "" : (isMobile ? "py-3" : "py-2.5")
  );

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
                  isActive={isActive}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!isCollapsed && (
                    <>
                      <span className="flex-1 text-left">{label}</span>
                      <ChevronDown className={cn(
                        "h-4 w-4 transition-transform duration-200 text-current",
                        isOpen && "rotate-180"
                      )} />
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
              className="ml-4 mt-1 space-y-0.5 pl-3 border-l border-sidebar-border"
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
                          className={cn(
                            "flex items-center gap-2 px-2 text-sm rounded transition-colors",
                            isMobile ? "py-3" : "py-1.5",
                            isSubActive
                              ? "text-sidebar-primary bg-sidebar-primary/10 font-semibold"
                              : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/50"
                          )}
                          activeClassName=""
                          onMouseEnter={() => handlePrefetch(subItem.url)}
                          onMouseLeave={cancelPrefetch}
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
        className="border-r border-sidebar-border"
      >
        {/* ── Header ── */}
        <SidebarHeader
          className="p-4 group-data-[collapsible=icon]:p-2 animate-sidebar-fade-in border-b border-sidebar-border"
        >
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
            {!isCollapsed && (
              <div className="flex items-center gap-2.5">
                <span className="font-heading text-xl font-extrabold tracking-tight text-sidebar-accent-foreground">
                  AZUL<span className="text-sidebar-primary">.</span>
                </span>
                <span className="font-heading text-[10px] font-bold uppercase tracking-[0.1em] text-sidebar-foreground/50">
                  Manager
                </span>
              </div>
            )}
            {!isMobile && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="h-8 w-8 text-sidebar-foreground/60 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
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
        <div className="h-[1.5px] bg-gradient-to-r from-transparent via-sidebar-primary to-transparent opacity-60" />

        {/* ── Content ── */}
        <SidebarContent className="px-3 py-4 group-data-[collapsible=icon]:px-0">
          <SidebarGroup>
            <SidebarGroupLabel
              className={cn(
                "mb-2 px-3 font-heading text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/35",
                isCollapsed && "sr-only"
              )}
            >
              Menú principal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
              <DockContainer>
                {/* ── Skeleton loading state ── */}
                {!dataReady && (
                  <>
                    {Array.from({ length: 10 }).map((_, i) => (
                      <SidebarMenuItem
                        key={`skeleton-${i}`}
                        className="opacity-0 animate-sidebar-item-in"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <div
                          className={cn(
                            "flex items-center gap-3 px-3",
                            isCollapsed ? "justify-center py-2.5" : "py-2.5"
                          )}
                        >
                          {/* Icon placeholder */}
                          <div
                            className="h-[18px] w-[18px] shrink-0 rounded animate-pulse bg-white/[0.08]"
                          />
                          {/* Text placeholder */}
                          {!isCollapsed && (
                            <div
                              className="h-3.5 rounded animate-pulse bg-white/[0.08]"
                              style={{
                                width: `${60 + (i % 4) * 20}px`,
                                animationDelay: `${i * 80}ms`,
                              }}
                            />
                          )}
                        </div>
                      </SidebarMenuItem>
                    ))}
                  </>
                )}

                {/* ── Real menu items (only when data is ready) ── */}
                {dataReady && filteredMenuItems.map((item, index) => {
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
                                  data-active={isItemActive}
                                  activeClassName=""
                                  onMouseEnter={() => handlePrefetch(item.url)}
                                  onMouseLeave={cancelPrefetch}
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
                
                {/* Admin Panel — only show when data is ready */}
                {dataReady && canAccessAdminPanel && (
                  <SidebarMenuItem>
                    <DockItem>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="w-full">
                            <SidebarMenuButton asChild>
                              <NavLink
                                to="/settings/admin"
                                className={menuItemBase}
                                data-active={location.pathname.startsWith('/settings/admin')}
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

                {/* Ayuda — always visible once data is ready */}
                {dataReady && <SidebarMenuItem>
                  <DockItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full">
                          <SidebarMenuButton asChild>
                            <NavLink
                              to="/help"
                              className={menuItemBase}
                              data-active={location.pathname === '/help'}
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
                </SidebarMenuItem>}
              </DockContainer>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        {/* ── Footer ── */}
        <SidebarFooter
          className="p-4 group-data-[collapsible=icon]:p-2 animate-sidebar-fade-in border-t border-sidebar-border"
          style={{ animationDelay: '200ms' }}
        >
          {!isCollapsed ? (
            <div className="space-y-4">
              {/* Feedback */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFeedbackOpen(true)}
                className={cn(
                  "w-full gap-2 transition-colors border-sidebar-border text-sidebar-foreground/60 bg-transparent",
                  "hover:text-sidebar-accent-foreground hover:border-sidebar-foreground/20",
                  isMobile && "h-11"
                )}
              >
                <MessageSquare className="h-4 w-4" />
                Enviar feedback
              </Button>

              {/* Organization Switcher */}
              <OrgSwitcher collapsed={false} />
              
              {/* User */}
              <div className="flex items-center gap-3">
                {!dataReady ? (
                  /* Skeleton avatar + text */
                  <>
                    <div className="h-10 w-10 rounded-full animate-pulse shrink-0 bg-white/[0.08]" />
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="h-3.5 w-20 rounded animate-pulse bg-white/[0.08]" />
                      <div className="h-3 w-14 rounded animate-pulse bg-white/[0.06]" />
                    </div>
                  </>
                ) : (
                  /* Real avatar + text */
                  <>
                    <Avatar className="h-10 w-10 shadow-sm ring-2 ring-sidebar-border">
                      <AvatarFallback
                        className="text-sm font-heading font-bold bg-sidebar-primary text-sidebar-background"
                      >
                        {getInitials(profile?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
                        {profile?.name || 'Usuario'}
                      </p>
                      <p className="text-xs text-sidebar-foreground/60">
                        {getRoleBadge(displayRole)}
                      </p>
                    </div>
                  </>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={signOut}
                      className={cn(
                        "transition-colors text-sidebar-foreground/60 hover:text-red-400 hover:bg-red-500/10",
                        isMobile ? "h-11 w-11" : "h-9 w-9"
                      )}
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
              <OrgSwitcher collapsed={true} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setFeedbackOpen(true)}
                    className="h-8 w-8 transition-colors text-sidebar-foreground/60 hover:text-sidebar-accent-foreground"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Enviar feedback</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-9 w-9 shadow-sm cursor-pointer ring-2 ring-sidebar-border">
                    <AvatarFallback className="text-xs font-heading font-bold bg-sidebar-primary text-sidebar-background">
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
                    className="h-8 w-8 transition-colors text-sidebar-foreground/60 hover:text-red-400 hover:bg-red-500/10"
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
