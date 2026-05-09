import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function DefaultFallback({ error, reset }: { error: Error | null; reset: () => void }) {
  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center p-8">
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 max-w-md w-full">
        <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
        <p className="text-sm text-red-600 mb-4">
          {error?.message || "An unexpected error occurred"}
        </p>
        <button
          onClick={reset}
          className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return <DefaultFallback error={this.state.error} reset={this.handleReset} />;
    }
    return this.props.children;
  }
}
