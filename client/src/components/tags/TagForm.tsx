import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
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
import { Card, CardContent } from '@/components/ui/card';
import { Tag, TAG_COLORS, TAG_ICONS } from '@/types/tags';
import { TagIcon } from './TagIcon';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const tagFormSchema = z.object({
  name: z.string().min(1, 'El nombre es obligatorio').max(50, 'Máximo 50 caracteres'),
  color: z.string(),
  icon: z.string(),
});

type TagFormValues = z.infer<typeof tagFormSchema>;

interface TagFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Tag | null;
  onSubmit: (data: TagFormValues) => Promise<void>;
}

export function TagForm({ open, onOpenChange, tag, onSubmit }: TagFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!tag;

  const form = useForm<TagFormValues>({
    resolver: zodResolver(tagFormSchema),
    defaultValues: {
      name: '',
      color: TAG_COLORS[10], // blue
      icon: 'tag',
    },
  });

  useEffect(() => {
    if (tag) {
      form.reset({
        name: tag.name,
        color: tag.color,
        icon: tag.icon,
      });
    } else {
      form.reset({
        name: '',
        color: TAG_COLORS[10],
        icon: 'tag',
      });
    }
  }, [tag, form, open]);

  const handleSubmit = async (values: TagFormValues) => {
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedColor = form.watch('color');
  const selectedIcon = form.watch('icon');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar etiqueta' : 'Nueva etiqueta'}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? 'Modifica los datos de la etiqueta.'
              : 'Crea una nueva etiqueta para clasificar tus tareas.'}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 mt-6">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nombre *</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Nombre de la etiqueta" 
                      className="h-11"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {TAG_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => field.onChange(color)}
                          className={cn(
                            'w-9 h-9 rounded-full transition-all duration-200 flex items-center justify-center',
                            'hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
                            field.value === color && 'ring-2 ring-foreground ring-offset-2 scale-110'
                          )}
                          style={{ backgroundColor: color }}
                        >
                          {field.value === color && (
                            <Check className="h-4 w-4 text-white drop-shadow-sm" />
                          )}
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="icon"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Icono</FormLabel>
                  <FormControl>
                    <div className="flex flex-wrap gap-2">
                      {TAG_ICONS.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          onClick={() => field.onChange(icon)}
                          className={cn(
                            'w-11 h-11 rounded-xl border-2 flex items-center justify-center transition-all duration-200',
                            'hover:border-primary/50 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring',
                            field.value === icon
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border text-muted-foreground'
                          )}
                        >
                          <TagIcon icon={icon} size={20} />
                        </button>
                      ))}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Preview */}
            <div className="space-y-2">
              <FormLabel>Vista previa</FormLabel>
              <Card className="border-border/50">
                <CardContent className="p-4 flex items-center justify-center">
                  <div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium shadow-sm"
                    style={{
                      backgroundColor: `${selectedColor}15`,
                      borderColor: `${selectedColor}40`,
                      color: selectedColor,
                    }}
                  >
                    <TagIcon icon={selectedIcon} size={16} />
                    <span>{form.watch('name') || 'Nombre'}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting} className="shadow-sm">
                {isSubmitting ? 'Guardando...' : isEditing ? 'Guardar cambios' : 'Crear etiqueta'}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
