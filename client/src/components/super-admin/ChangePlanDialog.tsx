import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { CreditCard, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChangePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgName: string;
  currentPlan: string;
  onConfirm: (newPlan: string) => void;
  isLoading?: boolean;
}

const PLANS = [
  { 
    value: 'free', 
    label: 'Free', 
    description: 'Funciones básicas',
    features: ['1 usuario', '20 tareas', '2 áreas']
  },
  { 
    value: 'pro', 
    label: 'Pro', 
    description: 'Para profesionales',
    features: ['3 usuarios', 'Tareas ilimitadas', '10 áreas', 'AI insights']
  },
  { 
    value: 'team', 
    label: 'Team', 
    description: 'Para equipos',
    features: ['Usuarios ilimitados', 'Todo ilimitado', 'Integraciones', 'SAML/SCIM']
  },
];

export function ChangePlanDialog({
  open,
  onOpenChange,
  orgName,
  currentPlan,
  onConfirm,
  isLoading,
}: ChangePlanDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState(currentPlan || 'free');

  const handleConfirm = () => {
    if (selectedPlan !== currentPlan) {
      onConfirm(selectedPlan);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle>Cambiar Plan</DialogTitle>
          </div>
          <DialogDescription>
            Cambia el plan de suscripción de <strong>{orgName}</strong>.
            <br />
            <span className="text-orange-600 text-xs">Nota: Esto no afecta la facturación de Stripe.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <Label className="mb-4 block">Selecciona un plan</Label>
          <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan} className="space-y-3">
            {PLANS.map((plan) => (
              <label
                key={plan.value}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-lg border cursor-pointer transition-colors',
                  selectedPlan === plan.value 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-muted-foreground/50'
                )}
              >
                <RadioGroupItem value={plan.value} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{plan.label}</span>
                    {plan.value === currentPlan && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">Actual</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                  <ul className="mt-2 space-y-1">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                        <Check className="h-3 w-3 text-green-600" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading || selectedPlan === currentPlan}>
            {isLoading ? 'Cambiando...' : 'Cambiar Plan'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
