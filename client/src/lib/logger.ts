/**
 * Environment-aware logging utility
 * Only logs in development, silent in production (except errors)
 */

interface LoggerOptions {
  context?: string;
}

interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

const isDev = import.meta.env.DEV;

function createLogger(options: LoggerOptions = {}): Logger {
  const { context } = options;
  const prefix = context ? `[${context}]` : '';

  return {
    debug: (...args: unknown[]) => {
      if (isDev) console.debug(prefix, ...args);
    },
    info: (...args: unknown[]) => {
      if (isDev) console.info(prefix, ...args);
    },
    warn: (...args: unknown[]) => {
      if (isDev) console.warn(prefix, ...args);
    },
    error: (...args: unknown[]) => {
      // Errors always log for observability
      console.error(prefix, ...args);
    },
  };
}

// Default logger instance
export const logger = createLogger();

// Factory for context-specific loggers
export { createLogger };
export type { Logger, LoggerOptions };
