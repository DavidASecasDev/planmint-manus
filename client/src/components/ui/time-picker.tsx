import React, { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';

interface TimePickerProps {
  value: string; // "HH:MM" format
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

/**
 * Custom time picker that avoids native <input type="time"> issues on Mac/Safari.
 * Uses two scroll-friendly number inputs (hours 0-23, minutes 0-59) with increment/decrement buttons.
 */
export function TimePicker({ value, onChange, label, className }: TimePickerProps) {
  const [hours, setHours] = useState(() => {
    if (!value) return 0;
    const [h] = value.split(':').map(Number);
    return isNaN(h) ? 0 : h;
  });
  const [minutes, setMinutes] = useState(() => {
    if (!value) return 0;
    const parts = value.split(':').map(Number);
    return isNaN(parts[1]) ? 0 : parts[1];
  });

  // Sync from parent value
  useEffect(() => {
    if (!value) return;
    const [h, m] = value.split(':').map(Number);
    if (!isNaN(h)) setHours(h);
    if (!isNaN(m)) setMinutes(m);
  }, [value]);

  const emitChange = useCallback((h: number, m: number) => {
    const hStr = String(h).padStart(2, '0');
    const mStr = String(m).padStart(2, '0');
    onChange(`${hStr}:${mStr}`);
  }, [onChange]);

  const incrementHours = () => {
    const newH = (hours + 1) % 24;
    setHours(newH);
    emitChange(newH, minutes);
  };

  const decrementHours = () => {
    const newH = (hours - 1 + 24) % 24;
    setHours(newH);
    emitChange(newH, minutes);
  };

  const incrementMinutes = () => {
    // Increment by 15 minutes for quick selection
    const newM = (minutes + 15) % 60;
    setMinutes(newM);
    emitChange(hours, newM);
  };

  const decrementMinutes = () => {
    const newM = (minutes - 15 + 60) % 60;
    setMinutes(newM);
    emitChange(hours, newM);
  };

  const handleHoursInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    let h = parseInt(val, 10);
    if (isNaN(h)) h = 0;
    if (h > 23) h = 23;
    setHours(h);
    emitChange(h, minutes);
  };

  const handleMinutesInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '');
    let m = parseInt(val, 10);
    if (isNaN(m)) m = 0;
    if (m > 59) m = 59;
    setMinutes(m);
    emitChange(hours, m);
  };

  // Handle scroll on the number inputs
  const handleHoursWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) incrementHours();
    else decrementHours();
  };

  const handleMinutesWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) incrementMinutes();
    else decrementMinutes();
  };

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && <span className="text-sm font-medium text-foreground">{label}</span>}
      <div className="flex items-center gap-1 bg-background border border-input rounded-md px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1">
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        
        {/* Hours */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={incrementHours}
            className="p-0 h-4 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/60"
            tabIndex={-1}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={String(hours).padStart(2, '0')}
            onChange={handleHoursInput}
            onWheel={handleHoursWheel}
            className="w-7 text-center text-sm font-mono font-medium bg-transparent outline-none select-all"
            maxLength={2}
          />
          <button
            type="button"
            onClick={decrementHours}
            className="p-0 h-4 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/60"
            tabIndex={-1}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        <span className="text-sm font-bold text-muted-foreground">:</span>

        {/* Minutes */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={incrementMinutes}
            className="p-0 h-4 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/60"
            tabIndex={-1}
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={String(minutes).padStart(2, '0')}
            onChange={handleMinutesInput}
            onWheel={handleMinutesWheel}
            className="w-7 text-center text-sm font-mono font-medium bg-transparent outline-none select-all"
            maxLength={2}
          />
          <button
            type="button"
            onClick={decrementMinutes}
            className="p-0 h-4 w-6 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded hover:bg-muted/60"
            tabIndex={-1}
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Quick presets */}
        <div className="ml-2 flex flex-wrap gap-1">
          {['00', '15', '30', '45'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => {
                const newM = parseInt(m, 10);
                setMinutes(newM);
                emitChange(hours, newM);
              }}
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded transition-colors",
                minutes === parseInt(m, 10)
                  ? "bg-primary/20 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
            >
              :{m}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
