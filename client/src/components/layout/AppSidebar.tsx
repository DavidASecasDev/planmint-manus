import { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, ChevronLeft, ChevronRight, ChevronDown, LogOut, Layers, ClipboardList, Tag, Bell, Columns, CalendarDays, MessageSquare, Zap, LayoutTemplate, BarChart3, Shield, CarFront, Timer, FileText, Car, BookOpen, Wrench, Hammer, AlertTriangle, Building2, FileSpreadsheet, Ship, Plus, ClipboardCheck, Route, Warehouse } from 'lucide-react';
import logo from '@/assets/logo.png';
import { NavLink } from '@/components/NavLink';
import { useAuth } from '@/contexts/AuthContext';
import { DockContainer } from '@/components/ui/dock-sidebar';
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
  '/fleet/damages': 'fleet',
};

// Garatech submenu items with permission gates
const garatechSubItems = [
  { title: 'Dashboard', url: '/garatech', icon: LayoutDashboard },
  { title: 'Reparaciones', url: '/garatech/repairs', icon: Hammer },
  { title: 'Accidentes', url: '/garatech/accidents', icon: AlertTriangle, permission: 'garatech.manage_accidents' as const },
  { title: 'Talleres', url: '/garatech/workshops', icon: Building2 },
  { title: 'Catálogo Daños', url: '/garatech/catalog', icon: FileSpreadsheet, permission: 'garatech.manage_catalog' as const },
  { title: 'Informes Daños', url: '/garatech/reports', icon: FileText },
];

// Transfers submenu items - note: Gestión Brokers requires 'transfers.manage' permission
const transfersSubItems = [
  { title: 'Solicitudes', url: '/transfers', icon: Ship },
  { title: 'Nueva Solicitud', url: '/transfers/new', icon: Plus },
  { title: 'Gestión Brokers', url: '/transfers/brokers', icon: Users, permission: 'transfers.manage' as const },
  { title: 'Formularios', url: '/transfers/forms', icon: FileText },
];

// Fleet submenu items
const fleetSubItems = [
  { title: 'Vehículos', url: '/fleet', icon: Warehouse },
  { title: 'Historial de Daños', url: '/fleet/damages', icon: AlertTriangle },
];

// Tasks submenu items
const tasksSubItems = [
  { title: 'Lista', url: '/tasks', icon: ClipboardList },
  { title: 'Kanban', url: '/tasks/kanban', icon: Columns },
  { title: 'Calendario', url: '/tasks/calendar', icon: CalendarDays },
  { title: 'Tareas Diarias', url: '/tasks/daily', icon: ClipboardCheck },
];

