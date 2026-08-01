'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Info, X } from 'lucide-react'

interface ExplainData {
  explanation: string
  isNew?: boolean
  stats?: {
    stability: number
    difficulty: number
    interval: number
    repetitions: number
    lapses: number
    elapsedDays: number
    recallProbability: number
    tomorrowProbability: number
    dropIfDelayed: number
  }
}

/**
 * SchedulingExplainer — a popover that explains WHY a card is due today
 * using FSRS parameters. Shows stability, difficulty, recall probability,
 * and the cost of delaying.
 */
export function SchedulingExplainer({ cardId }: { cardId: string }) {
  const [open, setOpen] = useState(false)

  const { data, isLoading } = useQuery<ExplainData>({
    queryKey: ['scheduling-explain', cardId],
    queryFn: () => api<ExplainData>(`/api/ai/scheduling-explain?cardId=${cardId}`),
    enabled: open && !!cardId,
    staleTime: 300_000, // 5 min — scheduling doesn't change mid-session
  })

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-xs text-muted-recall hover:text-accent-brand"
      >
        <Info className="h-3 w-3" />
        Why is this due?
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-80 rounded-xl border border-hairline bg-card-surface p-4 shadow-panel">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-recall">
              FSRS scheduling
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-recall hover:text-primary-recall"
              aria-label="Close"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-recall">Computing…</p>
          ) : data ? (
            <>
              <p className="text-sm leading-relaxed text-secondary-recall">
                {data.explanation}
              </p>
              {data.stats && (
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-hairline pt-3">
                  <div className="text-center">
                    <p className="font-display text-lg font-semibold tabular-nums text-accent-brand">
                      {data.stats.recallProbability}%
                    </p>
                    <p className="text-[9px] uppercase tracking-wider text-muted-recall">Recall now</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-lg font-semibold tabular-nums text-accent-warm">
                      {data.stats.stability}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider text-muted-recall">Stability</p>
                  </div>
                  <div className="text-center">
                    <p className="font-display text-lg font-semibold tabular-nums text-secondary-recall">
                      {data.stats.difficulty}
                    </p>
                    <p className="text-[9px] uppercase tracking-wider text-muted-recall">Difficulty</p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-recall">Failed to load explanation.</p>
          )}
        </div>
      )}
    </div>
  )
}
