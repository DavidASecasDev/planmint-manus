/**
 * AddressAutocompleteCell — An editable cell with Google Places autocomplete
 * for the "Dirección" column in the reservations table.
 * 
 * Behavior:
 * - Click to edit (same as EditableCell)
 * - While typing, shows autocomplete suggestions from Google Places
 * - Selecting a suggestion fills the field with the full address
 * - User can also type a custom address and press Enter
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MapPin } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface Prediction {
  description: string;
  placeId: string;
  mainText: string;
  secondaryText: string;
}

interface AddressAutocompleteCellProps {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function AddressAutocompleteCell({
  value,
  onChange,
  disabled,
  className,
  placeholder = '—'
}: AddressAutocompleteCellProps) {
  const { session } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isEditing) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleBlur();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, editValue]);

  const fetchPredictions = useCallback(async (input: string) => {
    if (!input || input.trim().length < 3 || !session?.access_token) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    try {
      const res = await fetch('/api/places-autocomplete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ input: input.trim() }),
      });

      const json = await res.json();
      if (json.ok && json.predictions?.length > 0) {
        setPredictions(json.predictions);
        setShowDropdown(true);
        setSelectedIndex(-1);
      } else {
        setPredictions([]);
        setShowDropdown(false);
      }
    } catch {
      setPredictions([]);
      setShowDropdown(false);
    }
  }, [session?.access_token]);

  const handleInputChange = (val: string) => {
    setEditValue(val);
    
    // Debounce autocomplete requests (300ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPredictions(val);
    }, 300);
  };

  const handleClick = () => {
    if (disabled) return;
    setEditValue(value || '');
    setIsEditing(true);
    setPredictions([]);
    setShowDropdown(false);
  };

  const handleBlur = () => {
    setIsEditing(false);
    setShowDropdown(false);
    setPredictions([]);
    const newValue = editValue.trim() || null;
    if (newValue !== value) {
      onChange(newValue);
    }
  };

  const handleSelectPrediction = (prediction: Prediction) => {
    setEditValue(prediction.description);
    setShowDropdown(false);
    setPredictions([]);
    setIsEditing(false);
    if (prediction.description !== value) {
      onChange(prediction.description);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (showDropdown && predictions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, predictions.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < predictions.length) {
          handleSelectPrediction(predictions[selectedIndex]);
        } else {
          handleBlur();
        }
      } else if (e.key === 'Escape') {
        setShowDropdown(false);
        setIsEditing(false);
        setEditValue(value || '');
      }
    } else {
      if (e.key === 'Enter') {
        handleBlur();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
        setEditValue(value || '');
      }
    }
  };

  if (isEditing) {
    return (
      <div ref={containerRef} className="relative">
        <Input
          ref={inputRef}
          value={editValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className={cn("h-7 text-xs pr-6", className)}
          placeholder="Escribe una dirección..."
        />
        <MapPin className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        
        {showDropdown && predictions.length > 0 && (
          <div className="absolute z-50 top-full left-0 mt-1 w-72 bg-popover border border-border rounded-md shadow-lg overflow-hidden">
            {predictions.map((pred, idx) => (
              <button
                key={pred.placeId}
                type="button"
                className={cn(
                  "w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-start gap-2",
                  idx === selectedIndex && "bg-accent"
                )}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur
                  handleSelectPrediction(pred);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="font-medium truncate">{pred.mainText}</div>
                  {pred.secondaryText && (
                    <div className="text-muted-foreground truncate text-[10px]">{pred.secondaryText}</div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        "relative w-full max-w-full text-left px-2 py-1 text-xs rounded hover:bg-muted/50 transition-colors truncate min-h-[28px] flex items-center gap-1",
        !value && "text-muted-foreground",
        disabled && "cursor-default hover:bg-transparent",
        className
      )}
    >
      {value && <MapPin className="h-3 w-3 shrink-0 text-muted-foreground" />}
      <span className="truncate">{value || placeholder}</span>
    </button>
  );
}