// Map menu items to required permissions (only for permission-gated features)
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
  // Flota is now a collapsible menu, removed from flat list
  { title: 'Recordatorios', url: '/reminders', icon: Bell },
  { title: 'Áreas', url: '/areas', icon: Layers },
  { title: 'Etiquetas', url: '/tags', icon: Tag },
  { title: 'Automatizaciones', url: '/automations', icon: Zap },
  { title: 'Plantillas', url: '/templates', icon: LayoutTemplate },
  { title: 'Reportes', url: '/reports', icon: BarChart3 },
  { title: 'Teams', url: '/teams', icon: Users },
  { title: 'Ajustes', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { profile, organization, signOut } = useAuth();
  const { role, canAccessAdminPanel, hasPermission, isManager } = usePermissions();
  const { isModuleEnabled } = useOrganizationModules();
  const { state, toggleSidebar } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === 'collapsed';
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [garatechOpen, setGaratechOpen] = useState(location.pathname.startsWith('/garatech'));
  const [transfersOpen, setTransfersOpen] = useState(location.pathname.startsWith('/transfers'));
  const [tasksOpen, setTasksOpen] = useState(location.pathname.startsWith('/tasks'));
  const [fleetOpen, setFleetOpen] = useState(location.pathname.startsWith('/fleet'));

  // Check if we're on a Garatech, Transfers, Tasks or Fleet route
  const isGaratechActive = location.pathname.startsWith('/garatech');
  const isTransfersActive = location.pathname.startsWith('/transfers');
  const isTasksActive = location.pathname.startsWith('/tasks');
  const isFleetActive = location.pathname.startsWith('/fleet');

  // Auto-open menus when navigating to their routes
  useEffect(() => {
    if (location.pathname.startsWith('/garatech')) {
      setGaratechOpen(true);
    }
    if (location.pathname.startsWith('/transfers')) {
      setTransfersOpen(true);
    }
    if (location.pathname.startsWith('/tasks')) {
      setTasksOpen(true);
    }
    if (location.pathname.startsWith('/fleet')) {
      setFleetOpen(true);
    }
  }, [location.pathname]);

  // Filter menu items based on enabled modules AND permissions
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Check permission requirement first (if exists)
      const requiredPermission = MENU_PERMISSION_MAP[item.url];
      if (requiredPermission && !hasPermission(requiredPermission)) {
        return false; // User lacks permission, hide menu item
      }

      // Check both exact match and prefix match for nested routes
      const moduleKey = MENU_MODULE_MAP[item.url] || 
        Object.entries(MENU_MODULE_MAP).find(([path]) => item.url.startsWith(path + '/'))?.[1];
      
      // If this menu item is tied to an optional module, check if it's enabled
      if (moduleKey && OPTIONAL_MODULES.includes(moduleKey)) {
        return isModuleEnabled(moduleKey);
      }
      // Core modules are always shown
      return true;
    });
  }, [isModuleEnabled, hasPermission]);

  const getInitials = (name: string | null | undefined) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRoleBadge = (r: string | null | undefined) => {
    if (!r) return '';
    const roleLabels: Record<string, string> = {
      owner: 'Owner',
      admin: 'Admin',
      manager: 'Manager',
      member: 'Miembro',
      read_only: 'Solo lectura'
    };
    return roleLabels[r] || r;
  };

  // Use role from organization_members (via usePermissions) instead of profile.role
  const displayRole = role;

  return (
    <TooltipProvider delayDuration={0}>
      <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
        <SidebarHeader className="border-b border-sidebar-border/50 p-4 group-data-[collapsible=icon]:p-2">
          <div className={cn("flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
            {!isCollapsed && (
              <div className="flex items-center gap-3">
                <img src={logo} alt="PlanMint Logo" className="h-9 w-9 rounded-xl object-contain" />
                <div className="flex flex-col">
                  <span className="font-semibold text-sm text-sidebar-foreground">PlanMint</span>
                  <span className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">Manager</span>
                </div>
              </div>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  className="h-8 w-8 text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
                >
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                {isCollapsed ? 'Expandir' : 'Colapsar'}
              </TooltipContent>
            </Tooltip>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-3 py-4 group-data-[collapsible=icon]:px-0">
          <SidebarGroup>
            <SidebarGroupLabel className={cn(
              "text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 mb-2 px-3",
              isCollapsed && "sr-only"
            )}>
              Menú principal
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-1">
              <DockContainer enabled={isCollapsed}>
                {filteredMenuItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full">
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              className={cn(
                                "group flex items-center rounded-xl text-sm font-medium text-muted-foreground transition-all duration-150",
                                isCollapsed ? "justify-center !p-0" : "gap-3 px-3 py-2.5",
                                "hover:bg-sidebar-accent hover:text-sidebar-foreground"
                              )}
                              activeClassName="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                            >
                              <item.icon className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105" />
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

                    {/* Tasks Collapsible Menu - inserted right after Dashboard */}
                    {item.url === '/dashboard' && (
                      <Collapsible open={tasksOpen} onOpenChange={setTasksOpen} className="mt-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                className={cn(
                                  "group flex w-full items-center rounded-xl text-sm font-medium text-muted-foreground transition-all duration-150",
                                  isCollapsed ? "justify-center !p-0" : "gap-3 px-3 py-2.5",
                                  "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                  isTasksActive && "bg-primary/10 text-primary"
                                )}
                              >
                                <ClipboardList className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105" />
                                {!isCollapsed && (
                                  <>
                                    <span className="flex-1 text-left">Tareas</span>
                                    <ChevronDown className={cn(
                                      "h-4 w-4 transition-transform duration-200",
                                      tasksOpen && "rotate-180"
                                    )} />
                                  </>
                                )}
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right" className="font-medium">
                              Tareas
                            </TooltipContent>
                          )}
                        </Tooltip>
                        {!isCollapsed && (
                          <CollapsibleContent>
                            <SidebarMenuSub className="ml-4 mt-1 space-y-1 border-l border-sidebar-border/50 pl-3">
                              {tasksSubItems
                                .filter((subItem) => {
                                  const moduleKey = MENU_MODULE_MAP[subItem.url];
                                  if (moduleKey && OPTIONAL_MODULES.includes(moduleKey)) {
                                    return isModuleEnabled(moduleKey);
                                  }
                                  return true;
                                })
                                .map((subItem) => (
                                <SidebarMenuSubItem key={subItem.url}>
                                  <SidebarMenuSubButton asChild isActive={location.pathname === subItem.url}>
                                    <NavLink
                                      to={subItem.url}
                                      className={cn(
                                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors",
                                        "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                        location.pathname === subItem.url && "bg-primary text-primary-foreground hover:bg-primary/90"
                                      )}
                                    >
                                      <subItem.icon className="h-4 w-4" />
                                      <span>{subItem.title}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    )}

                    {/* Transfers Collapsible Menu - inserted right after Estado Coches */}
                    {item.url === '/vehicles' && isModuleEnabled('transfers') && hasPermission('transfers.view') && (
                      <Collapsible open={transfersOpen} onOpenChange={setTransfersOpen} className="mt-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                className={cn(
                                  "group flex w-full items-center rounded-xl text-sm font-medium text-muted-foreground transition-all duration-150",
                                  isCollapsed ? "justify-center !p-0" : "gap-3 px-3 py-2.5",
                                  "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                  isTransfersActive && "bg-primary/10 text-primary"
                                )}
                              >
                                <Ship className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105" />
                                {!isCollapsed && (
                                  <>
                                    <span className="flex-1 text-left">Transfers</span>
                                    <ChevronDown className={cn(
                                      "h-4 w-4 transition-transform duration-200",
                                      transfersOpen && "rotate-180"
                                    )} />
                                  </>
                                )}
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right" className="font-medium">
                              Transfers
                            </TooltipContent>
                          )}
                        </Tooltip>
                        {!isCollapsed && (
                          <CollapsibleContent>
                            <SidebarMenuSub className="ml-4 mt-1 space-y-1 border-l border-sidebar-border/50 pl-3">
                              {transfersSubItems
                                .filter((subItem) => {
                                  // Check permission if required
                                  if ('permission' in subItem && subItem.permission) {
                                    return hasPermission(subItem.permission);
                                  }
                                  return true;
                                })
                                .map((subItem) => (
                                <SidebarMenuSubItem key={subItem.url}>
                                  <SidebarMenuSubButton asChild isActive={location.pathname === subItem.url}>
                                    <NavLink
                                      to={subItem.url}
                                      className={cn(
                                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors",
                                        "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                        location.pathname === subItem.url && "bg-primary text-primary-foreground hover:bg-primary/90"
                                      )}
                                    >
                                      <subItem.icon className="h-4 w-4" />
                                      <span>{subItem.title}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    )}

                    {/* Garatech Collapsible Menu - inserted after Transfers */}
                    {item.url === '/vehicles' && isModuleEnabled('garatech') && hasPermission('garatech.view') && (
                      <Collapsible open={garatechOpen} onOpenChange={setGaratechOpen} className="mt-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                className={cn(
                                  "group flex w-full items-center rounded-xl text-sm font-medium text-muted-foreground transition-all duration-150",
                                  isCollapsed ? "justify-center !p-0" : "gap-3 px-3 py-2.5",
                                  "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                  isGaratechActive && "bg-primary/10 text-primary"
                                )}
                              >
                                <Wrench className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105" />
                                {!isCollapsed && (
                                  <>
                                    <span className="flex-1 text-left">Garatech</span>
                                    <ChevronDown className={cn(
                                      "h-4 w-4 transition-transform duration-200",
                                      garatechOpen && "rotate-180"
                                    )} />
                                  </>
                                )}
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right" className="font-medium">
                              Garatech
                            </TooltipContent>
                          )}
                        </Tooltip>
                        {!isCollapsed && (
                          <CollapsibleContent>
                            <SidebarMenuSub className="ml-4 mt-1 space-y-1 border-l border-sidebar-border/50 pl-3">
                              {garatechSubItems
                                .filter((subItem) => {
                                  if ('permission' in subItem && subItem.permission) {
                                    return hasPermission(subItem.permission);
                                  }
                                  return true;
                                })
                                .map((subItem) => (
                                <SidebarMenuSubItem key={subItem.url}>
                                  <SidebarMenuSubButton asChild isActive={location.pathname === subItem.url}>
                                    <NavLink
                                      to={subItem.url}
                                      className={cn(
                                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors",
                                        "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                        location.pathname === subItem.url && "bg-primary text-primary-foreground hover:bg-primary/90"
                                      )}
                                    >
                                      <subItem.icon className="h-4 w-4" />
                                      <span>{subItem.title}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    )}

                    {/* Fleet Collapsible Menu - inserted after Garatech */}
                    {item.url === '/movements' && isModuleEnabled('fleet') && hasPermission('fleet.view') && (
                      <Collapsible open={fleetOpen} onOpenChange={setFleetOpen} className="mt-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <CollapsibleTrigger asChild>
                              <SidebarMenuButton
                                className={cn(
                                  "group flex w-full items-center rounded-xl text-sm font-medium text-muted-foreground transition-all duration-150",
                                  isCollapsed ? "justify-center !p-0" : "gap-3 px-3 py-2.5",
                                  "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                  isFleetActive && "bg-primary/10 text-primary"
                                )}
                              >
                                <Warehouse className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105" />
                                {!isCollapsed && (
                                  <>
                                    <span className="flex-1 text-left">Flota</span>
                                    <ChevronDown className={cn(
                                      "h-4 w-4 transition-transform duration-200",
                                      fleetOpen && "rotate-180"
                                    )} />
                                  </>
                                )}
                              </SidebarMenuButton>
                            </CollapsibleTrigger>
                          </TooltipTrigger>
                          {isCollapsed && (
                            <TooltipContent side="right" className="font-medium">
                              Flota
                            </TooltipContent>
                          )}
                        </Tooltip>
                        {!isCollapsed && (
                          <CollapsibleContent>
                            <SidebarMenuSub className="ml-4 mt-1 space-y-1 border-l border-sidebar-border/50 pl-3">
                              {fleetSubItems.map((subItem) => (
                                <SidebarMenuSubItem key={subItem.url}>
                                  <SidebarMenuSubButton asChild isActive={location.pathname === subItem.url}>
                                    <NavLink
                                      to={subItem.url}
                                      className={cn(
                                        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors",
                                        "hover:bg-sidebar-accent hover:text-sidebar-foreground",
                                        location.pathname === subItem.url && "bg-primary text-primary-foreground hover:bg-primary/90"
                                      )}
                                    >
                                      <subItem.icon className="h-4 w-4" />
                                      <span>{subItem.title}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </Collapsible>
                    )}
                  </SidebarMenuItem>
                ))}
                
                {/* Admin Panel - only visible to those with permission */}
                {canAccessAdminPanel && (
                  <SidebarMenuItem>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="w-full">
                          <SidebarMenuButton asChild>
                            <NavLink
                              to="/settings/admin"
                              className={cn(
                                "group flex items-center rounded-xl text-sm font-medium text-muted-foreground transition-all duration-150",
                                isCollapsed ? "justify-center !p-0" : "gap-3 px-3 py-2.5",
                                "hover:bg-sidebar-accent hover:text-sidebar-foreground"
                              )}
                              activeClassName="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                            >
                              <Shield className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105" />
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
                </SidebarMenuItem>
                )}

                {/* Ayuda - siempre al final del menú */}
                <SidebarMenuItem>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="w-full">
                        <SidebarMenuButton asChild>
                          <NavLink
                            to="/help"
                            className={cn(
                              "group flex items-center rounded-xl text-sm font-medium text-muted-foreground transition-all duration-150",
                              isCollapsed ? "justify-center !p-0" : "gap-3 px-3 py-2.5",
                              "hover:bg-sidebar-accent hover:text-sidebar-foreground"
                            )}
                            activeClassName="bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground"
                          >
                            <BookOpen className="h-[18px] w-[18px] shrink-0 transition-transform group-hover:scale-105" />
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
                </SidebarMenuItem>
              </DockContainer>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border/50 p-4 group-data-[collapsible=icon]:p-2">
          {!isCollapsed ? (
            <div className="space-y-4">
              {/* Feedback Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFeedbackOpen(true)}
                className="w-full gap-2 text-muted-foreground hover:text-foreground"
              >
                <MessageSquare className="h-4 w-4" />
                Enviar feedback
              </Button>

              <div className="rounded-xl bg-muted/50 p-3.5">
                <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-1">Organización</p>
                <p className="truncate font-semibold text-sm text-sidebar-foreground">
                  {organization?.name || 'Sin organización'}
                </p>
              </div>
              
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-sm font-semibold">
                    {getInitials(profile?.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-semibold text-sidebar-foreground">
                    {profile?.name || 'Usuario'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {getRoleBadge(displayRole)}
                  </p>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={signOut}
                      className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
                    className="h-8 w-8 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <MessageSquare className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Enviar feedback</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Avatar className="h-9 w-9 ring-2 ring-background shadow-sm cursor-pointer">
                    <AvatarFallback className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs font-semibold">
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
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
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
