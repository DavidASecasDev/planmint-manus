/**
 * AddressAutocompleteCell — An editable cell with Google Places autocomplete
 * for the "Dirección" column in the reservations table.
 * 
 * Uses a React Portal to render the dropdown outside the table's overflow:hidden
 * ScrollArea, ensuring suggestions are always visible.
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MapPin, Loader2 } from 'lucide-react';
import { apiInvoke } from '@/lib/apiClient';

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
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Calculate dropdown position relative to viewport, flipping upward if needed
  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const dropdownHeight = predictions.length * 44 + 8; // approx height per item + padding
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    // If not enough space below and more space above, flip upward
    const flipUp = spaceBelow < dropdownHeight && spaceAbove > spaceBelow;
    setDropdownPos({
      top: flipUp ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 300),
    });
  }, [predictions.length]);

  // Update position when dropdown shows or on scroll
  useEffect(() => {
    if (!showDropdown || !isEditing) return;
    updateDropdownPosition();

    // Update on scroll/resize
    const handleScroll = () => updateDropdownPosition();
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [showDropdown, isEditing, updateDropdownPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isEditing) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        handleBlur();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isEditing, editValue]);

  const fetchPredictions = useCallback(async (input: string) => {
    if (!input || input.trim().length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await apiInvoke<{ ok: boolean; predictions: Prediction[] }>(
        'places-autocomplete',
        { body: { input: input.trim() } }
      );

      if (!error && data && data.ok && data.predictions?.length > 0) {
        setPredictions(data.predictions);
        setShowDropdown(true);
        setSelectedIndex(-1);
        // Update position after setting predictions
        requestAnimationFrame(updateDropdownPosition);
      } else {
        setPredictions([]);
        setShowDropdown(false);
      }
    } catch (err) {
      console.error('[AddressAutocomplete] Error:', err);
      setPredictions([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, [updateDropdownPosition]);

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

  // Render the dropdown via Portal to escape overflow:hidden ancestors
  const renderDropdown = () => {
    if (!showDropdown || predictions.length === 0 || !dropdownPos) return null;

    return createPortal(
      <div
        ref={dropdownRef}
        className="fixed bg-popover border border-border rounded-md shadow-lg overflow-auto"
        style={{
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
          maxHeight: Math.min(predictions.length * 44 + 8, 280),
          zIndex: 9999,
        }}
      >
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
      </div>,
      document.body
    );
  };

  if (isEditing) {
    return (
      <>
        <div ref={containerRef} className="relative">
          <Input
            ref={inputRef}
            value={editValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn("h-7 text-xs pr-7", className)}
            placeholder="Escribe una dirección..."
          />
          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none">
            {isLoading ? (
              <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
            ) : (
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </div>
        {renderDropdown()}
      </>
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
