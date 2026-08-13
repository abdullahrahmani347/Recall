'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { X, TrendingUp, TrendingDown, Minus, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AdaptiveCard {
  id: string
  front: string
  avgResponseTimeMs: number
  reviewCount: number
  lastGrade: string
  easyRatio: number
  againRatio: number
  goodRatio: number
  suggestion: 'too-easy' | 'too-hard' | 'improving' | 'on-track'
  confidence: number
}

interface AdaptiveResponse {
  cards: AdaptiveCard[]
  total: number
}

const SUGGESTION_CONFIG = {
  'too-easy': { label: 'Too Easy', icon: TrendingUp, color: 'text-accent-warm bg-accent-warm/10 border-accent-warm/30', hint: 'Consider increasing difficulty or adding more detail' },
  'too-hard': { label: 'Too Hard', icon: TrendingDown, color: 'text-grade-again bg-grade-again/10 border-grade-again/30', hint: 'Consider simplifying or breaking into smaller cards' },
  'improving': { label: 'Improving', icon: TrendingUp, color: 'text-accent-brand bg-accent-brand/10 border-accent-brand/30', hint: 'Response times are getting faster' },
  'on-track': { label: 'On Track', icon: Minus, color: 'text-muted-recall bg-void border-hairline', hint: 'Progressing normally' },
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export function AdaptiveDifficulty({ onClose }: { onClose: () => void }) {
  const { data, isLoading } = useQuery<AdaptiveResponse>({
    queryKey: ['adaptive-difficulty'],
    queryFn: () => api<AdaptiveResponse>('/api/ai/adaptive-difficulty'),
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-hairline bg-card-surface p-6 shadow-floating animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Adaptive difficulty suggestions"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Adaptive Difficulty</h2>
          <button onClick={onClose} className="text-muted-recall hover:text-primary-recall" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-recall">
          AI-analyzed review patterns based on response time and grade history
        </p>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Clock className="h-6 w-6 animate-spin text-accent-brand" />
          </div>
        )}

        {data && data.cards.length === 0 && !isLoading && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-recall">No difficulty suggestions yet.</p>
            <p className="mt-1 text-xs text-muted-recall">Review more cards to get adaptive suggestions.</p>
          </div>
        )}

        {data && data.cards.length > 0 && (
          <div className="space-y-2 overflow-y-auto scrollbar-thin pr-1">
            {data.cards.map((card) => {
              const config = SUGGESTION_CONFIG[card.suggestion]
              const Icon = config.icon
              return (
                <div
                  key={card.id}
                  className="rounded-lg border border-hairline bg-void p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-primary-recall line-clamp-2">{card.front}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-recall">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(card.avgResponseTimeMs)} avg
                        </span>
                        <span>{card.reviewCount} reviews</span>
                        {card.againRatio > 0 && <span className="text-grade-again">{card.againRatio}% again</span>}
                        {card.easyRatio > 0 && <span className="text-accent-warm">{card.easyRatio}% easy</span>}
                      </div>
                    </div>
                    <span className={cn('flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap', config.color)}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                      <span className="ml-0.5 opacity-60">{Math.round(card.confidence * 100)}%</span>
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-recall">{config.hint}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
