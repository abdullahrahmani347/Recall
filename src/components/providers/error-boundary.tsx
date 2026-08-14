'use client'

import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCw } from 'lucide-react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * ErrorBoundary — catches JavaScript errors anywhere in the child
 * component tree, logs them, and displays a fallback UI instead of
 * crashing the whole app.
 *
 * Usage:
 * <ErrorBoundary>
 *   <SomeComponent />
 * </ErrorBoundary>
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-grade-again/10">
            <AlertTriangle className="h-6 w-6 text-grade-again" />
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-primary-recall">
              Something went wrong
            </h3>
            <p className="mt-1 text-sm text-muted-recall">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-1.5 rounded-lg border border-hairline bg-card-surface px-3 py-1.5 text-sm font-medium text-primary-recall hover:bg-accent-brand-dim"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg border border-hairline bg-card-surface px-3 py-1.5 text-sm font-medium text-secondary-recall hover:text-primary-recall"
            >
              Reload page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
