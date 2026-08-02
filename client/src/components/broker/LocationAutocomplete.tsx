/**
 * LocationAutocomplete — A text input with Google Places autocomplete
 * for pickup/dropoff location fields in the transfer wizard.
 *
 * Uses the existing /api/places-autocomplete endpoint which biases
 * results towards Mallorca, Spain.
 *
 * Features:
 * - Debounced API calls (300ms) to avoid excessive requests
 * - Keyboard navigation (ArrowUp/Down, Enter, Escape)
 * - Portal-based dropdown to escape overflow:hidden parents
 * - Falls back to plain text input if API is unavailable
 * - Allows free-text entry (user can type any address)
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

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /** Called with full prediction data when user selects from dropdown */
  onSelect?: (data: { description: string; placeId: string }) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function LocationAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = 'Escribe una dirección...',
  className,
  disabled,
}: LocationAutocompleteProps) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isFocusedRef = useRef(false);

  // Calculate dropdown position relative to viewport
  const updateDropdownPosition = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(predictions.length * 56, 280); // ~56px per item, max 5 items

    // If not enough space below, show above
    const showAbove = spaceBelow < dropdownHeight + 8 && rect.top > dropdownHeight;

    setDropdownPos({
      top: showAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: Math.max(rect.width, 280),
    });
  }, [predictions.length]);

  // Update position when dropdown shows or on scroll
  useEffect(() => {
    if (!showDropdown) return;
    updateDropdownPosition();

    const handleScrollOrResize = () => updateDropdownPosition();
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [showDropdown, updateDropdownPosition]);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!showDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        inputRef.current && !inputRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setShowDropdown(false);
        setPredictions([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

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

      // Only update if the input is still focused (user hasn't moved on)
      if (!isFocusedRef.current) return;

      if (!error && data && data.ok && data.predictions?.length > 0) {
        setPredictions(data.predictions);
        setShowDropdown(true);
        setSelectedIndex(-1);
        requestAnimationFrame(updateDropdownPosition);
      } else {
        if (error) console.warn('[LocationAutocomplete] API error:', error);
        else if (data && !data.ok) console.warn('[LocationAutocomplete] API returned not ok:', data);
        setPredictions([]);
        setShowDropdown(false);
      }
    } catch (err) {
      console.error('[LocationAutocomplete] Error fetching predictions:', err);
      setPredictions([]);
      setShowDropdown(false);
    } finally {
      setIsLoading(false);
    }
  }, [updateDropdownPosition]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onChange(val);

    // Debounce autocomplete requests (300ms)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPredictions(val);
    }, 300);
  };

  const handleSelectPrediction = (prediction: Prediction) => {
    onChange(prediction.description);
    onSelect?.({ description: prediction.description, placeId: prediction.placeId });
    setShowDropdown(false);
    setPredictions([]);
    // Keep focus on input after selection
    inputRef.current?.focus();
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
          setShowDropdown(false);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowDropdown(false);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    // If there's text and we had predictions, re-show them
    if (value.trim().length >= 3 && predictions.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    // Delay hiding so click on dropdown can register
    setTimeout(() => {
      if (!isFocusedRef.current) {
        setShowDropdown(false);
      }
    }, 200);
  };

  // Render the dropdown via Portal to escape overflow:hidden ancestors
  const renderDropdown = () => {
    if (!showDropdown || predictions.length === 0 || !dropdownPos) return null;

    return createPortal(
      <div
        ref={dropdownRef}
        className="fixed bg-popover border border-border rounded-md shadow-lg overflow-hidden"
        style={{
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
          zIndex: 9999,
          maxHeight: 280,
          overflowY: 'auto',
        }}
      >
        {predictions.map((pred, idx) => (
          <button
            key={pred.placeId}
            type="button"
            className={cn(
              'w-full text-left px-3 py-2.5 text-sm hover:bg-accent transition-colors flex items-start gap-2.5',
              idx === selectedIndex && 'bg-accent'
            )}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent blur
              handleSelectPrediction(pred);
            }}
            onMouseEnter={() => setSelectedIndex(idx)}
          >
            <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <div className="font-medium truncate text-foreground">{pred.mainText}</div>
              {pred.secondaryText && (
                <div className="text-muted-foreground truncate text-xs">{pred.secondaryText}</div>
              )}
            </div>
          </button>
        ))}
        <div className="px-3 py-1.5 text-[10px] text-muted-foreground/60 border-t border-border bg-muted/30 flex items-center gap-1">
          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4l2 2" />
          </svg>
          Powered by Google Maps
        </div>
      </div>,
      document.body
    );
  };

  return (
    <>
      <div className="relative">
        <Input
          ref={inputRef}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={cn('pr-8 bg-background border-input text-foreground', className)}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
          {isLoading ? (
            <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
          ) : (
            <MapPin className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </div>
      {renderDropdown()}
    </>
  );
}
