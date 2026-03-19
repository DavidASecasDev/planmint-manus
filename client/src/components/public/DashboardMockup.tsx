import { motion } from 'framer-motion';
import { 
  LayoutDashboard, ClipboardList, Columns, CalendarDays, Timer, CarFront, 
  Car, Layers, Tag, Settings, Users, Target, CheckCircle2, Clock, 
  ArrowRight, ChevronDown
} from 'lucide-react';

const sidebarItems = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: ClipboardList, label: 'Tareas', active: false, expanded: true, subItems: [
    { icon: ClipboardList, label: 'Lista' },
    { icon: Columns, label: 'Kanban' },
    { icon: CalendarDays, label: 'Calendario' },
  ]},
  { icon: Timer, label: 'Tiempo', active: false },
  { icon: CarFront, label: 'Reservas', active: false },
  { icon: Car, label: 'Estado Coches', active: false },
  { icon: Layers, label: 'Áreas', active: false },
  { icon: Tag, label: 'Etiquetas', active: false },
  { icon: Settings, label: 'Ajustes', active: false },
];

const statCards = [
  { title: 'Equipo', value: '8', description: 'Miembros del equipo', icon: Users, color: 'text-blue-500' },
  { title: 'Áreas', value: '5', description: 'Áreas activas', icon: Target, color: 'text-purple-500' },
  { title: 'Completadas', value: '24', description: 'Tareas completadas', icon: CheckCircle2, color: 'text-green-500' },
  { title: 'Pendientes', value: '7', description: 'Tareas pendientes', icon: Clock, color: 'text-orange-500' },
];

const quickActions = [
  { title: 'Tareas', description: 'Gestiona tus tareas', icon: ClipboardList, color: 'bg-blue-500/10 text-blue-600' },
  { title: 'Áreas', description: 'Organiza por áreas', icon: Layers, color: 'bg-purple-500/10 text-purple-600' },
  { title: 'Equipo', description: 'Gestiona miembros', icon: Users, color: 'bg-green-500/10 text-green-600' },
];

export function DashboardMockup() {
  return (
    <motion.div
      className="mx-auto mt-16 max-w-5xl px-4"
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
    >
      <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-md shadow-2xl shadow-primary/10 overflow-hidden">
        {/* Window bar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/50 bg-muted/50">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-emerald-400" />
          <span className="ml-3 text-xs text-muted-foreground font-medium">PlanMint — Dashboard</span>
        </div>

        <div className="flex min-h-[420px] sm:min-h-[460px]">
          {/* Sidebar */}
          <div className="hidden sm:flex flex-col w-52 border-r border-border/50 bg-muted/30">
            {/* Sidebar Header */}
            <div className="px-4 py-4 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">P</span>
                </div>
                <span className="text-sm font-semibold text-foreground">PlanMint</span>
              </div>
            </div>

            {/* Sidebar Menu */}
            <div className="flex-1 py-3 px-2 space-y-0.5 overflow-hidden">
              {sidebarItems.map((item) => (
                <div key={item.label}>
                  <div
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm ${
                      item.active
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-muted-foreground'
                    }`}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {item.subItems && (
                      <ChevronDown className="h-3 w-3 ml-auto flex-shrink-0" />
                    )}
                  </div>
                  {item.expanded && item.subItems && (
                    <div className="ml-6 mt-0.5 space-y-0.5">
                      {item.subItems.map((sub) => (
                        <div
                          key={sub.label}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground"
                        >
                          <sub.icon className="h-3.5 w-3.5 flex-shrink-0" />
                          <span>{sub.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Sidebar Footer */}
            <div className="px-3 py-3 border-t border-border/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-xs font-semibold text-primary">CM</span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">Carlos M.</div>
                  <div className="text-[10px] text-muted-foreground">Admin</div>
                </div>
              </div>
            </div>
          </div>

          {/* Main content */}
          <div className="flex-1 p-4 sm:p-5 space-y-4 overflow-hidden">
            {/* Welcome Banner */}
            <div className="rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 p-5 border border-border/50">
              <div className="text-base sm:text-lg font-bold text-foreground">
                ¡Bienvenido, Carlos!
              </div>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
                Estás en <span className="font-semibold text-foreground">Mi Empresa</span> como <span className="font-semibold text-foreground">Administrador</span>
              </p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {statCards.map((stat) => (
                <div key={stat.title} className="rounded-lg border border-border/50 bg-background/80 p-3 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">{stat.title}</span>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <div className="text-xl sm:text-2xl font-bold text-foreground">{stat.value}</div>
                  <p className="text-[9px] sm:text-[10px] text-muted-foreground mt-0.5">{stat.description}</p>
                </div>
              ))}
            </div>

            {/* Quick Actions */}
            <div>
              <div className="text-xs sm:text-sm font-semibold text-foreground mb-2">Accesos rápidos</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {quickActions.map((action) => (
                  <div
                    key={action.title}
                    className="rounded-lg border border-border/50 bg-background/80 p-3 shadow-sm flex items-center gap-3"
                  >
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${action.color} flex-shrink-0`}>
                      <action.icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground">{action.title}</div>
                      <div className="text-[10px] text-muted-foreground">{action.description}</div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
