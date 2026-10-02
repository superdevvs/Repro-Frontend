import React, { Component, ErrorInfo, ReactNode } from 'react';
import { attemptChunkLoadRecovery, isRecoverableChunkError } from '@/lib/chunkLoadRecovery';
import { trackTelemetryError } from '@/features/system-overview/telemetryClient';
import { ErrorFallback } from './ErrorBoundaryFallback';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  scope?: 'shoot_media';
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ error, errorInfo });

    // Diagnostic failures must never turn a contained view error into a blank
    // application. Send only reviewed codes, never messages, stacks or props.
    try {
      const code = isRecoverableChunkError(error)
        ? 'react_chunk_load_error'
        : this.props.scope === 'shoot_media' ? 'shoot_media_render_error' : 'react_render_error';
      trackTelemetryError('A view could not render.', 'ReactRenderError', { code, kind: 'ReactRenderError' });
    } catch { /* Recovery UI remains usable if telemetry is unavailable. */ }
    try { attemptChunkLoadRecovery(error); } catch { /* Show manual recovery. */ }
    
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    
    // Call custom error handler
    try { this.props.onError?.(error, errorInfo); } catch { /* Preserve the fallback. */ }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Runtime failures need recovery guidance. Missing routes are handled by
      // the router; the shared fallback also protects any uploads in progress.
      return <ErrorFallback error={this.state.error} errorInfo={this.state.errorInfo} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

// HOC to wrap components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};
