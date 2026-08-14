'use client'

import { AlertTriangle, RotateCw, Home } from 'lucide-react'

/**
 * error.tsx — Next.js App Router global error boundary.
 * Catches errors in any server component or route segment.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-canvas p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-grade-again/10">
        <AlertTriangle className="h-8 w-8 text-grade-again" />
      </div>
      <div>
        <h1 className="font-display text-2xl font-semibold text-primary-recall">
          Something went wrong
        </h1>
        <p className="mt-2 max-w-md text-sm text-muted-recall">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-muted-recall">
            Error ID: {error.digest}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-lg bg-accent-brand px-4 py-2 text-sm font-medium text-void hover:bg-accent-brand/90"
        >
          <RotateCw className="h-4 w-4" />
          Try again
        </button>
        <a
          href="/"
          className="flex items-center gap-2 rounded-lg border border-hairline bg-card-surface px-4 py-2 text-sm font-medium text-primary-recall hover:bg-accent-brand-dim"
        >
          <Home className="h-4 w-4" />
          Go home
        </a>
      </div>
    </div>
  )
}
