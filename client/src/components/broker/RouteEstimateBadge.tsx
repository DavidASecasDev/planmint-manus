import { useEffect } from 'react';
import { useRouteEstimate, type RouteEstimate } from '@/hooks/useRouteEstimate';
import { Clock, MapPin, Loader2, AlertCircle, RefreshCw } from 'lucide-react';

interface RouteEstimateBadgeProps {
  origin: string;
  destination: string;
  /** Compact mode for inline display in form cards */
  compact?: boolean;
  /** Called when estimate is fetched, useful for parent state */
  onEstimate?: (estimate: RouteEstimate | null) => void;
}

/**
 * Displays an inline badge with estimated travel time and distance
 * between two locations. Fetches from Google Maps Directions API.
 */
export function RouteEstimateBadge({
  origin,
  destination,
  compact = false,
  onEstimate,
}: RouteEstimateBadgeProps) {
  const { estimate, isLoading, error, fetchEstimate, clearEstimate } = useRouteEstimate();

  useEffect(() => {
    if (origin && destination && origin.trim().length >= 3 && destination.trim().length >= 3) {
      fetchEstimate(origin, destination);
    } else {
      clearEstimate();
    }
  }, [origin, destination, fetchEstimate, clearEstimate]);

  useEffect(() => {
    onEstimate?.(estimate);
  }, [estimate, onEstimate]);

  // Don't render anything if no inputs
  if (!origin || !destination || origin.trim().length < 3 || destination.trim().length < 3) {
    return null;
  }

  if (isLoading) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs"
        style={{
          backgroundColor: '#F0F9FF',
          color: '#0369A1',
          fontFamily: 'Barlow, sans-serif',
          fontWeight: 500,
        }}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Calculando ruta...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs cursor-pointer"
        style={{
          backgroundColor: '#FFF7ED',
          color: '#C2410C',
          fontFamily: 'Barlow, sans-serif',
          fontWeight: 500,
        }}
        onClick={() => fetchEstimate(origin, destination)}
        title="Clic para reintentar"
      >
        <AlertCircle className="h-3 w-3" />
        <span className="truncate max-w-[150px]">{error}</span>
        <RefreshCw className="h-3 w-3 ml-0.5" />
      </div>
    );
  }

  if (!estimate) return null;

  if (compact) {
    return (
      <div
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs"
        style={{
          backgroundColor: '#ECFDF5',
          color: '#065F46',
          fontFamily: 'Barlow, sans-serif',
          fontWeight: 600,
        }}
        title={`${estimate.distance_text} · ${estimate.duration_text}`}
      >
        <Clock className="h-3 w-3" />
        <span>{estimate.duration_text}</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-3 px-3 py-1.5 rounded-md text-xs"
      style={{
        backgroundColor: '#ECFDF5',
        border: '1px solid #D1FAE5',
        fontFamily: 'Barlow, sans-serif',
      }}
    >
      <div className="flex items-center gap-1" style={{ color: '#065F46', fontWeight: 600 }}>
        <Clock className="h-3.5 w-3.5" />
        <span>{estimate.duration_text}</span>
      </div>
      <div className="w-px h-3 bg-emerald-300" />
      <div className="flex items-center gap-1" style={{ color: '#047857' }}>
        <MapPin className="h-3.5 w-3.5" />
        <span>{estimate.distance_text}</span>
      </div>
      <button
        onClick={() => fetchEstimate(origin, destination)}
        className="ml-1 text-emerald-500 hover:text-emerald-700 transition-colors"
        title="Actualizar estimación"
      >
        <RefreshCw className="h-3 w-3" />
      </button>
    </div>
  );
}
