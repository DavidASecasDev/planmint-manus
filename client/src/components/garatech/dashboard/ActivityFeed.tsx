import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Hammer, AlertTriangle, FileText, Clock, Wrench } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  type: 'repair' | 'accident' | 'report';
  typeLabel: string;
  title: string;
  description: string;
  date: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
}

const getActivityConfig = (type: string) => {
  switch (type) {
    case 'repair':
      return {
        icon: Hammer,
        color: 'text-blue-500',
        bgColor: 'bg-blue-100 dark:bg-blue-900/30',
      };
    case 'accident':
      return {
        icon: AlertTriangle,
        color: 'text-red-500',
        bgColor: 'bg-red-100 dark:bg-red-900/30',
      };
    case 'report':
      return {
        icon: FileText,
        color: 'text-purple-500',
        bgColor: 'bg-purple-100 dark:bg-purple-900/30',
      };
    default:
      return {
        icon: Wrench,
        color: 'text-muted-foreground',
        bgColor: 'bg-muted',
      };
  }
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Actividad Reciente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Sin actividad reciente</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Actividad Reciente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {activities.map((activity) => {
          const config = getActivityConfig(activity.type);
          const Icon = config.icon;

          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className={cn('p-2 rounded-full', config.bgColor)}>
                <Icon className={cn('h-3.5 w-3.5', config.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {activity.typeLabel}
                  </Badge>
                  <span className="font-medium text-sm truncate">{activity.title}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {activity.description}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                <Clock className="h-3 w-3" />
                {format(new Date(activity.date), 'dd MMM HH:mm', { locale: es })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
