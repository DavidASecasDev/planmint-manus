import { HelpCircle, MessageSquare, Keyboard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface HelpQuickLinksProps {
  onFeedbackClick?: () => void;
}

export function HelpQuickLinks({ onFeedbackClick }: HelpQuickLinksProps) {
  const links = [
    {
      icon: MessageSquare,
      label: 'Enviar feedback',
      description: 'Cuéntanos cómo mejorar',
      onClick: onFeedbackClick,
    },
    {
      icon: Keyboard,
      label: 'Atajos de teclado',
      description: 'Ctrl+K para búsqueda',
      onClick: () => {},
    },
    {
      icon: HelpCircle,
      label: 'FAQ',
      description: 'Preguntas frecuentes',
      onClick: () => {},
    },
  ];

  return (
    <Card className="border-dashed">
      <CardContent className="p-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
          Accesos rápidos
        </p>
        <div className="space-y-1">
          {links.map((link) => (
            <Button
              key={link.label}
              variant="ghost"
              className="w-full justify-start h-auto py-2 px-2"
              onClick={link.onClick}
            >
              <link.icon className="h-4 w-4 mr-2 text-muted-foreground" />
              <div className="text-left">
                <p className="text-sm font-medium">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </div>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
