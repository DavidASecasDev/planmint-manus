import { useNavigate } from 'react-router-dom';
import { Hammer, LayoutGrid, Building2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface QuickActionsGridProps {
  onNewRepair: () => void;
}

export function QuickActionsGrid({ onNewRepair }: QuickActionsGridProps) {
  const navigate = useNavigate();

  const actions = [
    {
      label: 'Nueva Reparación',
      icon: Hammer,
      onClick: onNewRepair,
      variant: 'default' as const,
    },
    {
      label: 'Ver Kanban',
      icon: LayoutGrid,
      onClick: () => navigate('/garatech/repairs'),
      variant: 'outline' as const,
    },
    {
      label: 'Talleres',
      icon: Building2,
      onClick: () => navigate('/garatech/workshops'),
      variant: 'outline' as const,
    },
    {
      label: 'Registrar Accidente',
      icon: AlertTriangle,
      onClick: () => navigate('/garatech/accidents'),
      variant: 'outline' as const,
    },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Accesos Rápidos</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-2">
        {actions.map((action) => (
          <Button
            key={action.label}
            variant={action.variant}
            className="h-auto py-4 flex flex-col gap-2"
            onClick={action.onClick}
          >
            <action.icon className="h-5 w-5" />
            <span className="text-xs">{action.label}</span>
          </Button>
        ))}
      </CardContent>
    </Card>
  );
}
