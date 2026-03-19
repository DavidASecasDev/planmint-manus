import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { FormWithFields, FormFieldType } from "@/types/forms";
import { usePublicFormSubmit } from "@/hooks/useForms";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, FileWarning, Loader2 } from "lucide-react";

export default function PublicForm() {
  const { slug } = useParams<{ slug: string }>();
  const { submit, isSubmitting } = usePublicFormSubmit();

  const [form, setForm] = useState<FormWithFields | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchForm = async () => {
      if (!slug) return;

      try {
        const { data: formData, error: formError } = await (supabase as any)
          .from('forms')
          .select('*')
          .eq('slug', slug)
          .eq('is_active', true)
          .eq('is_public', true)
          .maybeSingle();

        if (formError) throw formError;
        if (!formData) {
          setError('Formulario no encontrado o no disponible');
          setLoading(false);
          return;
        }

        // Check expiration
        if (formData.expires_at && new Date(formData.expires_at) < new Date()) {
          setError('Este formulario ha expirado');
          setLoading(false);
          return;
        }

        // Check max responses
        if (formData.max_responses && formData.response_count >= formData.max_responses) {
          setError('Este formulario ya no acepta más respuestas');
          setLoading(false);
          return;
        }

        // Fetch fields
        const { data: fieldsData, error: fieldsError } = await (supabase as any)
          .from('form_fields')
          .select('*')
          .eq('form_id', formData.id)
          .order('position');

        if (fieldsError) throw fieldsError;

        setForm({ ...formData, fields: fieldsData || [] });
      } catch (err) {
        console.error('Error fetching form:', err);
        setError('Error al cargar el formulario');
      } finally {
        setLoading(false);
      }
    };

    fetchForm();
  }, [slug]);

  const handleChange = (fieldName: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    // Clear validation error when user types
    if (validationErrors[fieldName]) {
      setValidationErrors(prev => {
        const { [fieldName]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    form?.fields.forEach(field => {
      const value = formData[field.name];
      
      if (field.is_required && (value === undefined || value === '' || value === null)) {
        errors[field.name] = 'Este campo es obligatorio';
      }

      if (field.type === 'email' && value && typeof value === 'string') {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
          errors[field.name] = 'Email inválido';
        }
      }

      if (field.min_length && typeof value === 'string' && value.length < field.min_length) {
        errors[field.name] = `Mínimo ${field.min_length} caracteres`;
      }

      if (field.max_length && typeof value === 'string' && value.length > field.max_length) {
        errors[field.name] = `Máximo ${field.max_length} caracteres`;
      }
    });

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form || !validate()) return;

    try {
      await submit({
        form_id: form.id,
        data: formData,
        submitter_email: formData.email as string | undefined,
        submitter_name: formData.name as string | undefined,
      });

      setSubmitted(true);

      // Handle redirect
      if (form.redirect_url) {
        setTimeout(() => {
          window.location.href = form.redirect_url!;
        }, 2000);
      }
    } catch (err) {
      console.error('Error submitting form:', err);
    }
  };

  const renderField = (field: FormWithFields['fields'][0]) => {
    const value = formData[field.name];
    const error = validationErrors[field.name];

    const commonProps = {
      id: field.name,
      placeholder: field.placeholder || undefined,
      className: error ? 'border-destructive' : '',
    };

    switch (field.type as FormFieldType) {
      case 'text':
      case 'email':
      case 'phone':
        return (
          <Input
            {...commonProps}
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
            value={(value as string) || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );

      case 'number':
        return (
          <Input
            {...commonProps}
            type="number"
            value={(value as number) || ''}
            onChange={(e) => handleChange(field.name, e.target.valueAsNumber || '')}
            min={field.min_value || undefined}
            max={field.max_value || undefined}
          />
        );

      case 'textarea':
        return (
          <Textarea
            {...commonProps}
            value={(value as string) || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
            rows={4}
          />
        );

      case 'date':
        return (
          <Input
            {...commonProps}
            type="date"
            value={(value as string) || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );

      case 'datetime':
        return (
          <Input
            {...commonProps}
            type="datetime-local"
            value={(value as string) || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );

      case 'select':
        return (
          <Select
            value={(value as string) || ''}
            onValueChange={(val) => handleChange(field.name, val)}
          >
            <SelectTrigger className={error ? 'border-destructive' : ''}>
              <SelectValue placeholder={field.placeholder || 'Seleccionar...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'checkbox':
        return (
          <div className="flex items-center gap-2">
            <Checkbox
              id={field.name}
              checked={(value as boolean) || false}
              onCheckedChange={(checked) => handleChange(field.name, checked)}
            />
            <Label htmlFor={field.name} className="font-normal">
              {field.label}
            </Label>
          </div>
        );

      case 'rating':
        return (
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleChange(field.name, star)}
                className={`text-2xl ${(value as number) >= star ? 'text-yellow-500' : 'text-muted-foreground'}`}
              >
                ★
              </button>
            ))}
          </div>
        );

      default:
        return (
          <Input
            {...commonProps}
            value={(value as string) || ''}
            onChange={(e) => handleChange(field.name, e.target.value)}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileWarning className="h-16 w-16 text-muted-foreground mb-4" />
            <h1 className="text-xl font-semibold mb-2">No disponible</h1>
            <p className="text-muted-foreground text-center">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-16 w-16 text-primary mb-4" />
            <h1 className="text-xl font-semibold mb-2">¡Enviado!</h1>
            <p className="text-muted-foreground text-center">
              {form?.success_message || '¡Gracias por tu respuesta!'}
            </p>
            {form?.redirect_url && (
              <p className="text-sm text-muted-foreground mt-4">
                Redirigiendo...
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {form?.custom_logo_url && (
          <div className="flex justify-center mb-6">
            <img 
              src={form.custom_logo_url} 
              alt="Logo" 
              className="h-12 object-contain"
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{form?.name}</CardTitle>
            {form?.description && (
              <CardDescription>{form.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4" style={{ 
                gridTemplateColumns: 'repeat(2, 1fr)' 
              }}>
                {form?.fields.map((field) => (
                  <div 
                    key={field.id} 
                    className={`space-y-2 ${field.width === 'full' ? 'col-span-2' : 'col-span-1'}`}
                  >
                    {field.type !== 'checkbox' && (
                      <Label htmlFor={field.name}>
                        {field.label}
                        {field.is_required && <span className="text-destructive ml-1">*</span>}
                      </Label>
                    )}
                    {renderField(field)}
                    {field.help_text && (
                      <p className="text-xs text-muted-foreground">{field.help_text}</p>
                    )}
                    {validationErrors[field.name] && (
                      <p className="text-xs text-destructive">{validationErrors[field.name]}</p>
                    )}
                  </div>
                ))}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting}
                style={form?.primary_color ? { backgroundColor: form.primary_color } : undefined}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Formulario creado con Planmint
        </p>
      </div>
    </div>
  );
}
