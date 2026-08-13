'use client'

import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { X, Calendar, Loader2, Sparkles, Clock, Layers, Target } from 'lucide-react'
import { toast } from 'sonner'

interface StudyPlanDay {
  day: number
  date: string
  newCards: number
  reviewCards: number
  deckFocus: string
  activity: string
}

interface StudyPlanResponse {
  plan: StudyPlanDay[]
  summary: {
    daysUntilExam: number
    totalCards: number
    totalNew: number
    decks: { id: string; name: string; color: string; total: number; newCards: number; dueNow: number; learned: number }[]
  }
}

interface StudyPlanGeneratorProps {
  onClose: () => void
}

const ACTIVITY_LABELS: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  'new-learning': { label: 'New Learning', color: 'text-accent-brand bg-accent-brand/10 border-accent-brand/30', icon: Sparkles },
  'review-heavy': { label: 'Review Heavy', color: 'text-accent-warm bg-accent-warm/10 border-accent-warm/30', icon: Clock },
  'mixed': { label: 'Mixed', color: 'text-accent-good bg-accent-good/10 border-accent-good/30', icon: Layers },
  'practice-test': { label: 'Practice Test', color: 'text-grade-again bg-grade-again/10 border-grade-again/30', icon: Target },
  'light-review': { label: 'Light Review', color: 'text-muted-recall bg-void border-hairline', icon: Clock },
  'rest': { label: 'Rest Day', color: 'text-muted-recall bg-void border-hairline', icon: Clock },
}

export function StudyPlanGenerator({ onClose }: StudyPlanGeneratorProps) {
  const [examDate, setExamDate] = useState('')
  const [selectedDeckIds, setSelectedDeckIds] = useState<string[]>([])

  const { data: decksData } = useQuery<{ decks: { id: string; name: string; color: string; _count?: { flashcards: number } }[] }>({
    queryKey: ['decks-for-plan'],
    queryFn: () => api('/api/decks'),
  })

  const generateMutation = useMutation({
    mutationFn: (data: { examDate: string; deckIds: string[] }) =>
      api<StudyPlanResponse>('/api/ai/study-plan', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to generate plan'),
  })

  const handleGenerate = () => {
    if (!examDate) { toast.error('Please select an exam date'); return }
    if (selectedDeckIds.length === 0) { toast.error('Select at least one deck'); return }
    generateMutation.mutate({ examDate, deckIds: selectedDeckIds })
  }

  const plan = generateMutation.data?.plan
  const summary = generateMutation.data?.summary

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-hairline bg-card-surface p-6 shadow-floating animate-scale-in overflow-y-auto scrollbar-thin"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Study plan generator"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">AI Study Plan Generator</h2>
          <button onClick={onClose} className="text-muted-recall hover:text-primary-recall" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!plan && (
          <div className="space-y-4">
            <p className="text-sm text-muted-recall">
              Generate a personalized day-by-day study plan. The AI will distribute new cards, schedule reviews, and include practice test days.
            </p>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-recall">
                Exam Date
              </label>
              <input
                type="date"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-hairline bg-void px-3 py-2 text-sm text-primary-recall focus:border-accent-brand focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-widest text-muted-recall">
                Select Decks
              </label>
              <div className="space-y-2">
                {decksData?.decks.map((deck) => (
                  <label
                    key={deck.id}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-hairline bg-void p-3 hover:border-accent-brand/50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedDeckIds.includes(deck.id)}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedDeckIds([...selectedDeckIds, deck.id])
                        else setSelectedDeckIds(selectedDeckIds.filter((id) => id !== deck.id))
                      }}
                      className="h-4 w-4 rounded accent-accent-brand"
                    />
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: deck.color }} />
                    <span className="flex-1 text-sm">{deck.name}</span>
                    <span className="text-xs text-muted-recall">{deck._count?.flashcards ?? 0} cards</span>
                  </label>
                ))}
                {(!decksData?.decks || decksData.decks.length === 0) && (
                  <p className="text-xs text-muted-recall">No decks found. Create a deck first.</p>
                )}
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={generateMutation.isPending || !examDate || selectedDeckIds.length === 0}
              className="w-full bg-accent-brand text-void hover:bg-accent-brand/90"
            >
              {generateMutation.isPending ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating plan…</>
              ) : (
                <><Sparkles className="mr-2 h-4 w-4" />Generate Study Plan</>
              )}
            </Button>
          </div>
        )}

        {plan && summary && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-hairline bg-void p-3 text-center">
                <p className="text-xs text-muted-recall">Days until exam</p>
                <p className="font-display text-xl font-bold text-accent-brand">{summary.daysUntilExam}</p>
              </div>
              <div className="rounded-lg border border-hairline bg-void p-3 text-center">
                <p className="text-xs text-muted-recall">Total cards</p>
                <p className="font-display text-xl font-bold text-primary-recall">{summary.totalCards}</p>
              </div>
              <div className="rounded-lg border border-hairline bg-void p-3 text-center">
                <p className="text-xs text-muted-recall">New to learn</p>
                <p className="font-display text-xl font-bold text-accent-warm">{summary.totalNew}</p>
              </div>
            </div>

            {/* Plan timeline */}
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">Day-by-day plan</p>
              <div className="max-h-[40vh] space-y-2 overflow-y-auto scrollbar-thin pr-1">
                {plan.map((day) => {
                  const act = ACTIVITY_LABELS[day.activity] || ACTIVITY_LABELS['mixed']
                  const Icon = act.icon
                  return (
                    <div key={day.day} className="flex items-center gap-3 rounded-lg border border-hairline bg-void p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card-surface text-xs font-bold text-primary-recall">
                        {day.day}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-recall">{day.date}</span>
                          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${act.color}`}>
                            <Icon size={10} />
                            {act.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-primary-recall">{day.deckFocus}</p>
                        <p className="text-xs text-muted-recall">
                          {day.newCards > 0 && `${day.newCards} new · `}
                          {day.reviewCards > 0 && `${day.reviewCards} reviews`}
                          {day.newCards === 0 && day.reviewCards === 0 && 'Rest day'}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <Button onClick={() => generateMutation.reset()} variant="ghost" className="w-full">
              Generate a new plan
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
