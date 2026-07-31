'use client'

import { useEffect, useRef, useState } from 'react'
import {
  SparklesIcon,
  NotebookIcon,
  FlashcardIcon,
  ClockIcon,
} from '@/components/icons/recall-icons'
import { Pin, Search, Plus, Check } from 'lucide-react'

type DemoState = 'editor' | 'summary' | 'review'

const STATES: DemoState[] = ['editor', 'summary', 'review']
const CYCLE_MS = 4500

/**
 * ProductDemoPanel — the interactive product demo shown on the landing
 * page's hero section. Cycles through 3 states every 4.5 seconds:
 *
 * 1. Note editor — shows a markdown note with a "Summarize" button
 * 2. AI summary streaming — shows bullet points appearing one-by-one
 * 3. Flashcard review — shows a card with grade buttons
 *
 * Pauses on hover and focus (so users can read). Respects reduced-motion
 * (shows state 1 only, no cycling). Uses aria-live="polite" so screen
 * readers announce state changes.
 */
export function ProductDemoPanel() {
  const [state, setState] = useState<DemoState>('editor')
  const [paused, setPaused] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const reduceMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    if (paused || reduceMotion) return

    const cycle = () => {
      setState((prev) => {
        const idx = STATES.indexOf(prev)
        return STATES[(idx + 1) % STATES.length]
      })
    }

    timerRef.current = setTimeout(cycle, CYCLE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [state, paused, reduceMotion])

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-hairline bg-card-surface shadow-panel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-label="Product demo"
    >
      {/* State indicator dots */}
      <div className="absolute right-4 top-4 z-10 flex gap-1.5">
        {STATES.map((s) => (
          <span
            key={s}
            className={`h-1.5 rounded-full transition-smooth ${
              s === state ? 'w-4 bg-accent-brand' : 'w-1.5 bg-border-hairline'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Demo content — aria-live so screen readers announce changes */}
      <div aria-live="polite" aria-atomic="true">
        {state === 'editor' && <EditorState />}
        {state === 'summary' && <SummaryState />}
        {state === 'review' && <ReviewState />}
      </div>
    </div>
  )
}

/* ============================================================
   State 1: Note Editor
   ============================================================ */
function EditorState() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <div className="flex items-center gap-2">
          <NotebookIcon size={18} />
          <span className="text-sm font-medium">My first note</span>
        </div>
        <div className="flex items-center gap-1">
          <button className="rounded-md p-1.5 text-muted-recall hover:text-primary-recall" aria-label="Search">
            <Search className="h-3.5 w-3.5" />
          </button>
          <button className="rounded-md p-1.5 text-muted-recall hover:text-primary-recall" aria-label="Pin">
            <Pin className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Body — markdown note */}
      <div className="p-5">
        <p className="font-display text-lg font-semibold">Spaced Repetition</p>
        <div className="mt-3 space-y-2 text-sm leading-relaxed text-secondary-recall">
          <p>
            Spaced repetition is a learning technique that incorporates increasing
            intervals of time between subsequent reviews of previously learned
            material.
          </p>
          <p className="font-medium text-primary-recall">## FSRS Algorithm</p>
          <p>
            The Free Spaced Repetition Scheduler (FSRS) is an open-source algorithm
            that benchmarks better than the classic SM-2.
          </p>
        </div>

        {/* Summarize button */}
        <button className="mt-5 flex items-center gap-2 rounded-full bg-accent-brand-dim px-4 py-2 text-sm font-medium text-accent-brand press transition-smooth hover:bg-accent-brand/20">
          <SparklesIcon size={16} />
          Summarize
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   State 2: AI Summary Streaming
   ============================================================ */
function SummaryState() {
  const bullets = [
    'Spaced repetition uses increasing intervals to exploit the spacing effect.',
    'FSRS is an open-source algorithm that outperforms the classic SM-2.',
    'FSRS uses stability, difficulty, and retrievability to schedule reviews.',
    'Reviewing at the right moment strengthens memory traces efficiently.',
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-brand-dim">
            <SparklesIcon size={14} />
          </div>
          <span className="text-sm font-medium">Summary</span>
          <span className="rounded-full bg-accent-brand-dim px-2 py-0.5 text-[10px] font-semibold text-accent-brand">
            AI SUMMARY
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-accent-warm">
          <ClockIcon size={12} />
          <span className="tabular-nums">2h 47m → 90s</span>
        </div>
      </div>

      {/* Bullet points — staggered entrance */}
      <div className="p-5">
        <ul className="space-y-3">
          {bullets.map((bullet, i) => (
            <li
              key={i}
              className="flex items-start gap-2.5 text-sm leading-relaxed text-secondary-recall animate-fade-in-up"
              style={{ animationDelay: `${i * 200}ms` }}
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-brand"
                aria-hidden="true"
              />
              {bullet}
            </li>
          ))}
        </ul>

        {/* Footer */}
        <div className="mt-5 flex items-center justify-between border-t border-hairline pt-3">
          <span className="text-xs text-muted-recall">Streaming via SSE</span>
          <div className="flex items-center gap-1.5 text-xs text-accent-brand">
            <Check className="h-3 w-3" />
            <span>Complete</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   State 3: Flashcard Review
   ============================================================ */
function ReviewState() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline px-5 py-3.5">
        <div className="flex items-center gap-2">
          <FlashcardIcon size={18} />
          <span className="text-sm font-medium">Memory Techniques</span>
        </div>
        <span className="text-xs tabular-nums text-muted-recall">3 / 10</span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full bg-border-hairline">
        <div className="h-full bg-accent-brand transition-smooth" style={{ width: '30%' }} />
      </div>

      {/* Card */}
      <div className="p-5">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">Question</p>
        <p className="mt-2 text-lg font-medium leading-relaxed">
          What does FSRS stand for?
        </p>

        {/* Reveal button */}
        <button className="mt-4 w-full rounded-xl bg-accent-brand py-2.5 text-sm font-medium text-void press transition-smooth hover:bg-accent-brand/90">
          Reveal answer
        </button>

        {/* Grade buttons */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          {[
            { label: 'Again', color: 'bg-grade-again' },
            { label: 'Hard', color: 'bg-grade-hard' },
            { label: 'Good', color: 'bg-grade-good' },
            { label: 'Easy', color: 'bg-grade-easy' },
          ].map((btn) => (
            <button
              key={btn.label}
              className={`flex flex-col items-center gap-0.5 rounded-lg ${btn.color} py-2.5 text-[10px] font-medium text-void press transition-spring`}
            >
              <span className="text-xs font-semibold">{btn.label.split('')[0]}</span>
              <span>{btn.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
