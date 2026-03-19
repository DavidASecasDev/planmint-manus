import { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Building2, 
  MessageSquare, 
  CreditCard,
  ArrowLeft,
  Shield,
  Users,
  Bell,
  History,
  Ticket,
  Wrench,
  Flag,
  Code
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSuperAdminAlerts } from '@/hooks/useSuperAdminAlerts';

interface SuperAdminLayoutProps {
  children: ReactNode;
  title: string;
}

const navItems = [
  { to: '/super-admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/super-admin/alerts', icon: Bell, label: 'Alertas', badge: 'alerts' as const },
  { to: '/super-admin/organizations', icon: Building2, label: 'Organizaciones' },
  { to: '/super-admin/users', icon: Users, label: 'Usuarios' },
  { to: '/super-admin/feedback', icon: MessageSquare, label: 'Feedback', badge: 'feedback' as const },
  { to: '/super-admin/subscriptions', icon: CreditCard, label: 'Suscripciones' },
  { to: '/super-admin/coupons', icon: Ticket, label: 'Cupones' },
  { to: '/super-admin/operations', icon: Wrench, label: 'Operaciones' },
  { to: '/super-admin/feature-flags', icon: Flag, label: 'Feature Flags' },
  { to: '/super-admin/audit-logs', icon: History, label: 'Auditoría' },
  { to: '/super-admin/docs', icon: Code, label: 'Documentación' },
];

export function SuperAdminLayout({ children, title }: SuperAdminLayoutProps) {
  const navigate = useNavigate();
  const { unreadCount, activePaymentCount, unreadFeedbackCount } = useSuperAdminAlerts();

  const getBadgeCount = (badgeType: 'alerts' | 'feedback') => {
    if (badgeType === 'alerts') {
      return activePaymentCount > 0 ? activePaymentCount : unreadCount;
    }
    if (badgeType === 'feedback') {
      return unreadFeedbackCount;
    }
    return 0;
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm text-foreground">Super Admin</h2>
              <p className="text-xs text-muted-foreground">Panel de Control SaaS</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                )
              }
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {item.badge && getBadgeCount(item.badge) > 0 && (
                <Badge 
                  variant={item.badge === 'alerts' && activePaymentCount > 0 ? "destructive" : "secondary"} 
                  className="h-5 min-w-5 flex items-center justify-center text-xs"
                >
                  {getBadgeCount(item.badge)}
                </Badge>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2 text-muted-foreground"
            onClick={() => navigate('/dashboard')}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a la App
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-6">
          <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        </header>
        <div className="flex-1 p-6 overflow-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
