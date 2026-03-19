import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TransferBroker, useTransferBrokers } from '@/hooks/useTransferBrokers';
import { Loader2, KeyRound, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

const portalSchema = z.object({
  email: z.string().email('Email inválido'),
});

type PortalFormData = z.infer<typeof portalSchema>;

interface BrokerPortalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  broker: TransferBroker;
}

export function BrokerPortalDialog({ open, onOpenChange, broker }: BrokerPortalDialogProps) {
  const { setupPortalAccess, isSettingUpPortal } = useTransferBrokers();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const form = useForm<PortalFormData>({
    resolver: zodResolver(portalSchema),
    defaultValues: {
      email: broker.email || '',
    },
  });

  const onSubmit = async (data: PortalFormData) => {
    try {
      const response = await setupPortalAccess({
        brokerId: broker.id,
        email: data.email,
      });
      
      if (response.success) {
        setResult({
          success: true,
          message: response.already_linked 
            ? 'El broker ya tenía acceso al portal vinculado.'
            : 'Acceso al portal configurado correctamente. El broker puede iniciar sesión.',
        });
        // Close after short delay on success
        setTimeout(() => {
          onOpenChange(false);
          setResult(null);
        }, 2000);
      } else {
        setResult({
          success: false,
          message: response.error || 'Error al configurar el acceso',
        });
      }
    } catch (error: any) {
      setResult({
        success: false,
        message: error.message || 'Error al configurar el acceso',
      });
    }
  };

  const handleClose = () => {
    setResult(null);
    form.reset({ email: broker.email || '' });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Configurar Acceso al Portal
          </DialogTitle>
          <DialogDescription>
            Vincula una cuenta de usuario al broker <strong>{broker.name}</strong> para que pueda acceder al portal de brokers.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            El email debe corresponder a una cuenta de usuario existente en el sistema. Si el usuario no tiene cuenta, deberá registrarse primero.
          </AlertDescription>
        </Alert>

        {result && (
          <Alert variant={result.success ? 'default' : 'destructive'}>
            <AlertDescription>{result.message}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email del usuario</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="usuario@ejemplo.com" 
                      {...field} 
                    />
                  </FormControl>
                  <FormDescription>
                    Email de la cuenta de usuario a vincular con este broker
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isSettingUpPortal}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSettingUpPortal || result?.success}>
                {isSettingUpPortal && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Vincular Acceso
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
