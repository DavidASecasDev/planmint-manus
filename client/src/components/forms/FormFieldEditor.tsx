import { useState } from "react";
import { FormField, FormFieldType, FORM_FIELD_TYPES, TASK_FIELD_MAPPINGS, TRANSFER_FIELD_MAPPINGS, FormFieldOption, FormEntityType } from "@/types/forms";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  GripVertical, 
  Trash2, 
  ChevronDown, 
  Plus, 
  X,
  Type,
  AlignLeft,
  Hash,
  Mail,
  Phone,
  Calendar,
  Clock,
  ChevronDownIcon,
  CheckSquare,
  Square,
  Upload,
  Star
} from "lucide-react";

const FIELD_ICONS: Record<FormFieldType, React.ReactNode> = {
  text: <Type className="h-4 w-4" />,
  textarea: <AlignLeft className="h-4 w-4" />,
  number: <Hash className="h-4 w-4" />,
  email: <Mail className="h-4 w-4" />,
  phone: <Phone className="h-4 w-4" />,
  date: <Calendar className="h-4 w-4" />,
  datetime: <Clock className="h-4 w-4" />,
  select: <ChevronDownIcon className="h-4 w-4" />,
  multi_select: <CheckSquare className="h-4 w-4" />,
  checkbox: <Square className="h-4 w-4" />,
  file: <Upload className="h-4 w-4" />,
  rating: <Star className="h-4 w-4" />,
};

interface FormFieldEditorProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onDelete: () => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
  entityType?: FormEntityType;
}

export function FormFieldEditor({ 
  field, 
  onUpdate, 
  onDelete,
  dragHandleProps,
  entityType = 'task'
}: FormFieldEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [options, setOptions] = useState<FormFieldOption[]>(field.options || []);

  const needsOptions = field.type === 'select' || field.type === 'multi_select';

  const handleAddOption = () => {
    const newOption = { value: `option_${options.length + 1}`, label: '' };
    const updated = [...options, newOption];
    setOptions(updated);
    onUpdate({ options: updated });
  };

  const handleUpdateOption = (index: number, label: string) => {
    const updated = options.map((opt, i) => 
      i === index ? { ...opt, label, value: label.toLowerCase().replace(/\s+/g, '_') } : opt
    );
    setOptions(updated);
    onUpdate({ options: updated });
  };

  const handleRemoveOption = (index: number) => {
    const updated = options.filter((_, i) => i !== index);
    setOptions(updated);
    onUpdate({ options: updated });
  };

  return (
    <Card className="border-l-4 border-l-primary/50">
      <CardHeader className="p-3">
        <div className="flex items-center gap-2">
          <div 
            {...dragHandleProps} 
            className="cursor-grab hover:bg-muted rounded p-1"
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>
          
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {FIELD_ICONS[field.type]}
            <span className="font-medium truncate">{field.label || 'Sin nombre'}</span>
            {field.is_required && (
              <span className="text-destructive">*</span>
            )}
          </div>

          <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>

          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </CardHeader>

      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <CardContent className="p-3 pt-0 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Etiqueta</Label>
                <Input
                  value={field.label}
                  onChange={(e) => onUpdate({ label: e.target.value })}
                  placeholder="Nombre del campo"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={field.type}
                  onValueChange={(value) => onUpdate({ type: value as FormFieldType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORM_FIELD_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          {FIELD_ICONS[type.value]}
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Placeholder</Label>
              <Input
                value={field.placeholder || ''}
                onChange={(e) => onUpdate({ placeholder: e.target.value })}
                placeholder="Texto de ayuda dentro del campo"
              />
            </div>

            <div className="space-y-2">
              <Label>Texto de ayuda</Label>
              <Textarea
                value={field.help_text || ''}
                onChange={(e) => onUpdate({ help_text: e.target.value })}
                placeholder="Descripción adicional para el usuario"
                rows={2}
              />
            </div>

            {needsOptions && (
              <div className="space-y-2">
                <Label>Opciones</Label>
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={option.label}
                        onChange={(e) => handleUpdateOption(index, e.target.value)}
                        placeholder={`Opción ${index + 1}`}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveOption(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddOption}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Añadir opción
                  </Button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ancho</Label>
                <Select
                  value={field.width}
                  onValueChange={(value) => onUpdate({ width: value as 'full' | 'half' })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="full">Completo</SelectItem>
                    <SelectItem value="half">Mitad</SelectItem>
                  </SelectContent>
                </Select>
              </div>

            {entityType === 'transfer_request' && (
              <div className="space-y-2">
                <Label>Mapear a campo de transfer</Label>
                <Select
                  value={field.maps_to_transfer_field || 'none'}
                  onValueChange={(value) => onUpdate({ 
                    maps_to_transfer_field: value === 'none' ? null : value 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin mapeo</SelectItem>
                    {TRANSFER_FIELD_MAPPINGS.map((mapping) => (
                      <SelectItem key={mapping.value} value={mapping.value}>
                        {mapping.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {entityType === 'task' && (
              <div className="space-y-2">
                <Label>Mapear a campo de tarea</Label>
                <Select
                  value={field.maps_to_task_field || 'none'}
                  onValueChange={(value) => onUpdate({ 
                    maps_to_task_field: value === 'none' ? null : value 
                  })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin mapeo</SelectItem>
                    {TASK_FIELD_MAPPINGS.map((mapping) => (
                      <SelectItem key={mapping.value} value={mapping.value}>
                        {mapping.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor={`required-${field.id}`}>Campo obligatorio</Label>
              <Switch
                id={`required-${field.id}`}
                checked={field.is_required}
                onCheckedChange={(checked) => onUpdate({ is_required: checked })}
              />
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
