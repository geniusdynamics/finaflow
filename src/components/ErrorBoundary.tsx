// ABOUTME: Sentry-powered error boundary that captures React component errors remotely.
// ABOUTME: Re-exports Sentry.ErrorBoundary under the same name so all route references remain unchanged.
import * as Sentry from "@sentry/react";
import type { ReactNode, ReactElement } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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

export function ErrorBoundary({ children, fallback }: Props): ReactElement {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => {
        if (fallback) return <>{fallback}</>;
        return <DefaultFallback error={error instanceof Error ? error : null} reset={resetError} />;
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
