import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TransferBroker, useTransferBrokers } from '@/hooks/useTransferBrokers';
import { Loader2 } from 'lucide-react';

const brokerSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  company: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
});

type BrokerFormData = z.infer<typeof brokerSchema>;

interface BrokerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  broker?: TransferBroker | null;
}

export function BrokerDialog({ open, onOpenChange, broker }: BrokerDialogProps) {
  const { createBroker, updateBrokerFull, isCreating, isUpdating } = useTransferBrokers();
  const isEditing = !!broker;

  const form = useForm<BrokerFormData>({
    resolver: zodResolver(brokerSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (broker) {
      form.reset({
        name: broker.name,
        company: broker.company || '',
        email: broker.email || '',
        phone: broker.phone || '',
      });
    } else {
      form.reset({
        name: '',
        company: '',
        email: '',
        phone: '',
      });
    }
  }, [broker, form, open]);

  const onSubmit = async (data: BrokerFormData) => {
    try {
      if (isEditing && broker) {
        await updateBrokerFull({
          id: broker.id,
          name: data.name,
          company: data.company || null,
          email: data.email || null,
          phone: data.phone || null,
        });
      } else {
        await createBroker({
          name: data.name,
          company: data.company || null,
          email: data.email || null,
          phone: data.phone || null,
        });
      }
      onOpenChange(false);
    } catch (error) {
      // Error is handled by the hook
    }
  };

  const isSubmitting = isCreating || isUpdating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Broker' : 'Nuevo Broker'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre del broker" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Empresa</FormLabel>
                  <FormControl>
                    <Input placeholder="Nombre de la empresa" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="email@ejemplo.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Teléfono</FormLabel>
                  <FormControl>
                    <Input placeholder="+34 600 000 000" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? 'Guardar' : 'Crear'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
