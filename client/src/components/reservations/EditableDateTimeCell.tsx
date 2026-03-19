import { useState, useRef, useEffect } from 'react';
import { parse, isValid } from 'date-fns';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface EditableDateTimeCellProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
}

export function EditableDateTimeCell({ 
  value, 
  onChange, 
  disabled,
  className,
}: EditableDateTimeCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Extract date/time components directly from ISO string to avoid timezone conversion
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      // Extract components directly from ISO string to preserve operational hours
      const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (match) {
        const [, year, month, day, hour, minute] = match;
        return `${day}/${month}/${year} ${hour}:${minute}`;
      }
      return '—';
    } catch {
      return '—';
    }
  };

  // Extract components for editing without timezone conversion
  const extractEditValue = (dateStr: string | null): string => {
    if (!dateStr) return '';
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
    if (match) {
      const [, year, month, day, hour, minute] = match;
      return `${day}/${month}/${year} ${hour}:${minute}`;
    }
    return '';
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (disabled) return;
    setEditValue(extractEditValue(value));
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    
    if (!trimmed) {
      if (value !== null) {
        onChange(null);
      }
      return;
    }
    
    // Normalize a value to just "YYYY-MM-DDTHH:mm" for comparison
    const normalize = (s: string) => {
      const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : s;
    };

    // Try to parse the date
    const parsed = parse(trimmed, 'dd/MM/yyyy HH:mm', new Date());
    if (isValid(parsed)) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      const hours = String(parsed.getHours()).padStart(2, '0');
      const minutes = String(parsed.getMinutes()).padStart(2, '0');
      
      const newIso = `${year}-${month}-${day}T${hours}:${minutes}:00+00:00`;
      if (!value || normalize(newIso) !== normalize(value)) {
        onChange(newIso);
      }
    } else {
      // Try without time
      const parsedDate = parse(trimmed, 'dd/MM/yyyy', new Date());
      if (isValid(parsedDate)) {
        const year = parsedDate.getFullYear();
        const month = String(parsedDate.getMonth() + 1).padStart(2, '0');
        const day = String(parsedDate.getDate()).padStart(2, '0');
        
        const newIso = `${year}-${month}-${day}T00:00:00+00:00`;
        if (!value || normalize(newIso) !== normalize(value)) {
          onChange(newIso);
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        placeholder="dd/mm/yyyy hh:mm"
        className={cn("h-7 text-xs w-32", className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "w-full text-left px-1 py-1 text-xs rounded hover:bg-muted/50 transition-colors truncate",
        !value && "text-muted-foreground",
        disabled && "cursor-default hover:bg-transparent",
        className
      )}
    >
      {formatDateTime(value)}
    </button>
  );
}