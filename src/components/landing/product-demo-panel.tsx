'use client'

import { useEffect, useRef, useState } from 'react'
import { SparklesIcon, ClockIcon } from '@/components/icons/recall-icons'
import { Pin, Check, ArrowRight } from 'lucide-react'

type DemoState = 'editor' | 'summary' | 'review'

const STATES: DemoState[] = ['editor', 'summary', 'review']
const CYCLE_MS = 5000

/**
 * ProductDemoPanel — a detailed, realistic product mockup that cycles
 * through the 3-step Recall loop: capture → summarize → review.
 *
 * This isn't a simplified "demo" — it's the actual product UI rendered
 * with real-feeling content, timestamps, and micro-details that make
 * it read as a genuine screenshot rather than a marketing mockup.
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
      setState((prev) => STATES[(STATES.indexOf(prev) + 1) % STATES.length])
    }
    timerRef.current = setTimeout(cycle, CYCLE_MS)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [state, paused, reduceMotion])

  const stateLabels: Record<DemoState, string> = {
    editor: 'Step 1 — Capture',
    summary: 'Step 2 — Summarize',
    review: 'Step 3 — Review',
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-hairline bg-card-surface shadow-panel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      aria-label="Product demo"
    >
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-grade-again/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-grade-hard/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-grade-good/60" />
        </div>
        <span className="ml-2 text-[11px] font-medium text-muted-recall">
          {stateLabels[state]}
        </span>
        {/* Progress segments */}
        <div className="ml-auto flex gap-1">
          {STATES.map((s, i) => (
            <span
              key={s}
              className={`h-0.5 rounded-full transition-smooth ${
                s === state ? 'w-6 bg-accent-brand' : 'w-3 bg-border-hairline'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div aria-live="polite" aria-atomic="true" className="min-h-[340px]">
        {state === 'editor' && <EditorState />}
        {state === 'summary' && <SummaryState />}
        {state === 'review' && <ReviewState />}
      </div>
    </div>
  )
}

/* ============================================================
   State 1: Note Editor — real markdown content with cursor
   ============================================================ */
function EditorState() {
  return (
    <div className="animate-fade-in">
      {/* Note header */}
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <span className="text-xs text-muted-recall">note.md</span>
        <div className="flex items-center gap-1">
          <Pin className="h-3 w-3 text-accent-warm" />
          <span className="text-[11px] text-muted-recall">Saved 2s ago</span>
        </div>
      </div>

      {/* Markdown body — rendered as actual markdown syntax */}
      <div className="p-4 font-mono text-[13px] leading-relaxed">
        <p className="font-display text-base font-semibold text-primary-recall">
          # Spaced Repetition
        </p>
        <p className="mt-2 text-secondary-recall">
          Spaced repetition exploits the{' '}
          <span className="text-accent-brand">spacing effect</span> —
          information is better retained when study sessions are spread out.
        </p>
        <p className="mt-2 font-display text-sm font-semibold text-primary-recall">
          ## FSRS Algorithm
        </p>
        <p className="mt-1 text-secondary-recall">
          FSRS uses <span className="text-accent-warm">stability</span>,{' '}
          <span className="text-accent-warm">difficulty</span>, and{' '}
          <span className="text-accent-warm">retrievability</span> to schedule
          the optimal review moment.
        </p>
        {/* Blinking cursor */}
        <span className="inline-block h-4 w-[2px] animate-pulse bg-accent-brand align-middle" />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5">
        <span className="text-[11px] text-muted-recall">68 words · 3 min read</span>
        <button className="flex items-center gap-1.5 rounded-md bg-accent-brand-dim px-2.5 py-1 text-[11px] font-medium text-accent-brand">
          <SparklesIcon size={12} />
          Summarize
          <ArrowRight className="h-2.5 w-2.5" />
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   State 2: AI Summary — streaming bullets with timestamps
   ============================================================ */
function SummaryState() {
  const bullets = [
    { text: 'Spaced repetition exploits the spacing effect for better long-term retention.', time: '00:02' },
    { text: 'FSRS outperforms the classic SM-2 algorithm in independent benchmarks.', time: '00:04' },
    { text: 'Reviews scheduled at the forgetting curve\'s optimal moment strengthen memory.', time: '00:06' },
  ]

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="rounded bg-accent-brand-dim px-1.5 py-0.5 text-[10px] font-semibold text-accent-brand">
            AI SUMMARY
          </span>
          <span className="text-xs text-muted-recall">from note.md</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-accent-warm">
          <ClockIcon size={11} />
          <span className="tabular-nums">3 min → 30s</span>
        </div>
      </div>

      {/* Streaming bullets */}
      <div className="p-4">
        <ul className="space-y-3">
          {bullets.map((b, i) => (
            <li
              key={i}
              className="flex items-start gap-3 animate-fade-in-up"
              style={{ animationDelay: `${i * 600}ms` }}
            >
              <span className="mt-0.5 shrink-0 font-mono text-[10px] text-muted-recall tabular-nums">
                {b.time}
              </span>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-brand mt-1.5" />
              <span className="text-[13px] leading-relaxed text-secondary-recall">
                {b.text}
              </span>
            </li>
          ))}
        </ul>

        {/* Streaming indicator */}
        <div className="mt-4 flex items-center gap-2 border-t border-hairline pt-3">
          <div className="flex gap-1">
            <span className="h-1 w-1 animate-bounce rounded-full bg-accent-brand [animation-delay:-0.3s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-accent-brand [animation-delay:-0.15s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-accent-brand" />
          </div>
          <span className="text-[11px] text-muted-recall">Streaming via SSE</span>
        </div>
      </div>
    </div>
  )
}

/* ============================================================
   State 3: Flashcard Review — real card with FSRS scheduling
   ============================================================ */
function ReviewState() {
  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
        <span className="text-xs font-medium">Memory Techniques</span>
        <span className="text-[11px] text-muted-recall tabular-nums">7 of 12</span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full bg-border-hairline">
        <div className="h-full bg-accent-brand" style={{ width: '58%' }} />
      </div>

      {/* Card */}
      <div className="p-4">
        <p className="text-[10px] font-medium uppercase tracking-widest text-muted-recall">
          Question
        </p>
        <p className="mt-2 text-base font-medium leading-snug">
          What three parameters does FSRS use to schedule reviews?
        </p>

        {/* Answer revealed */}
        <div className="mt-4 rounded-lg border border-hairline bg-void p-3">
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-recall">
            Answer
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-secondary-recall">
            <span className="text-accent-warm">Stability</span> — how durable the memory is.
            <br />
            <span className="text-accent-warm">Difficulty</span> — how hard the concept is.
            <br />
            <span className="text-accent-warm">Retrievability</span> — probability of recall right now.
          </p>
        </div>

        {/* Grade buttons with next interval */}
        <div className="mt-4 grid grid-cols-4 gap-1.5">
          {[
            { label: 'Again', interval: '<1m', color: 'bg-grade-again' },
            { label: 'Hard', interval: '3d', color: 'bg-grade-hard' },
            { label: 'Good', interval: '8d', color: 'bg-grade-good' },
            { label: 'Easy', interval: '21d', color: 'bg-grade-easy' },
          ].map((btn) => (
            <button
              key={btn.label}
              className={`flex flex-col items-center rounded-lg ${btn.color} py-2 text-void`}
            >
              <span className="text-[11px] font-semibold">{btn.label}</span>
              <span className="text-[9px] opacity-80 tabular-nums">{btn.interval}</span>
            </button>
          ))}
        </div>

        {/* Next review indicator */}
        <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-muted-recall">
          <Check className="h-3 w-3 text-accent-brand" />
          Next review scheduled based on FSRS-4.5
        </div>
      </div>
    </div>
  )
}
