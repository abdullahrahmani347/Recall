'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { AlertTriangle, ArrowRight } from 'lucide-react'

interface Gap {
  cardId: string
  front: string
  lapses: number
  repetitions: number
  retentionRate: number
  deckName: string
  deckColor: string
  sourceNote: { id: string; title: string } | null
  lastReviewedAt: string | null
}

/**
 * KnowledgeGaps — shows cards the user has struggled with (2+ lapses).
 * Each gap suggests "revisit the source note" to re-learn the concept.
 */
export function KnowledgeGaps() {
  const openNote = useAppStore((s) => s.openNote)

  const { data, isLoading } = useQuery<{ gaps: Gap[] }>({
    queryKey: ['knowledge-gaps'],
    queryFn: () => api<{ gaps: Gap[] }>('/api/ai/knowledge-gaps'),
    staleTime: 60_000,
  })

  if (isLoading || !data || data.gaps.length === 0) return null

  return (
    <div className="rounded-2xl border border-grade-again/20 bg-grade-again/5 p-4">
      <div className="mb-3 flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-grade-again" aria-hidden="true" />
        <h3 className="text-sm font-semibold">Knowledge gaps</h3>
        <span className="text-xs text-muted-recall">
          {data.gaps.length} card{data.gaps.length === 1 ? '' : 's'} need attention
        </span>
      </div>

      <ul className="space-y-2">
        {data.gaps.slice(0, 3).map((gap) => (
          <li
            key={gap.cardId}
            className="flex items-center justify-between gap-3 rounded-lg bg-card-surface p-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{gap.front}</p>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-recall">
                <span className="text-grade-again">{gap.lapses} lapses</span>
                <span>{gap.retentionRate}% retention</span>
                <span
                  className="rounded-full px-1.5 py-0.5 text-[10px]"
                  style={{ backgroundColor: `${gap.deckColor}20`, color: gap.deckColor }}
                >
                  {gap.deckName}
                </span>
              </div>
            </div>

            {gap.sourceNote ? (
              <button
                onClick={() => openNote(gap.sourceNote!.id)}
                className="flex shrink-0 items-center gap-1 rounded-full bg-accent-brand-dim px-3 py-1.5 text-xs font-medium text-accent-brand transition-smooth press hover:bg-accent-brand/20"
              >
                Revisit note
                <ArrowRight className="h-3 w-3" />
              </button>
            ) : (
              <span className="shrink-0 text-[10px] text-muted-recall">No source</span>
            )}
          </li>
        ))}
      </ul>

      {data.gaps.length > 3 && (
        <p className="mt-2 text-center text-xs text-muted-recall">
          + {data.gaps.length - 3} more
        </p>
      )}
    </div>
  )
}
