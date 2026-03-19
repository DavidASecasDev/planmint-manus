import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface EditableCellProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function EditableCell({ 
  value, 
  onChange, 
  disabled,
  className,
  placeholder = '—'
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (disabled) return;
    setEditValue(value || '');
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const newValue = editValue.trim() || null;
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(value || '');
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
        className={cn("h-7 text-xs", className)}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "relative w-full max-w-full text-left px-2 py-1 text-xs rounded hover:bg-muted/50 transition-colors truncate min-h-[28px]",
        !value && "text-muted-foreground",
        disabled && "cursor-default hover:bg-transparent",
        className
      )}
    >
      {value || placeholder}
    </button>
  );
}
