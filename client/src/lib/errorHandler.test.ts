import { describe, it, expect } from 'vitest';
import { sanitizeError, createErrorHandler, ERROR_MESSAGES } from './errorHandler';

describe('sanitizeError', () => {
  it('returns default error for null/undefined input', () => {
    expect(sanitizeError(null)).toEqual({
      title: 'Error',
      description: 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
    });
    expect(sanitizeError(undefined)).toEqual({
      title: 'Error',
      description: 'Ocurrió un error inesperado. Por favor, intenta de nuevo.',
    });
  });

  it('maps known PostgreSQL error codes to user-friendly messages', () => {
    expect(sanitizeError({ code: '23505' })).toEqual({
      title: 'Error de duplicado',
      description: 'Ya existe un registro con estos datos',
    });
    expect(sanitizeError({ code: '23503' })).toEqual({
      title: 'Error de referencia',
      description: 'No se puede completar la operación debido a referencias existentes',
    });
    expect(sanitizeError({ code: '23502' })).toEqual({
      title: 'Datos incompletos',
      description: 'Faltan campos requeridos para completar la operación',
    });
    expect(sanitizeError({ code: '42501' })).toEqual({
      title: 'Sin permisos',
      description: 'No tienes permiso para realizar esta acción',
    });
  });

  it('maps Supabase-specific error codes', () => {
    expect(sanitizeError({ code: 'PGRST301' })).toEqual({
      title: 'Error de conexión',
      description: 'No se pudo conectar con el servidor',
    });
    expect(sanitizeError({ code: 'PGRST116' })).toEqual({
      title: 'No encontrado',
      description: 'El recurso solicitado no existe',
    });
  });

  it('returns default error for unknown error codes', () => {
    const result = sanitizeError({ code: 'UNKNOWN_CODE' });
    expect(result.title).toBe('Error');
  });

  it('returns default error for plain Error objects', () => {
    const result = sanitizeError(new Error('something broke'));
    expect(result.title).toBe('Error');
  });

  it('returns default error for string input', () => {
    const result = sanitizeError('random error string');
    expect(result.title).toBe('Error');
  });
});

describe('createErrorHandler', () => {
  it('creates a handler with handle and log methods', () => {
    const handler = createErrorHandler('TestContext');
    expect(handler).toHaveProperty('handle');
    expect(handler).toHaveProperty('log');
    expect(typeof handler.handle).toBe('function');
    expect(typeof handler.log).toBe('function');
  });

  it('handle method delegates to sanitizeError', () => {
    const handler = createErrorHandler('TestContext');
    const result = handler.handle({ code: '23505' });
    expect(result.title).toBe('Error de duplicado');
  });

  it('handle method returns default for unknown errors', () => {
    const handler = createErrorHandler('TestContext');
    const result = handler.handle(new Error('unknown'));
    expect(result.title).toBe('Error');
  });
});

describe('ERROR_MESSAGES', () => {
  it('has area-specific error messages', () => {
    expect(ERROR_MESSAGES.areas.duplicateName.title).toBe('Error');
    expect(ERROR_MESSAGES.areas.noPermission.title).toBe('Sin permisos');
  });

  it('has task-specific error messages', () => {
    expect(ERROR_MESSAGES.tasks.loadError.description).toBe('No se pudieron cargar las tareas');
    expect(ERROR_MESSAGES.tasks.noPermission.title).toBe('Sin permisos');
  });

  it('has generic error messages', () => {
    expect(ERROR_MESSAGES.generic.notFound.title).toBe('No encontrado');
    expect(ERROR_MESSAGES.generic.connectionError.title).toBe('Error de conexión');
  });
});
