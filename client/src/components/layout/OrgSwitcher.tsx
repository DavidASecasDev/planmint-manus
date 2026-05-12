/**
 * OrgSwitcher — Sidebar dropdown to switch between organizations.
 * Queries get-my-organizations for the list and calls switch-organization on selection.
 * After switching, reloads the page to reset all org-scoped data.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronsUpDown, Check } from 'lucide-react';
import { apiInvoke } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

interface OrgItem {
  id: string;
  name: string;
  role: string;
  is_current: boolean;
  created_at: string;
}

// Brand colors for known organizations
const ORG_COLORS: Record<string, string> = {
  'Azul Cars': '#0ea5e9',      // sky-500
  'Bluebnc': '#6366f1',        // indigo-500
  'Azul Stays': '#10b981',     // emerald-500
};

function getOrgColor(name: string): string {
  return ORG_COLORS[name] || '#64748b'; // slate-500 default
}

function getOrgInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface OrgSwitcherProps {
  /** Sidebar collapsed mode */
  collapsed?: boolean;
}

export function OrgSwitcher({ collapsed = false }: OrgSwitcherProps) {
  const { organization, sessionReady } = useAuth();
  const [switching, setSwitching] = useState(false);

  const { data: organizations = [] } = useQuery<OrgItem[]>({
    queryKey: ['my-organizations'],
    queryFn: async () => {
      const res = await apiInvoke<OrgItem[]>('get-my-organizations');
      return res.data || [];
    },
    enabled: sessionReady,
    staleTime: 5 * 60 * 1000, // 5 min
  });

  const handleSwitch = async (orgId: string) => {
    if (orgId === organization?.id || switching) return;
    setSwitching(true);
    try {
      const res = await apiInvoke<{ organization: OrgItem; role: string }>('switch-organization', {
        body: { organization_id: orgId },
      });
      if (res.error) {
        console.error('[OrgSwitcher] Switch failed:', res.error);
        setSwitching(false);
        return;
      }
      // Reload the entire app to reset all org-scoped data
      window.location.reload();
    } catch (err) {
      console.error('[OrgSwitcher] Switch error:', err);
      setSwitching(false);
    }
  };

  const currentOrg = organizations.find((o) => o.is_current) || {
    id: organization?.id || '',
    name: organization?.name || 'Sin organización',
    role: 'owner',
    is_current: true,
    created_at: '',
  };

  const currentColor = getOrgColor(currentOrg.name);

  if (collapsed) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="flex items-center justify-center w-10 h-10 rounded-lg transition-colors hover:bg-white/5 mx-auto"
            title={currentOrg.name}
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: currentColor }}
            >
              {getOrgInitials(currentOrg.name)}
            </div>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="end" className="w-56">
          <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
            Organizaciones
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSwitch(org.id)}
              disabled={switching}
              className="flex items-center gap-2"
            >
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                style={{ backgroundColor: getOrgColor(org.name) }}
              >
                {getOrgInitials(org.name)}
              </div>
              <span className="flex-1 truncate">{org.name}</span>
              {org.is_current && <Check className="h-4 w-4 text-primary shrink-0" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Only show switcher if user has more than 1 org
  const showSwitcher = organizations.length > 1;

  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
      {showSwitcher ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center gap-3 rounded-md px-2 py-2 transition-colors",
                "hover:bg-white/5 focus:outline-none focus-visible:ring-1 focus-visible:ring-white/20",
                switching && "opacity-50 pointer-events-none"
              )}
            >
              <div
                className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ backgroundColor: currentColor }}
              >
                {getOrgInitials(currentOrg.name)}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p
                  className="text-[10px] uppercase tracking-[0.12em] mb-0.5"
                  style={{
                    fontFamily: 'Montserrat, sans-serif',
                    fontWeight: 700,
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
                    color: 'rgba(255,255,255,0.95)',
                  }}
                >
                  {currentOrg.name}
                </p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0" style={{ color: 'rgba(255,255,255,0.4)' }} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground uppercase tracking-wider">
              Cambiar organización
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {organizations.map((org) => (
              <DropdownMenuItem
                key={org.id}
                onClick={() => handleSwitch(org.id)}
                disabled={switching || org.is_current}
                className={cn(
                  "flex items-center gap-3 py-2.5",
                  org.is_current && "bg-accent/50"
                )}
              >
                <div
                  className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
                  style={{ backgroundColor: getOrgColor(org.name) }}
                >
                  {getOrgInitials(org.name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{org.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{org.role}</p>
                </div>
                {org.is_current && <Check className="h-4 w-4 text-primary shrink-0" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        /* Single org — static display (no dropdown) */
        <div className="flex items-center gap-3 px-2 py-1">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center text-white text-xs font-bold shrink-0"
            style={{ backgroundColor: currentColor }}
          >
            {getOrgInitials(currentOrg.name)}
          </div>
          <div className="flex-1 min-w-0">
            <p
              className="text-[10px] uppercase tracking-[0.12em] mb-0.5"
              style={{
                fontFamily: 'Montserrat, sans-serif',
                fontWeight: 700,
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
                color: 'rgba(255,255,255,0.95)',
              }}
            >
              {currentOrg.name}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
