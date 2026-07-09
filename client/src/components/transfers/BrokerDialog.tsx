import { useEffect, useState } from 'react';
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
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { apiInvoke } from '@/lib/apiClient';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const brokerCreateSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido'),
  phone: z.string().optional(),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});

const brokerEditSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  company: z.string().optional(),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
});

type BrokerCreateData = z.infer<typeof brokerCreateSchema>;
type BrokerEditData = z.infer<typeof brokerEditSchema>;

interface BrokerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  broker?: TransferBroker | null;
}

export function BrokerDialog({ open, onOpenChange, broker }: BrokerDialogProps) {
  const { updateBrokerFull, isUpdating } = useTransferBrokers();
  const queryClient = useQueryClient();
  const isEditing = !!broker;
  const [showPassword, setShowPassword] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const createForm = useForm<BrokerCreateData>({
    resolver: zodResolver(brokerCreateSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      password: '',
    },
  });

  const editForm = useForm<BrokerEditData>({
    resolver: zodResolver(brokerEditSchema),
    defaultValues: {
      name: '',
      company: '',
      email: '',
      phone: '',
    },
  });

  useEffect(() => {
    if (broker) {
      editForm.reset({
        name: broker.name,
        company: broker.company || '',
        email: broker.email || '',
        phone: broker.phone || '',
      });
    } else {
      createForm.reset({
        name: '',
        email: '',
        phone: '',
        password: '',
      });
    }
    setShowPassword(false);
  }, [broker, open]);

  const onCreateSubmit = async (data: BrokerCreateData) => {
    try {
      setIsCreating(true);
      const result = await apiInvoke<{ success: boolean; brokerId: string; error?: string }>('create-broker-with-auth', {
        body: {
          name: data.name,
          email: data.email,
          password: data.password,
          phone: data.phone || null,
        },
      });

      if (result.error) {
        toast.error(result.error.message || 'Error al crear broker');
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['transfer-brokers'], refetchType: 'active' });
      queryClient.invalidateQueries({ queryKey: ['transfer-brokers-all'], refetchType: 'active' });
      toast.success('Broker creado con acceso al portal');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Error al crear broker');
    } finally {
      setIsCreating(false);
    }
  };

  const onEditSubmit = async (data: BrokerEditData) => {
    try {
      if (broker) {
        await updateBrokerFull({
          id: broker.id,
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

        {isEditing ? (
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
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
                control={editForm.control}
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
                control={editForm.control}
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
                control={editForm.control}
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
                  Guardar
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
              <FormField
                control={createForm.control}
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
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email *</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="email@ejemplo.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={createForm.control}
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

              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña *</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Mínimo 6 caracteres"
                          {...field}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <p className="text-xs text-muted-foreground">
                El broker podrá iniciar sesión en el portal con este email y contraseña.
              </p>

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
                  Crear
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
