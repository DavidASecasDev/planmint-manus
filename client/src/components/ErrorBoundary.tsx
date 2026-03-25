import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Optional fallback to render instead of the default error UI */
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global error boundary that catches unhandled React errors
 * and shows a recovery UI instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-semibold text-foreground">
                Algo salió mal
              </h1>
              <p className="text-sm text-muted-foreground">
                Ha ocurrido un error inesperado. Puedes intentar recargar la página
                o volver al inicio.
              </p>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-left">
                <p className="text-xs font-mono text-destructive break-all">
                  {this.state.error.message}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-accent transition-colors"
              >
                Reintentar
              </button>
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Recargar página
              </button>
            </div>

            <button
              onClick={this.handleGoHome}
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Volver al inicio
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Lightweight error boundary for individual routes/sections.
 * Shows a smaller inline error message instead of a full-page error.
 */
export class RouteErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[RouteErrorBoundary] Caught error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Error al cargar esta sección
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Ha ocurrido un error inesperado. Intenta de nuevo.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <p className="text-xs font-mono text-destructive mb-4 max-w-sm break-all">
              {this.state.error.message}
            </p>
          )}
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-accent transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
