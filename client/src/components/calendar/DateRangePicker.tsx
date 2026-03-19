import { useState } from 'react';
import { format, addDays, startOfMonth, endOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import { CalendarIcon, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import type { DateRange } from 'react-day-picker';

interface DateRangePickerProps {
  dateFrom: Date | null;
  dateTo: Date | null;
  onChangeRange: (from: Date | null, to: Date | null) => void;
}

export function DateRangePicker({ dateFrom, dateTo, onChangeRange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (range: DateRange | undefined) => {
    onChangeRange(range?.from || null, range?.to || null);
  };

  const handleQuickSelect = (from: Date, to: Date) => {
    onChangeRange(from, to);
    setOpen(false);
  };

  const clearRange = () => {
    onChangeRange(null, null);
  };

  const today = new Date();

  const hasRange = dateFrom !== null || dateTo !== null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "gap-2",
            hasRange && "border-primary"
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          {hasRange ? (
            <span className="flex items-center gap-1">
              {dateFrom && format(dateFrom, 'd MMM', { locale: es })}
              {dateFrom && dateTo && ' - '}
              {dateTo && format(dateTo, 'd MMM', { locale: es })}
              {hasRange && (
                <Badge variant="secondary" className="ml-1 h-5 px-1">
                  Rango
                </Badge>
              )}
            </span>
          ) : (
            <span>Rango de fechas</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex">
          {/* Quick selections */}
          <div className="border-r p-2 space-y-1">
            <p className="text-xs font-medium text-muted-foreground px-2 mb-2">
              Accesos rápidos
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => handleQuickSelect(today, addDays(today, 2))}
            >
              Próximos 3 días
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => handleQuickSelect(today, addDays(today, 6))}
            >
              Próximos 7 días
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => handleQuickSelect(today, addDays(today, 13))}
            >
              Próximas 2 semanas
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-xs"
              onClick={() => handleQuickSelect(startOfMonth(today), endOfMonth(today))}
            >
              Este mes
            </Button>
            {hasRange && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-xs text-destructive hover:text-destructive"
                onClick={clearRange}
              >
                <X className="h-3 w-3 mr-1" />
                Limpiar
              </Button>
            )}
          </div>
          
          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              selected={{
                from: dateFrom || undefined,
                to: dateTo || undefined,
              }}
              onSelect={handleSelect}
              numberOfMonths={2}
              locale={es}
              className="pointer-events-auto"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
