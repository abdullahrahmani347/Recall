'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { X, Zap, CalendarClock, AlertTriangle, Tag } from 'lucide-react'
import type { ApiDeck } from '@/lib/types'

interface CustomStudyPickerProps {
  deckId: string | null
  onClose: () => void
}

const MODES = [
  {
    id: 'cram',
    name: 'Cram',
    description: 'Review all cards, regardless of schedule',
    icon: Zap,
    color: 'text-accent-warm',
  },
  {
    id: 'ahead',
    name: 'Review ahead',
    description: 'See tomorrow\'s cards today',
    icon: CalendarClock,
    color: 'text-accent-brand',
  },
  {
    id: 'weak',
    name: 'Practice weak',
    description: 'Cards you\'ve lapsed on 3+ times',
    icon: AlertTriangle,
    color: 'text-grade-again',
  },
] as const

/**
 * CustomStudyPicker — lets the user choose a custom study mode
 * (cram, review ahead, practice weak) before starting a session.
 */
export function CustomStudyPicker({ deckId, onClose }: CustomStudyPickerProps) {
  const startReview = useAppStore((s) => s.startReview)
  const [selectedMode, setSelectedMode] = useState<string | null>(null)

  const { data } = useQuery<{ decks: (ApiDeck & { cardCount: number; dueCount: number })[] }>({
    queryKey: ['decks'],
    queryFn: () => api<{ decks: (ApiDeck & { cardCount: number; dueCount: number })[] }>('/api/decks'),
  })

  const decks = data?.decks ?? []
  const selectedDeck = deckId ? decks.find((d) => d.id === deckId) : null

  const startCustom = async (mode: string) => {
    const params = new URLSearchParams()
    params.set('mode', mode)
    if (deckId) params.set('deckId', deckId)

    try {
      const result = await api<{ total: number }>(`/api/review/custom?${params.toString()}`)
      if (result.total === 0) {
        // No cards — just close
        onClose()
        return
      }
      // Store the custom mode in sessionStorage so the review session knows
      // to use the custom endpoint instead of the regular queue
      sessionStorage.setItem('recall-custom-mode', mode)
      sessionStorage.setItem('recall-custom-deck', deckId ?? '')
      startReview(deckId)
      onClose()
    } catch {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl border border-hairline bg-card-surface p-5 shadow-panel animate-fade-in-up sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Custom study session"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Custom study</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-recall hover:text-primary-recall"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {selectedDeck && (
          <p className="mb-4 text-sm text-secondary-recall">
            Deck: <span className="font-medium text-primary-recall">{selectedDeck.name}</span>
          </p>
        )}

        <div className="space-y-2">
          {MODES.map((mode) => {
            const Icon = mode.icon
            return (
              <button
                key={mode.id}
                onClick={() => startCustom(mode.id)}
                className="flex w-full items-center gap-3 rounded-xl border border-hairline bg-card-surface p-4 text-left transition-smooth press hover:border-accent-brand/50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-brand-dim">
                  <Icon className={`h-4 w-4 ${mode.color}`} />
                </div>
                <div>
                  <p className="text-sm font-medium">{mode.name}</p>
                  <p className="mt-0.5 text-xs text-muted-recall">{mode.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
