'use client'

import { useEffect, useState, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import {
  X,
  RotateCw,
  Check,
  Trophy,
} from 'lucide-react'
import type { ApiFlashcard, Grade } from '@/lib/types'
import { toast } from 'sonner'
import { formatInterval } from '@/lib/fsrs'

interface QueueResponse {
  cards: (ApiFlashcard & { deck?: { id: string; name: string; color: string } })[]
  total: number
}

const GRADE_BUTTONS: {
  grade: Grade
  label: string
  hint: string
  key: string
  className: string
}[] = [
  { grade: 'again', label: 'Again', hint: 'Forgot', key: '1', className: 'bg-grade-again' },
  { grade: 'hard', label: 'Hard', hint: 'Barely', key: '2', className: 'bg-grade-hard' },
  { grade: 'good', label: 'Good', hint: 'Got it', key: '3', className: 'bg-grade-good' },
  { grade: 'easy', label: 'Easy', hint: 'Instant', key: '4', className: 'bg-grade-easy' },
]

export function ReviewSession() {
  const qc = useQueryClient()
  const { reviewDeckId, setView, openNote } = useAppStore()
  const [revealed, setRevealed] = useState(false)
  const [index, setIndex] = useState(0)
  const [completed, setCompleted] = useState(0)
  const [startedAt] = useState(() => Date.now())
  const [sessionGrades, setSessionGrades] = useState<Grade[]>([])
  const [cardStartTime, setCardStartTime] = useState(() => Date.now())
  const [showHistory, setShowHistory] = useState(false)

  // Check for custom study mode (set by CustomStudyPicker)
  const customMode = typeof window !== 'undefined' ? sessionStorage.getItem('recall-custom-mode') : null
  const customDeck = typeof window !== 'undefined' ? sessionStorage.getItem('recall-custom-deck') : null

  const { data, isLoading } = useQuery<QueueResponse>({
    queryKey: ['review-queue', reviewDeckId, customMode],
    queryFn: () => {
      // Use custom endpoint if a custom mode is set
      if (customMode) {
        const params = new URLSearchParams()
        params.set('mode', customMode)
        if (customDeck) params.set('deckId', customDeck)
        return api<QueueResponse>(`/api/review/custom?${params.toString()}`)
      }
      // Regular due queue
      const params = new URLSearchParams()
      if (reviewDeckId) params.set('deckId', reviewDeckId)
      return api<QueueResponse>(`/api/review/queue${params.size ? `?${params.toString()}` : ''}`)
    },
  })

  const cards = data?.cards ?? []
  const total = cards.length
  const card = cards[index]
  const isDone = index >= total

  const reviewMutation = useMutation({
    mutationFn: ({
      cardId,
      grade,
      responseTimeMs,
    }: {
      cardId: string
      grade: Grade
      responseTimeMs: number
    }) =>
      api(`/api/cards/${cardId}/review`, {
        method: 'POST',
        body: JSON.stringify({ grade, responseTimeMs }),
      }),
  })

  const onGrade = useCallback(
    async (grade: Grade) => {
      if (!card || !revealed) return
      try {
        await reviewMutation.mutateAsync({
          cardId: card.id,
          grade,
          responseTimeMs: Date.now() - cardStartTime,
        })
        setSessionGrades((prev) => [...prev, grade])
        setCompleted((c) => c + 1)
        setRevealed(false)
        setCardStartTime(Date.now())
        setIndex((i) => i + 1)
        qc.invalidateQueries({ queryKey: ['decks'] })
        qc.invalidateQueries({ queryKey: ['stats'] })
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to save review')
      }
    },
    [card, revealed, reviewMutation, cardStartTime, qc]
  )

  // Keyboard shortcuts: 1-4 grade, Space to reveal
  useEffect(() => {
    if (isDone) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        if (!revealed) setRevealed(true)
        return
      }
      if (!revealed) return
      const match = GRADE_BUTTONS.find((b) => b.key === e.key)
      if (match) {
        e.preventDefault()
        onGrade(match.grade)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [revealed, isDone, onGrade])

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <p className="text-sm text-muted-recall">Loading review queue…</p>
      </div>
    )
  }

  if (total === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-brand/10 text-accent-brand">
          <Check className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="font-display text-2xl font-semibold">Nothing due right now</h2>
        <p className="mt-2 max-w-sm text-sm text-secondary-recall">
          You're all caught up. Your next cards will be due based on the FSRS
          schedule. Want to get ahead?
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={() => setView('decks')}
            className="bg-accent-brand text-void hover:bg-accent-brand/90"
          >
            Browse decks
          </Button>
          <Button
            onClick={() => setView('notes')}
            variant="ghost"
            className="border border-hairline bg-card-surface"
          >
            Create new cards
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-recall">
          Tip: Use <code className="rounded bg-card-surface px-1 text-accent-brand">Term :: Definition</code> in notes to create cards instantly.
        </p>
      </div>
    )
  }

  if (isDone) {
    const againCount = sessionGrades.filter((g) => g === 'again').length
    const goodCount = sessionGrades.filter((g) => g === 'good' || g === 'easy').length
    const minutes = Math.round((Date.now() - startedAt) / 60_000)

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-canvas px-6 py-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-warm/15 text-accent-warm">
          <Trophy className="h-8 w-8" aria-hidden="true" />
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          Session complete
        </h2>
        <p className="mt-2 text-secondary-recall">
          You reviewed {completed} card{completed === 1 ? '' : 's'} in {minutes || '< 1'} min.
        </p>

        <div className="mt-8 grid w-full max-w-md grid-cols-3 gap-3">
          <div className="rounded-xl border border-hairline bg-card-surface p-4">
            <p className="font-display text-2xl font-semibold text-grade-again">{againCount}</p>
            <p className="text-xs text-muted-recall">Again</p>
          </div>
          <div className="rounded-xl border border-hairline bg-card-surface p-4">
            <p className="font-display text-2xl font-semibold text-grade-hard">
              {sessionGrades.filter((g) => g === 'hard').length}
            </p>
            <p className="text-xs text-muted-recall">Hard</p>
          </div>
          <div className="rounded-xl border border-hairline bg-card-surface p-4">
            <p className="font-display text-2xl font-semibold text-grade-good">{goodCount}</p>
            <p className="text-xs text-muted-recall">Good + Easy</p>
          </div>
        </div>

        <div className="mt-8 flex gap-3">
          <Button variant="ghost" onClick={() => setView('home')} className="border border-hairline">
            Back to home
          </Button>
          <Button
            onClick={() => setView('decks')}
            className="bg-accent-brand text-void hover:bg-accent-brand/90"
          >
            Done
          </Button>
        </div>
      </div>
    )
  }

  const progress = ((index) / total) * 100

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* TOP BAR */}
      <header className="border-b border-hairline">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm('End this review session?')) setView('home')
            }}
            className="h-8 w-8 p-0"
            aria-label="Exit review"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-card-surface">
              <div
                className="h-full rounded-full bg-accent-brand transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <p className="text-xs tabular-nums text-muted-recall">
            {index + 1} / {total}
          </p>
        </div>
      </header>

      {/* CARD */}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        {card?.deck && (
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-recall">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: card.deck.color }}
              aria-hidden="true"
            />
            {card.deck.name}
          </div>
        )}

        <div
          key={card?.id}
          className="w-full rounded-3xl border border-hairline bg-card-surface p-8 shadow-floating sm:p-12 animate-scale-in"
          role="region"
          aria-label="Flashcard"
        >
          {/* FRONT — cloze cards render as fill-in-the-blank */}
          <p className="text-xs uppercase tracking-wider text-muted-recall">
            {card?.cardType === 'cloze' ? 'Fill in the blank' : 'Question'}
          </p>
          <p className="mt-3 whitespace-pre-wrap text-lg leading-relaxed sm:text-2xl">
            {card?.cardType === 'cloze'
              ? renderClozeFront(card.front, revealed, card.back)
              : card?.front}
          </p>

          {/* BACK (revealed) — cloze cards show the answer inline, basic cards show below */}
          {revealed && card?.cardType !== 'cloze' && (
            <div className="mt-8 border-t border-hairline pt-6">
              <p className="text-xs uppercase tracking-wider text-muted-recall">Answer</p>
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed sm:text-lg">
                {card?.back}
              </p>
            </div>
          )}
        </div>

        {/* ACTIONS */}
        <div className="mt-8 w-full">
          {!revealed ? (
            <Button
              onClick={() => setRevealed(true)}
              size="lg"
              className="w-full bg-accent-brand text-void hover:bg-accent-brand/90"
            >
              Reveal answer
              <span className="ml-2 hidden text-xs opacity-60 sm:inline">Space</span>
            </Button>
          ) : (
            <>
              <p className="mb-3 text-center text-xs text-muted-recall">
                How did you do?
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {GRADE_BUTTONS.map((b) => (
                  <button
                    key={b.grade}
                    onClick={() => onGrade(b.grade)}
                    className={`flex flex-col items-center gap-1 rounded-xl ${b.className} px-3 py-4 text-void transition-spring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white press`}
                    aria-label={`${b.label} — ${b.hint} (key ${b.key})`}
                  >
                    <span className="text-sm font-semibold">{b.label}</span>
                    <span className="text-[10px] opacity-90">{b.hint}</span>
                    <span className="text-[10px] opacity-60">{b.key}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* CONTEXT — source note link + review history toggle */}
        {card && (
          <div className="mt-6 border-t border-hairline pt-4">
            <div className="flex items-center justify-between gap-3">
              {card.sourceNoteId ? (
                <button
                  onClick={() => {
                    // Clear custom mode so it doesn't interfere
                    sessionStorage.removeItem('recall-custom-mode')
                    sessionStorage.removeItem('recall-custom-deck')
                    setView('notes')
                    // The note will be opened via a timeout to let the view switch first
                    setTimeout(() => openNote(card.sourceNoteId!), 200)
                  }}
                  className="text-xs text-accent-brand hover:underline"
                >
                  View source note
                </button>
              ) : (
                <span className="text-xs text-muted-recall">No source note</span>
              )}
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-muted-recall hover:text-primary-recall"
              >
                {showHistory ? 'Hide history' : 'Show history'}
              </button>
            </div>
            {showHistory && card && (
              <CardHistory cardId={card.id} />
            )}
          </div>
        )}
      </main>

      {/* FOOTER HINT */}
      <footer className="border-t border-hairline px-4 py-2 sm:px-6">
        <p className="mx-auto max-w-3xl text-center text-[10px] text-muted-recall">
          Keyboard: <kbd className="rounded bg-card-surface px-1 py-0.5">Space</kbd> reveal ·{' '}
          <kbd className="rounded bg-card-surface px-1 py-0.5">1</kbd> Again ·{' '}
          <kbd className="rounded bg-card-surface px-1 py-0.5">2</kbd> Hard ·{' '}
          <kbd className="rounded bg-card-surface px-1 py-0.5">3</kbd> Good ·{' '}
          <kbd className="rounded bg-card-surface px-1 py-0.5">4</kbd> Easy
        </p>
      </footer>
    </div>
  )
}

/**
 * Render a cloze card's front text.
 * - Before reveal: replaces {{cN::text}} with [___] blanks
 * - After reveal: shows the original text highlighted in green
 *
 * For multi-cloze cards (c1, c2, c3...), only the cloze matching
 * the card's `back` field (which stores the cloze number) is blanked/revealed.
 * Other clozes are shown as-is.
 */
function renderClozeFront(text: string, revealed: boolean, clozeNum: string): string {
  const regex = new RegExp(`\\{\\{c${clozeNum}::([^}]+)\\}\\}`, 'g')
  if (revealed) {
    return text.replace(regex, '$1')
  }
  return text.replace(regex, '[___]')
}

/**
 * CardHistory — shows the last 10 review logs for the current card.
 * Displays grade, date, interval change, and response time.
 */
function CardHistory({ cardId }: { cardId: string }) {
  const { data } = useQuery<{
    history: {
      id: string
      reviewedAt: string
      grade: string
      previousInterval: number
      newInterval: number
      responseTimeMs: number
    }[]
  }>({
    queryKey: ['card-history', cardId],
    queryFn: () => api(`/api/cards/${cardId}/history`),
    staleTime: 30_000,
  })

  if (!data || data.history.length === 0) {
    return <p className="mt-2 text-xs text-muted-recall">No review history yet.</p>
  }

  const gradeColors: Record<string, string> = {
    again: 'text-grade-again',
    hard: 'text-grade-hard',
    good: 'text-grade-good',
    easy: 'text-grade-easy',
  }

  return (
    <ul className="mt-2 space-y-1">
      {data.history.slice(0, 5).map((log) => (
        <li key={log.id} className="flex items-center gap-3 text-xs">
          <span className={`font-medium ${gradeColors[log.grade] ?? 'text-muted-recall'}`}>
            {log.grade}
          </span>
          <span className="text-muted-recall">
            {new Date(log.reviewedAt).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </span>
          <span className="text-muted-recall tabular-nums">
            {log.previousInterval}d → {log.newInterval}d
          </span>
          <span className="text-muted-recall tabular-nums">
            {Math.round(log.responseTimeMs / 1000)}s
          </span>
        </li>
      ))}
    </ul>
  )
}
