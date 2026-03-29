import React, { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../services/loggingService';

// Extend window interface to include our custom flag
declare global {
  interface Window {
    __IS_IMPORTING__?: boolean;
  }
}

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * ErrorBoundary component to catch and handle React rendering errors.
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false };

  constructor(props: Props) {
    super(props);
  }

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Only log real errors, not the expected ones during import
    if (!window.__IS_IMPORTING__) {
        logger.error("Uncaught React error", errorInfo.componentStack || error.stack);
    }
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      // If we are importing, we expect potential React tree instability.
      // Show a clean loading state or reload immediately.
      if (window.__IS_IMPORTING__) {
          setTimeout(() => window.location.reload(), 2000); // Fallback reload
          return (
            <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-300 p-8">
                <div className="flex flex-col items-center gap-4">
                    <svg className="animate-spin h-10 w-10 text-indigo-500" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                    </svg>
                    <h2 className="text-xl font-bold text-white">Import Complete</h2>
                    <p className="text-sm text-slate-400">Refreshing application...</p>
                </div>
            </div>
          );
      }

      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-slate-900 text-slate-300 p-8">
            <div className="text-center">
                <h1 className="text-2xl font-bold text-red-400 mb-4">Something went wrong.</h1>
                <p className="mb-6">An unexpected error occurred. Please try refreshing the page.</p>
                <p className="text-xs text-slate-500 mb-6">
                    The error has been logged. You can view details in the Admin panel if the app is still accessible.
                </p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg"
                >
                    Refresh Page
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;