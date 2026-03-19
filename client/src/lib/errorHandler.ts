/**
 * Centralized error handling utility for sanitizing errors before display
 * Prevents information leakage by mapping database errors to user-friendly messages
 */

interface SanitizedError {
  title: string;
  description: string;
}

// Map of known PostgreSQL error codes to user-friendly messages
const ERROR_CODE_MESSAGES: Record<string, SanitizedError> = {
  '23505': { title: 'Error de duplicado', description: 'Ya existe un registro con estos datos' },
  '23503': { title: 'Error de referencia', description: 'No se puede completar la operación debido a referencias existentes' },
  '23502': { title: 'Datos incompletos', description: 'Faltan campos requeridos para completar la operación' },
  '42501': { title: 'Sin permisos', description: 'No tienes permiso para realizar esta acción' },
  '42P01': { title: 'Error del sistema', description: 'Ocurrió un error al procesar tu solicitud' },
  'PGRST301': { title: 'Error de conexión', description: 'No se pudo conectar con el servidor' },
  'PGRST116': { title: 'No encontrado', description: 'El recurso solicitado no existe' },
};

// Default error message for unknown errors
const DEFAULT_ERROR: SanitizedError = {
  title: 'Error',
  description: 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
};

interface SupabaseError {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

/**
 * Sanitizes a Supabase/PostgreSQL error for user display
 * Logs full details in development only
 */
export function sanitizeError(
  error: SupabaseError | Error | unknown,
  context?: string
): SanitizedError {
  // Log details only in development
  if (import.meta.env.DEV) {
    console.error(`[${context || 'Error'}]`, error);
  }

  // Handle null/undefined
  if (!error) {
    return DEFAULT_ERROR;
  }

  // Handle Supabase errors with codes
  if (typeof error === 'object' && 'code' in error) {
    const supaError = error as SupabaseError;
    const code = supaError.code || '';
    
    // Check for known error codes
    if (ERROR_CODE_MESSAGES[code]) {
      return ERROR_CODE_MESSAGES[code];
    }
  }

  return DEFAULT_ERROR;
}

/**
 * Creates a context-specific error sanitizer
 * Useful for hooks that need consistent error handling
 */
export function createErrorHandler(context: string) {
  return {
    handle: (error: unknown): SanitizedError => sanitizeError(error, context),
    log: (message: string, error: unknown) => {
      if (import.meta.env.DEV) {
        console.error(`[${context}] ${message}:`, error);
      }
    },
  };
}

/**
 * Specialized error messages for specific operations
 */
export const ERROR_MESSAGES = {
  areas: {
    duplicateName: { title: 'Error', description: 'Ya existe un área con este nombre en tu organización' },
    noPermission: { title: 'Sin permisos', description: 'No tienes permiso para gestionar áreas' },
    loadError: { title: 'Error al cargar', description: 'No se pudieron cargar las áreas' },
    createError: { title: 'Error', description: 'No se pudo crear el área' },
    updateError: { title: 'Error', description: 'No se pudo actualizar el área' },
    deleteError: { title: 'Error', description: 'No se pudo eliminar el área' },
    archiveError: { title: 'Error', description: 'No se pudo archivar el área' },
  },
  tasks: {
    loadError: { title: 'Error', description: 'No se pudieron cargar las tareas' },
    createError: { title: 'Error', description: 'No se pudo crear la tarea' },
    updateError: { title: 'Error', description: 'No se pudo actualizar la tarea' },
    deleteError: { title: 'Error', description: 'No se pudo eliminar la tarea' },
    noPermission: { title: 'Sin permisos', description: 'No tienes permiso para modificar esta tarea' },
  },
  reservations: {
    loadError: { title: 'Error', description: 'No se pudieron cargar las reservas' },
    createError: { title: 'Error', description: 'No se pudo crear la reserva' },
    updateError: { title: 'Error', description: 'No se pudo actualizar la reserva' },
    importError: { title: 'Error', description: 'Error durante la importación' },
  },
  generic: {
    unexpected: DEFAULT_ERROR,
    noPermission: { title: 'Sin permisos', description: 'No tienes permiso para realizar esta acción' },
    notFound: { title: 'No encontrado', description: 'El recurso solicitado no existe' },
    connectionError: { title: 'Error de conexión', description: 'No se pudo conectar con el servidor' },
  },
} as const;
