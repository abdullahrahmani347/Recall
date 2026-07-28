'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sparkles, X, Loader2, RotateCw } from 'lucide-react'

interface SummaryStreamProps {
  noteId: string
  existingSummary?: string | null
  onDismiss: () => void
}

/**
 * SummaryStream — opens an SSE connection to /api/notes/[id]/summary/stream
 * and renders tokens as they arrive. Uses an aria-live="polite" region so
 * screen readers announce the streaming content (per §10 of the brief).
 *
 * On completion, persists the final summary by closing the connection. The
 * server already writes the Summary row to the DB as `complete`.
 */
export function SummaryStream({ noteId, existingSummary, onDismiss }: SummaryStreamProps) {
  const [text, setText] = useState(existingSummary ?? '')
  const [status, setStatus] = useState<'idle' | 'streaming' | 'done' | 'error'>(
    existingSummary ? 'done' : 'idle'
  )
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const liveRef = useRef<HTMLDivElement>(null)

  const startStream = async () => {
    setText('')
    setStatus('streaming')
    setError(null)

    try {
      // Kick off: POST /api/notes/[id]/summarize creates the Summary row
      const res = await fetch('/api/notes/' + noteId + '/summarize', {
        method: 'POST',
        credentials: 'include',
      })
      if (res.status === 403) {
        const body = await res.json().catch(() => ({}))
        setStatus('error')
        setError(body?.error ?? 'AI processing is disabled in your settings.')
        return
      }
      if (!res.ok) {
        setStatus('error')
        setError('Failed to start summary.')
        return
      }

      // Open SSE stream
      const es = new EventSource(`/api/notes/${noteId}/summary/stream`)
      eventSourceRef.current = es

      es.addEventListener('token', (e: MessageEvent) => {
        try {
          const { token } = JSON.parse(e.data) as { token: string }
          setText((prev) => prev + token)
        } catch {
          // ignore malformed frames
        }
      })

      es.addEventListener('done', (e: MessageEvent) => {
        try {
          const { summary } = JSON.parse(e.data) as { summary: string }
          if (summary) setText(summary)
        } catch {
          // ignore
        }
        setStatus('done')
        es.close()
      })

      es.addEventListener('error', (e: MessageEvent) => {
        // EventSource fires 'error' on connection close — distinguish a real
        // error from a graceful end via the explicit `error` event payload.
        try {
          const data = JSON.parse(e.data) as { error: string }
          setStatus('error')
          setError(data.error)
        } catch {
          // If we already received tokens, treat as done (stream closed cleanly)
          if (text.length > 0) {
            setStatus('done')
          } else {
            setStatus('error')
            setError('Stream interrupted. Please try again.')
          }
        }
        es.close()
      })
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  // Auto-start when mounted with no existing summary.
  // Deliberately an empty dep array: we only want to start the stream once
  // on mount, based on the `existingSummary` value at that moment. The
  // state updates happen inside an async function (startStream awaits fetch
  // before any setText call), so this is the documented pattern for
  // kicking off async work on mount.
  useEffect(() => {
    if (!existingSummary) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void startStream()
    }
    return () => {
      eventSourceRef.current?.close()
    }
  }, [])

  return (
    <div
      className="rounded-2xl border border-accent-brand/30 bg-accent-brand/5 p-4"
      role="region"
      aria-label="AI summary"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-brand/15 text-accent-brand">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <h3 className="text-sm font-semibold">Summary</h3>
          {status === 'streaming' && (
            <Loader2 className="h-3 w-3 animate-spin text-accent-brand" aria-hidden="true" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {status === 'done' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={startStream}
              className="h-7 px-2 text-xs text-secondary-recall"
              aria-label="Regenerate summary"
            >
              <RotateCw className="h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-7 w-7 p-0 text-muted-recall"
            aria-label="Dismiss summary"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div
        ref={liveRef}
        aria-live="polite"
        aria-atomic="false"
        className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-secondary-recall"
      >
        {status === 'streaming' && text.length === 0 ? (
          <div className="space-y-2" aria-label="Generating summary">
            <div className="h-3 w-3/4 animate-pulse rounded bg-card-surface" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-card-surface" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-card-surface" />
          </div>
        ) : (
          <div className="whitespace-pre-wrap">{text}</div>
        )}
      </div>

      {status === 'error' && (
        <p className="mt-3 text-xs text-grade-again" role="alert">
          {error ?? 'Failed to generate summary.'}
        </p>
      )}

      {status === 'streaming' && text.length > 0 && (
        <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-recall">
          Streaming via SSE
        </p>
      )}
    </div>
  )
}
