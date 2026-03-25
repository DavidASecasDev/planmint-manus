import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { WifiOff, RefreshCw } from 'lucide-react';

/**
 * Categorize errors into network vs server vs auth types
 */
function categorizeError(error: unknown): 'network' | 'timeout' | 'server' | 'auth' | 'unknown' {
  if (!error) return 'unknown';

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase();

  // Network errors (offline, DNS, CORS, etc.)
  if (
    message.includes('failed to fetch') ||
    message.includes('network') ||
    message.includes('net::') ||
    message.includes('error de red') ||
    message.includes('load failed') ||
    message.includes('networkerror')
  ) {
    return 'network';
  }

  // Timeout errors
  if (message.includes('timeout') || message.includes('aborted')) {
    return 'timeout';
  }

  // Auth errors — these are handled elsewhere (redirect to login)
  if (
    message.includes('401') ||
    message.includes('unauthorized') ||
    message.includes('login') ||
    message.includes('10001')
  ) {
    return 'auth';
  }

  // Server errors (5xx)
  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('internal server error') ||
    message.includes('bad gateway') ||
    message.includes('service unavailable')
  ) {
    return 'server';
  }

  return 'unknown';
}

/**
 * Debounce duplicate error toasts — only show one toast per category
 * within a 5-second window to avoid toast spam.
 */
const ERROR_MESSAGES = {
  network: {
    title: 'Sin conexión',
    description: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
  },
  timeout: {
    title: 'Tiempo de espera agotado',
    description: 'El servidor tardó demasiado en responder.',
  },
  server: {
    title: 'Error del servidor',
    description: 'El servidor encontró un problema. Intenta de nuevo en unos momentos.',
  },
};

/**
 * Global component that listens to React Query cache errors and shows
 * user-friendly toasts with a retry button.
 *
 * Mount once at the app root level (inside QueryClientProvider).
 * Does NOT handle auth errors (those redirect to login).
 */
export function NetworkErrorToast() {
  const queryClient = useQueryClient();
  const lastToastRef = useRef<Record<string, number>>({});

  useEffect(() => {
    const DEBOUNCE_MS = 5_000;

    const unsubscribeQuery = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return;

      const error = event.query.state.error;
      const category = categorizeError(error);

      // Skip auth errors (handled by redirect) and unknown errors (handled by individual components)
      if (category === 'auth' || category === 'unknown') return;

      // Debounce: skip if same category was toasted recently
      const now = Date.now();
      if (lastToastRef.current[category] && now - lastToastRef.current[category] < DEBOUNCE_MS) {
        return;
      }
      lastToastRef.current[category] = now;

      const msg = ERROR_MESSAGES[category];
      const queryKey = event.query.queryKey;

      toast.error(msg.title, {
        description: msg.description,
        icon: <WifiOff className="h-4 w-4" />,
        duration: 8000,
        action: {
          label: 'Reintentar',
          onClick: () => {
            queryClient.invalidateQueries({ queryKey });
          },
        },
      });
    });

    const unsubscribeMutation = queryClient.getMutationCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'error') return;

      const error = event.mutation.state.error;
      const category = categorizeError(error);

      if (category === 'auth' || category === 'unknown') return;

      const now = Date.now();
      if (lastToastRef.current[category] && now - lastToastRef.current[category] < DEBOUNCE_MS) {
        return;
      }
      lastToastRef.current[category] = now;

      const msg = ERROR_MESSAGES[category];

      toast.error(msg.title, {
        description: msg.description,
        icon: <RefreshCw className="h-4 w-4" />,
        duration: 8000,
      });
    });

    return () => {
      unsubscribeQuery();
      unsubscribeMutation();
    };
  }, [queryClient]);

  return null; // Render nothing — this is a side-effect-only component
}
