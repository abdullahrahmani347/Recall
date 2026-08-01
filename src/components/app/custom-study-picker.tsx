'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { X, Zap, CalendarClock, AlertTriangle, Tag, HelpCircle, Loader2 } from 'lucide-react'
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

interface PracticeQuestion {
  question: string
  answer: string
}

/**
 * CustomStudyPicker — lets the user choose a custom study mode
 * (cram, review ahead, practice weak) before starting a session.
 */
export function CustomStudyPicker({ deckId, onClose }: CustomStudyPickerProps) {
  const startReview = useAppStore((s) => s.startReview)
  const [selectedMode, setSelectedMode] = useState<string | null>(null)
  const [showQuestions, setShowQuestions] = useState(false)
  const [questions, setQuestions] = useState<PracticeQuestion[]>([])
  const [questionIdx, setQuestionIdx] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [loadingQs, setLoadingQs] = useState(false)

  const { data } = useQuery<{ decks: (ApiDeck & { cardCount: number; dueCount: number })[] }>({
    queryKey: ['decks'],
    queryFn: () => api<{ decks: (ApiDeck & { cardCount: number; dueCount: number })[] }>('/api/decks'),
  })

  const decks = data?.decks ?? []
  const selectedDeck = deckId ? decks.find((d) => d.id === deckId) : null

  const generateQuestions = async () => {
    if (!deckId) return
    setLoadingQs(true)
    try {
      const res = await api<{ questions: PracticeQuestion[] }>('/api/ai/practice-questions', {
        method: 'POST',
        body: JSON.stringify({ deckId, count: 3 }),
      })
      if (res.questions.length > 0) {
        setQuestions(res.questions)
        setShowQuestions(true)
        setQuestionIdx(0)
        setRevealed(false)
      }
    } catch {
      // ignore
    } finally {
      setLoadingQs(false)
    }
  }

  // Practice questions mode — render the question/answer UI
  if (showQuestions && questions.length > 0) {
    const q = questions[questionIdx]
    const isLast = questionIdx === questions.length - 1
    return (
      <div
        className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
        onClick={onClose}
      >
        <div
          className="w-full max-w-lg rounded-t-3xl border border-hairline bg-card-surface p-6 shadow-panel animate-fade-in-up sm:rounded-3xl"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label="Practice question"
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-widest text-accent-brand">
              Practice question {questionIdx + 1} / {questions.length}
            </p>
            <button onClick={onClose} className="text-muted-recall hover:text-primary-recall" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-lg font-medium leading-relaxed">{q.question}</p>

          {revealed && (
            <div className="mt-4 rounded-lg border border-accent-brand/20 bg-accent-brand/5 p-4">
              <p className="text-xs font-medium uppercase tracking-widest text-accent-brand">Answer</p>
              <p className="mt-2 text-sm leading-relaxed text-secondary-recall">{q.answer}</p>
            </div>
          )}

          <div className="mt-6 flex justify-end gap-2">
            {!revealed ? (
              <Button onClick={() => setRevealed(true)} className="bg-accent-brand text-void hover:bg-accent-brand/90">
                Reveal answer
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (isLast) {
                    onClose()
                  } else {
                    setQuestionIdx(questionIdx + 1)
                    setRevealed(false)
                  }
                }}
                className="bg-accent-brand text-void hover:bg-accent-brand/90"
              >
                {isLast ? 'Done' : 'Next question'}
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

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

          {/* AI Practice Questions */}
          {deckId && (
            <button
              onClick={generateQuestions}
              disabled={loadingQs}
              className="flex w-full items-center gap-3 rounded-xl border border-accent-brand/30 bg-accent-brand/5 p-4 text-left transition-smooth press hover:border-accent-brand/60 disabled:opacity-50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-brand-dim">
                {loadingQs ? (
                  <Loader2 className="h-4 w-4 animate-spin text-accent-brand" />
                ) : (
                  <HelpCircle className="h-4 w-4 text-accent-brand" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-accent-brand">Practice questions</p>
                <p className="mt-0.5 text-xs text-muted-recall">
                  {loadingQs ? 'Generating scenario-based questions…' : 'AI-generated application questions from this deck'}
                </p>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
