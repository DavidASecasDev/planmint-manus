import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Users, User, ChevronDown, ChevronRight, AlertCircle, CheckCircle, Clock, Target } from 'lucide-react';
import { Milestone, MilestoneAssigneeStats } from '@/types/milestones';
import { useOrganizationMembers } from '@/hooks/usePermissions';
import { useTeams } from '@/hooks/useTeams';
import { format, isPast, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ResponsablesSectionProps {
  milestones: Milestone[];
  onMilestoneClick?: (milestoneId: string) => void;
}

type FilterType = 'all' | 'overdue' | 'blocked' | 'mine' | 'my_teams';

export function ResponsablesSection({ milestones, onMilestoneClick }: ResponsablesSectionProps) {
  const { members } = useOrganizationMembers();
  const { teams } = useTeams();
  const [filter, setFilter] = useState<FilterType>('all');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Build assignee stats
  const stats = useMemo(() => {
    const userStats = new Map<string, MilestoneAssigneeStats>();
    const teamStats = new Map<string, MilestoneAssigneeStats>();
    const unassigned: Milestone[] = [];

    const now = new Date();

    milestones.forEach(milestone => {
      const isOverdue = milestone.due_date && milestone.status !== 'done' && isPast(parseISO(milestone.due_date));

      if (!milestone.assignee_id || !milestone.assignee_type) {
        unassigned.push(milestone);
        return;
      }

      const statsMap = milestone.assignee_type === 'user' ? userStats : teamStats;
      const key = milestone.assignee_id;

      if (!statsMap.has(key)) {
        let name = 'Desconocido';
        if (milestone.assignee_type === 'user') {
          const member = members.find(m => m.user_id === key);
          name = member?.profile?.name || 'Sin nombre';
        } else {
          const team = teams.find(t => t.id === key);
          name = team?.name || 'Equipo desconocido';
        }

        statsMap.set(key, {
          assigneeId: key,
          assigneeType: milestone.assignee_type,
          assigneeName: name,
          total: 0,
          completed: 0,
          inProgress: 0,
          pending: 0,
          overdue: 0,
          milestones: [],
        });
      }

      const stat = statsMap.get(key)!;
      stat.total++;
      stat.milestones.push(milestone);

      if (milestone.status === 'done') stat.completed++;
      else if (milestone.status === 'in_progress') stat.inProgress++;
      else stat.pending++;

      if (isOverdue) stat.overdue++;
    });

    return {
      users: Array.from(userStats.values()),
      teams: Array.from(teamStats.values()),
      unassigned,
    };
  }, [milestones, members, teams]);

  // Apply filters
  const filteredStats = useMemo(() => {
    // TODO: Implement filter by 'mine' and 'my_teams' when we have current user context
    let users = stats.users;
    let teamsList = stats.teams;
    let unassigned = stats.unassigned;

    if (filter === 'overdue') {
      users = users.filter(s => s.overdue > 0).map(s => ({
        ...s,
        milestones: s.milestones.filter(m => m.due_date && m.status !== 'done' && isPast(parseISO(m.due_date))),
      }));
      teamsList = teamsList.filter(s => s.overdue > 0).map(s => ({
        ...s,
        milestones: s.milestones.filter(m => m.due_date && m.status !== 'done' && isPast(parseISO(m.due_date))),
      }));
      unassigned = unassigned.filter(m => m.due_date && m.status !== 'done' && isPast(parseISO(m.due_date)));
    }

    return { users, teams: teamsList, unassigned };
  }, [stats, filter]);

  const toggleGroup = (id: string) => {
    const newSet = new Set(expandedGroups);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedGroups(newSet);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    switch (status) {
      case 'done':
        return <Badge variant="default" className="bg-green-100 text-green-700 hover:bg-green-100">Completado</Badge>;
      case 'in_progress':
        return <Badge variant="secondary" className="bg-blue-100 text-blue-700">En progreso</Badge>;
      default:
        return <Badge variant="outline">Por hacer</Badge>;
    }
  };

  const renderMilestonesList = (milestonesList: Milestone[]) => (
    <div className="space-y-2 pl-8 mt-2">
      {milestonesList.map(milestone => {
        const isOverdue = milestone.due_date && milestone.status !== 'done' && isPast(parseISO(milestone.due_date));
        return (
          <div
            key={milestone.id}
            className={cn(
              "flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/50 cursor-pointer transition-colors",
              isOverdue && "border-destructive/50"
            )}
            onClick={() => onMilestoneClick?.(milestone.id)}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="truncate font-medium text-sm">{milestone.title}</span>
              {isOverdue && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {milestone.due_date && (
                <span className={cn("text-xs", isOverdue ? "text-destructive" : "text-muted-foreground")}>
                  {format(parseISO(milestone.due_date), 'dd MMM', { locale: es })}
                </span>
              )}
              <StatusBadge status={milestone.status} />
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderStatsCard = (stat: MilestoneAssigneeStats, icon: React.ReactNode) => {
    const isExpanded = expandedGroups.has(stat.assigneeId);
    const progressPercent = stat.total > 0 ? Math.round((stat.completed / stat.total) * 100) : 0;

    return (
      <Collapsible key={stat.assigneeId} open={isExpanded} onOpenChange={() => toggleGroup(stat.assigneeId)}>
        <div className="border rounded-lg p-3 bg-card">
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {stat.assigneeType === 'team' ? <Users className="h-4 w-4" /> : getInitials(stat.assigneeName)}
                  </AvatarFallback>
                </Avatar>
                <div className="text-left min-w-0">
                  <div className="font-medium text-sm truncate">{stat.assigneeName}</div>
                  <div className="text-xs text-muted-foreground">
                    {stat.completed}/{stat.total} completados
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0">
                <div className="hidden sm:flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" /> {stat.completed}
                  </span>
                  <span className="flex items-center gap-1 text-blue-600">
                    <Clock className="h-3 w-3" /> {stat.inProgress}
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Target className="h-3 w-3" /> {stat.pending}
                  </span>
                  {stat.overdue > 0 && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3 w-3" /> {stat.overdue}
                    </span>
                  )}
                </div>
                <div className="w-16">
                  <Progress value={progressPercent} className="h-1.5" />
                </div>
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </div>
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent>
            {renderMilestonesList(stat.milestones)}
          </CollapsibleContent>
        </div>
      </Collapsible>
    );
  };

  const totalAssignees = filteredStats.users.length + filteredStats.teams.length + (filteredStats.unassigned.length > 0 ? 1 : 0);

  if (milestones.length === 0) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
        <p>No hay hitos para mostrar responsables</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-1">
        <Button
          variant={filter === 'all' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          Todos
        </Button>
        <Button
          variant={filter === 'overdue' ? 'destructive' : 'ghost'}
          size="sm"
          onClick={() => setFilter('overdue')}
        >
          Vencidos
        </Button>
      </div>

      {/* Users Section */}
      {filteredStats.users.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <User className="h-4 w-4" />
            Usuarios ({filteredStats.users.length})
          </h4>
          <div className="space-y-2">
            {filteredStats.users.map(stat => renderStatsCard(stat, <User className="h-4 w-4" />))}
          </div>
        </div>
      )}

      {/* Teams Section */}
      {filteredStats.teams.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            Equipos ({filteredStats.teams.length})
          </h4>
          <div className="space-y-2">
            {filteredStats.teams.map(stat => renderStatsCard(stat, <Users className="h-4 w-4" />))}
          </div>
        </div>
      )}

      {/* Unassigned Section */}
      {filteredStats.unassigned.length > 0 && (
        <Collapsible>
          <div className="border rounded-lg p-3 bg-muted/30">
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">Sin asignar</div>
                    <div className="text-xs text-muted-foreground">
                      {filteredStats.unassigned.length} hitos
                    </div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4" />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              {renderMilestonesList(filteredStats.unassigned)}
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {totalAssignees === 0 && (
        <div className="text-center py-4 text-muted-foreground text-sm">
          No hay hitos que coincidan con el filtro
        </div>
      )}
    </div>
  );
}
