import { useState } from 'react';
import { Check, Plus, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDropdownOptions } from '@/hooks/useDropdownOptions';
import { DropdownFieldName } from '@/types/reservations';

interface ChipSelectProps {
  fieldName: DropdownFieldName;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}

const PRESET_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#6b7280', // gray
  '#14b8a6', // teal
];

export function ChipSelect({ fieldName, value, onChange, disabled }: ChipSelectProps) {
  const { getOptionsForField, createOption } = useDropdownOptions();
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  
  const options = getOptionsForField(fieldName);
  const selectedOption = options.find(o => o.label === value);

  const handleCreate = async () => {
    if (!newLabel.trim()) return;
    
    try {
      const result = await createOption.mutateAsync({
        field_name: fieldName,
        label: newLabel.trim(),
        color: newColor,
      });
      onChange(result.label);
      setNewLabel('');
      setIsCreating(false);
      setOpen(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleSelect = (label: string) => {
    onChange(value === label ? null : label);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button 
          variant="ghost" 
          size="sm"
          className="h-7 px-2 justify-between min-w-[80px] max-w-full hover:bg-muted/50 overflow-hidden"
        >
          {selectedOption ? (
            <Badge
              variant="outline"
              className="border-0 font-normal truncate"
              style={{ 
                backgroundColor: `${selectedOption.color}20`,
                color: selectedOption.color,
              }}
            >
              {selectedOption.label}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
          <ChevronDown className="h-3 w-3 ml-1 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="start">
        {isCreating ? (
          <div className="p-2 space-y-3">
            <Input
              placeholder="Nombre de la opción"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className="h-8"
              autoFocus
            />
            <div className="flex gap-1 flex-wrap">
              {PRESET_COLORS.map((color) => (
                <button
                  type="button"
                  key={color}
                  className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all",
                    newColor === color ? "border-foreground scale-110" : "border-transparent"
                  )}
                  style={{ backgroundColor: color }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewColor(color);
                  }}
                />
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreating(false);
                  setNewLabel('');
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCreate();
                }}
                disabled={!newLabel.trim() || createOption.isPending}
              >
                Crear
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="max-h-48 overflow-auto">
              {options.map((option) => (
                <button
                  type="button"
                  key={option.id}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors",
                    value === option.label && "bg-muted"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(option.label);
                  }}
                >
                  <Badge
                    variant="outline"
                    className="border-0 font-normal"
                    style={{ 
                      backgroundColor: `${option.color}20`,
                      color: option.color,
                    }}
                  >
                    {option.label}
                  </Badge>
                  {value === option.label && (
                    <Check className="h-3 w-3 ml-auto" />
                  )}
                </button>
              ))}
              {options.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-3 text-center">
                  Sin opciones
                </p>
              )}
            </div>
            <div className="border-t mt-1 pt-1">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-sm hover:bg-muted transition-colors text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsCreating(true);
                }}
              >
                <Plus className="h-3 w-3" />
                Crear nueva opción
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
