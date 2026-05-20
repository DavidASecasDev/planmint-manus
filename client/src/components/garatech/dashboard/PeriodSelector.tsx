import { useState } from 'react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { PeriodPreset, DateRange } from '@/hooks/useGaratechStats';

interface PeriodSelectorProps {
  preset: PeriodPreset;
  dateRange: DateRange;
  onPresetChange: (preset: PeriodPreset) => void;
  onDateRangeChange: (range: DateRange) => void;
}

const PRESET_LABELS: Record<PeriodPreset, string> = {
  this_month: 'Este mes',
  quarter: 'Trimestre',
  year: 'Este año',
  custom: 'Personalizado',
};

export function PeriodSelector({
  preset,
  dateRange,
  onPresetChange,
  onDateRangeChange,
}: PeriodSelectorProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tempFrom, setTempFrom] = useState<Date | undefined>(dateRange.from);
  const [tempTo, setTempTo] = useState<Date | undefined>(dateRange.to);
  const [selectingEnd, setSelectingEnd] = useState(false);

  const handlePresetClick = (p: PeriodPreset) => {
    if (p === 'custom') {
      onPresetChange(p);
      setCalendarOpen(true);
    } else {
      onPresetChange(p);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (!date) return;

    if (!selectingEnd) {
      // Selecting start date
      setTempFrom(date);
      setTempTo(undefined);
      setSelectingEnd(true);
    } else {
      // Selecting end date
      if (date < (tempFrom || new Date())) {
        // If end is before start, swap
        setTempTo(tempFrom);
        setTempFrom(date);
      } else {
        setTempTo(date);
      }
      // Apply the range
      const from = tempFrom || dateRange.from;
      const to = date < from ? from : date;
      onDateRangeChange({ from: from < to ? from : to, to: from < to ? to : from });
      setSelectingEnd(false);
      setCalendarOpen(false);
    }
  };

  const formatRangeLabel = () => {
    if (preset !== 'custom') return PRESET_LABELS[preset];
    return `${format(dateRange.from, 'dd MMM yy', { locale: es })} - ${format(dateRange.to, 'dd MMM yy', { locale: es })}`;
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {/* Preset buttons */}
      {(['this_month', 'quarter', 'year'] as PeriodPreset[]).map((p) => (
        <Button
          key={p}
          variant={preset === p ? 'default' : 'outline'}
          size="sm"
          className="h-8 text-xs"
          onClick={() => handlePresetClick(p)}
        >
          {PRESET_LABELS[p]}
        </Button>
      ))}

      {/* Custom date range picker */}
      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={preset === 'custom' ? 'default' : 'outline'}
            size="sm"
            className={cn('h-8 text-xs gap-1.5', preset === 'custom' && 'min-w-[180px]')}
            onClick={() => {
              if (preset !== 'custom') {
                onPresetChange('custom');
              }
              setCalendarOpen(true);
              setSelectingEnd(false);
              setTempFrom(dateRange.from);
              setTempTo(dateRange.to);
            }}
          >
            <CalendarIcon className="h-3.5 w-3.5" />
            {preset === 'custom' ? formatRangeLabel() : 'Personalizado'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <div className="p-3 border-b">
            <p className="text-xs text-muted-foreground font-medium">
              {!selectingEnd ? 'Selecciona fecha inicio' : 'Selecciona fecha fin'}
            </p>
            {tempFrom && (
              <p className="text-xs mt-1">
                <span className="font-medium">Desde:</span> {format(tempFrom, 'dd MMM yyyy', { locale: es })}
                {tempTo && (
                  <>
                    {' → '}
                    <span className="font-medium">Hasta:</span> {format(tempTo, 'dd MMM yyyy', { locale: es })}
                  </>
                )}
              </p>
            )}
          </div>
          <Calendar
            mode="single"
            selected={selectingEnd ? tempTo : tempFrom}
            onSelect={handleCalendarSelect}
            disabled={(date) => date > new Date()}
            initialFocus
            locale={es}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
