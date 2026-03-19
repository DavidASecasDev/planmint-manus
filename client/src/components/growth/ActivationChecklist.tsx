import { CheckCircle2, Circle, Sparkles, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useActivationChecklist } from '@/hooks/useActivationChecklist';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';

export const ActivationChecklist = () => {
  const { checklist, isLoading, completedCount, totalCount, isComplete, progress } = useActivationChecklist();
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('activation-checklist-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('activation-checklist-dismissed', 'true');
    setIsDismissed(true);
  };

  const handleItemClick = (id: string) => {
    switch (id) {
      case 'task':
        navigate('/tasks');
        break;
      case 'area':
        navigate('/areas');
        break;
      case 'kanban':
        navigate('/tasks/kanban');
        break;
      case 'reminder':
        navigate('/reminders');
        break;
      case 'search':
        // Trigger search palette
        const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
        document.dispatchEvent(event);
        break;
    }
  };

  if (isLoading || isDismissed || isComplete) {
    return null;
  }

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-primary" />
            Primeros pasos
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Progress value={progress} className="h-2 flex-1" />
          <span className="text-sm text-muted-foreground">
            {completedCount}/{totalCount}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {checklist?.map((item) => (
          <button
            key={item.id}
            onClick={() => !item.completed && handleItemClick(item.id)}
            className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors ${
              item.completed
                ? 'cursor-default text-muted-foreground'
                : 'hover:bg-muted/50 cursor-pointer'
            }`}
          >
            {item.completed ? (
              <CheckCircle2 className="h-5 w-5 text-primary" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground" />
            )}
            <span className={item.completed ? 'line-through' : ''}>
              {item.label}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
};
