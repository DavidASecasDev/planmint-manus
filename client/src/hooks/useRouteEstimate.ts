import { useState, useCallback, useRef } from 'react';
import { apiInvoke } from '@/lib/apiClient';

export interface RouteEstimate {
  duration_text: string;
  duration_seconds: number;
  distance_text: string;
  distance_meters: number;
}

interface RouteEstimateState {
  estimate: RouteEstimate | null;
  isLoading: boolean;
  error: string | null;
}

interface RouteEstimateApiResult {
  ok: boolean;
  duration_text?: string;
  duration_seconds?: number;
  distance_text?: string;
  distance_meters?: number;
  error?: string;
}

/**
 * Hook to fetch route estimates between two locations using Google Maps Directions API.
 * Includes debounce to avoid excessive API calls.
 */
export function useRouteEstimate() {
  const [state, setState] = useState<RouteEstimateState>({
    estimate: null,
    isLoading: false,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchEstimate = useCallback(
    (origin: string, destination: string) => {
      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // Abort previous request
      if (abortRef.current) {
        abortRef.current.abort();
      }

      // Validate inputs
      if (!origin || !destination || origin.trim().length < 3 || destination.trim().length < 3) {
        setState({ estimate: null, isLoading: false, error: null });
        return;
      }

      setState(prev => ({ ...prev, isLoading: true, error: null }));

      debounceRef.current = setTimeout(async () => {
        const controller = new AbortController();
        abortRef.current = controller;

        try {
          const response = await apiInvoke<RouteEstimateApiResult>(
            '/api/transfer-route-estimate',
            {
              body: {
                origin: origin.trim(),
                destination: destination.trim(),
              },
            }
          );

          if (controller.signal.aborted) return;

          const result = response.data;

          if (result?.ok && result.duration_text) {
            setState({
              estimate: {
                duration_text: result.duration_text,
                duration_seconds: result.duration_seconds!,
                distance_text: result.distance_text!,
                distance_meters: result.distance_meters!,
              },
              isLoading: false,
              error: null,
            });
          } else {
            setState({
              estimate: null,
              isLoading: false,
              error: result?.error || 'No se pudo estimar la ruta',
            });
          }
        } catch (err: unknown) {
          if (controller.signal.aborted) return;
          setState({
            estimate: null,
            isLoading: false,
            error: 'Error al conectar con el servicio de rutas',
          });
        }
      }, 800); // 800ms debounce
    },
    []
  );

  const clearEstimate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();
    setState({ estimate: null, isLoading: false, error: null });
  }, []);

  return {
    ...state,
    fetchEstimate,
    clearEstimate,
  };
}
