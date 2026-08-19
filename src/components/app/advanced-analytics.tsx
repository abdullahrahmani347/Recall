'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Card } from '@/components/ui/card'
import { Loader2, TrendingUp, TrendingDown, Minus, Clock, Target, BookOpen, Brain, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

// ============================================================
// Types
// ============================================================

interface LearningCurveCard {
  id: string
  front: string
  deckName: string
  stability: number
  difficulty: number
  interval: number
  repetitions: number
  lapses: number
  currentRetention: number
  projectedRetention: { day: number; retention: number }[]
}

interface TimeOfDayEntry {
  hour: number
  label: string
  totalReviews: number
  correct: number
  again: number
  retentionRate: number
  avgResponseMs: number
}

interface Subject {
  name: string
  color: string
  mastery: number
  retention: number
  coverage: number
  stability: number
  cardCount: number
  learnedCards: number
}

interface ReadinessData {
  readiness: number
  daysUntilExam: number
  metrics: {
    coverage: number
    retentionRate: number
    avgStability: number
    totalCards: number
    learnedCards: number
    dueCards: number
    dueRate: number
  }
  breakdown: { deckName: string; totalCards: number; learnedCards: number; dueCards: number; retention: number; coverage: number }[]
  recommendations: string[]
}

interface CompareData {
  range: string
  current: { totalReviews: number; retentionRate: number; avgResponseMs: number; avgPerDay: number; activeDays: number }
  previous: { totalReviews: number; retentionRate: number; avgResponseMs: number; avgPerDay: number; activeDays: number }
  changes: { totalReviews: number; retentionRate: number; avgResponseMs: number; avgPerDay: number; activeDays: number }
  trend: 'up' | 'down' | 'flat'
}

// ============================================================
// Main component
// ============================================================

export function AdvancedAnalytics() {
  const [examDate, setExamDate] = useState('')

  return (
    <div className="space-y-6">
      {/* Forgetting Curves */}
      <ForgettingCurvesSection />

      {/* Time-of-Day Heatmap */}
      <TimeOfDaySection />

      {/* Subject Mastery Radar */}
      <MasterySection />

      {/* Exam Readiness */}
      <ReadinessSection examDate={examDate} setExamDate={setExamDate} />

      {/* Comparison Mode */}
      <CompareSection />
    </div>
  )
}

// ============================================================
// Forgetting Curves
// ============================================================

function ForgettingCurvesSection() {
  const { data, isLoading } = useQuery<{ cards: LearningCurveCard[] }>({
    queryKey: ['learning-curve'],
    queryFn: () => api('/api/analytics/learning-curve?limit=5'),
  })

  return (
    <Card className="border-hairline bg-card-surface p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-recall flex items-center gap-2">
        <Brain className="h-3.5 w-3.5 text-accent-brand" />
        Forgetting Curves
      </h2>
      <p className="mb-4 text-xs text-muted-recall">Projected memory decay per card (based on FSRS stability)</p>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent-brand" /></div>}

      {data?.cards.length === 0 && <p className="text-sm text-muted-recall text-center py-4">No cards with review history yet.</p>}

      {data?.cards.map((card) => {
        const color = card.currentRetention > 70 ? 'text-accent-brand' : card.currentRetention > 40 ? 'text-accent-warm' : 'text-grade-again'
        return (
          <div key={card.id} className="mb-4 rounded-lg border border-hairline bg-void p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm text-primary-recall truncate flex-1">{card.front}</p>
              <span className={cn('text-xs font-medium', color)}>{card.currentRetention}% now</span>
            </div>
            {/* SVG curve chart */}
            <svg viewBox="0 0 300 60" className="w-full h-12">
              <defs>
                <linearGradient id={`grad-${card.id}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-brand)" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="var(--accent-brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d={`M 0 60 ${card.projectedRetention.map((p, i) => `L ${(i / 29) * 300} ${60 - (p.retention / 100) * 60}`).join(' ')} L 300 60 Z`}
                fill={`url(#grad-${card.id})`}
              />
              <path
                d={`M 0 ${60 - (card.projectedRetention[0].retention / 100) * 60} ${card.projectedRetention.map((p, i) => `L ${(i / 29) * 300} ${60 - (p.retention / 100) * 60}`).join(' ')}`}
                fill="none"
                stroke="var(--accent-brand)"
                strokeWidth="1.5"
              />
            </svg>
            <div className="mt-1 flex gap-3 text-[10px] text-muted-recall">
              <span>Stability: {card.stability}d</span>
              <span>Difficulty: {Math.round(card.difficulty * 100)}%</span>
              <span>Reps: {card.repetitions}</span>
              {card.lapses > 0 && <span className="text-grade-again">Lapses: {card.lapses}</span>}
            </div>
          </div>
        )
      })}
    </Card>
  )
}

// ============================================================
// Time-of-Day Heatmap
// ============================================================

function TimeOfDaySection() {
  const { data, isLoading } = useQuery<{
    heatmap: TimeOfDayEntry[]
    peakHours: number[]
    bestHours: number[]
    summary: { morning: number; afternoon: number; evening: number; night: number }
  }>({ queryKey: ['time-of-day'], queryFn: () => api('/api/analytics/time-of-day') })

  if (isLoading) return <Card className="border-hairline bg-card-surface p-5"><div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent-brand" /></div></Card>

  if (!data) return null

  const maxReviews = Math.max(...data.heatmap.map((h) => h.totalReviews), 1)
  const timeOfDayColor = (h: TimeOfDayEntry) => {
    if (h.totalReviews === 0) return 'bg-void'
    const intensity = h.totalReviews / maxReviews
    if (h.retentionRate > 80) return 'bg-accent-brand'
    if (h.retentionRate > 60) return 'bg-accent-brand/60'
    if (h.retentionRate > 40) return 'bg-accent-warm/60'
    return 'bg-grade-again/40'
  }

  return (
    <Card className="border-hairline bg-card-surface p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-recall flex items-center gap-2">
        <Clock className="h-3.5 w-3.5 text-accent-warm" />
        Time-of-Day Performance
      </h2>
      <p className="mb-4 text-xs text-muted-recall">When do you learn best? Color = retention, height = volume</p>

      {/* 24-hour bar chart */}
      <div className="flex items-end gap-0.5 h-24 mb-3">
        {data.heatmap.map((h) => (
          <div
            key={h.hour}
            className={cn('flex-1 rounded-t transition hover:opacity-80', timeOfDayColor(h))}
            style={{ height: `${Math.max(2, (h.totalReviews / maxReviews) * 100)}%` }}
            title={`${h.label}: ${h.totalReviews} reviews, ${h.retentionRate}% retention`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-recall mb-4">
        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Morning', value: data.summary.morning, icon: '🌅' },
          { label: 'Afternoon', value: data.summary.afternoon, icon: '☀️' },
          { label: 'Evening', value: data.summary.evening, icon: '🌆' },
          { label: 'Night', value: data.summary.night, icon: '🌙' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-void p-2">
            <p className="text-xs text-muted-recall">{s.label}</p>
            <p className="text-sm font-semibold text-primary-recall">{s.value}</p>
          </div>
        ))}
      </div>

      {data.bestHours.length > 0 && (
        <p className="mt-3 text-xs text-accent-brand">
          🎯 Best performance at: {data.bestHours.map((h) => `${h.toString().padStart(2, '0')}:00`).join(', ')}
        </p>
      )}
    </Card>
  )
}

// ============================================================
// Subject Mastery Radar
// ============================================================

function MasterySection() {
  const { data, isLoading } = useQuery<{
    subjects: Subject[]
    averageMastery: number
  }>({ queryKey: ['mastery'], queryFn: () => api('/api/analytics/mastery') })

  if (isLoading) return <Card className="border-hairline bg-card-surface p-5"><div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent-brand" /></div></Card>

  if (!data || data.subjects.length === 0) return null

  // Simple bar-based radar (no external chart library needed)
  return (
    <Card className="border-hairline bg-card-surface p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-recall flex items-center gap-2">
        <Award className="h-3.5 w-3.5 text-accent-brand" />
        Subject Mastery
      </h2>
      <p className="mb-4 text-xs text-muted-recall">Average mastery: <span className="font-semibold text-primary-recall">{data.averageMastery}%</span></p>

      <div className="space-y-3">
        {data.subjects.slice(0, 8).map((s) => (
          <div key={s.name}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-primary-recall truncate">{s.name}</span>
              </span>
              <span className="font-semibold text-primary-recall">{s.mastery}%</span>
            </div>
            <div className="flex gap-1 h-2">
              {/* Mastery bar split into 3 segments: coverage, retention, stability */}
              <div className="h-full rounded-l-full" style={{ width: `${s.coverage * 0.4}%`, backgroundColor: `${s.color}60` }} title={`Coverage: ${s.coverage}%`} />
              <div className="h-full" style={{ width: `${s.retention * 0.4}%`, backgroundColor: s.color }} title={`Retention: ${s.retention}%`} />
              <div className="h-full rounded-r-full" style={{ width: `${Math.min(100, s.stability * 20) * 0.2}%`, backgroundColor: `${s.color}40` }} title={`Stability: ${s.stability}d`} />
            </div>
            <div className="mt-0.5 flex gap-3 text-[10px] text-muted-recall">
              <span>{s.learnedCards}/{s.cardCount} learned</span>
              <span>{s.retention}% retention</span>
              <span>{s.stability}d stability</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-3 text-[10px] text-muted-recall">
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent-brand/40" />Coverage</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent-brand" />Retention</span>
        <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-accent-brand/30" />Stability</span>
      </div>
    </Card>
  )
}

// ============================================================
// Exam Readiness
// ============================================================

function ReadinessSection({ examDate, setExamDate }: { examDate: string; setExamDate: (v: string) => void }) {
  const { data, isLoading, refetch } = useQuery<ReadinessData>({
    queryKey: ['readiness', examDate],
    queryFn: () => api(`/api/analytics/readiness?examDate=${examDate}`),
    enabled: !!examDate,
  })

  const color = data ? (data.readiness >= 80 ? 'text-accent-brand' : data.readiness >= 60 ? 'text-accent-warm' : data.readiness >= 40 ? 'text-grade-hard' : 'text-grade-again') : ''
  const bgColor = data ? (data.readiness >= 80 ? 'bg-accent-brand/10 border-accent-brand/30' : data.readiness >= 60 ? 'bg-accent-warm/10 border-accent-warm/30' : 'bg-grade-again/10 border-grade-again/30') : ''

  return (
    <Card className="border-hairline bg-card-surface p-5">
      <h2 className="mb-1 text-xs font-semibold uppercase tracking-widest text-muted-recall flex items-center gap-2">
        <Target className="h-3.5 w-3.5 text-accent-brand" />
        Exam Readiness
      </h2>
      <p className="mb-4 text-xs text-muted-recall">Predicted readiness based on retention, coverage, and stability</p>

      <div className="mb-4">
        <input
          type="date"
          value={examDate}
          onChange={(e) => setExamDate(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
          className="w-full rounded-lg border border-hairline bg-void px-3 py-2 text-sm text-primary-recall focus:border-accent-brand focus:outline-none"
        />
      </div>

      {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent-brand" /></div>}

      {data && (
        <>
          <div className={cn('rounded-xl border p-4 text-center mb-4', bgColor)}>
            <p className={cn('font-display text-4xl font-bold', color)}>{data.readiness}%</p>
            <p className="text-xs text-muted-recall mt-1">{data.daysUntilExam} days until exam</p>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricBox label="Coverage" value={`${data.metrics.coverage}%`} sub={`${data.metrics.learnedCards}/${data.metrics.totalCards} cards`} />
            <MetricBox label="Retention" value={`${data.metrics.retentionRate}%`} sub="correct reviews" />
            <MetricBox label="Stability" value={`${data.metrics.avgStability}d`} sub="avg memory" />
            <MetricBox label="Due now" value={`${data.metrics.dueCards}`} sub={`${data.metrics.dueRate}% of total`} />
          </div>

          {data.recommendations.length > 0 && (
            <div className="rounded-lg border border-hairline bg-void p-3 space-y-2">
              <p className="text-xs font-medium text-accent-brand">Recommendations:</p>
              {data.recommendations.map((rec, i) => (
                <p key={i} className="text-xs text-secondary-recall flex items-start gap-2">
                  <span className="text-accent-brand mt-0.5">→</span>
                  {rec}
                </p>
              ))}
            </div>
          )}

          {/* Per-deck breakdown */}
          {data.breakdown.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-recall">Per-deck breakdown:</p>
              <div className="space-y-1.5">
                {data.breakdown.map((d) => (
                  <div key={d.deckName} className="flex items-center gap-2 text-xs">
                    <span className="flex-1 truncate text-secondary-recall">{d.deckName}</span>
                    <span className="text-muted-recall">{d.coverage}% covered</span>
                    <span className={cn('font-medium', d.retention > 70 ? 'text-accent-brand' : 'text-accent-warm')}>{d.retention}% ret</span>
                    {d.dueCards > 0 && <span className="text-grade-again">{d.dueCards} due</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}

function MetricBox({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-void p-3 text-center">
      <p className="text-xs text-muted-recall">{label}</p>
      <p className="text-lg font-semibold text-primary-recall">{value}</p>
      <p className="text-[10px] text-muted-recall">{sub}</p>
    </div>
  )
}

// ============================================================
// Comparison Mode
// ============================================================

function CompareSection() {
  const [range, setRange] = useState<'week' | 'month'>('week')
  const { data, isLoading } = useQuery<CompareData>({
    queryKey: ['compare', range],
    queryFn: () => api(`/api/analytics/compare?range=${range}`),
  })

  if (isLoading) return <Card className="border-hairline bg-card-surface p-5"><div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-accent-brand" /></div></Card>
  if (!data) return null

  const Trend = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus
  const trendColor = data.trend === 'up' ? 'text-accent-brand' : data.trend === 'down' ? 'text-grade-again' : 'text-muted-recall'

  const metrics = [
    { label: 'Total Reviews', current: data.current.totalReviews, change: data.changes.totalReviews, suffix: '' },
    { label: 'Retention Rate', current: data.current.retentionRate, change: data.changes.retentionRate, suffix: '%' },
    { label: 'Avg Response', current: data.current.avgResponseMs, change: data.changes.avgResponseMs, suffix: 'ms' },
    { label: 'Avg/Day', current: data.current.avgPerDay, change: data.changes.avgPerDay, suffix: '' },
    { label: 'Active Days', current: data.current.activeDays, change: data.changes.activeDays, suffix: '' },
  ]

  return (
    <Card className="border-hairline bg-card-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-recall flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-accent-warm" />
          Comparison
        </h2>
        <div className="flex gap-1">
          {(['week', 'month'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn('rounded-full px-2.5 py-1 text-xs font-medium transition', range === r ? 'bg-accent-brand-dim text-accent-brand' : 'bg-void text-muted-recall')}
            >
              {r === 'week' ? '7d' : '30d'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <Trend className={cn('h-4 w-4', trendColor)} />
        <span className={cn('text-sm font-medium', trendColor)}>
          {data.trend === 'up' ? 'Improving' : data.trend === 'down' ? 'Declining' : 'Stable'}
        </span>
        <span className="text-xs text-muted-recall">vs. previous {range}</span>
      </div>

      <div className="space-y-2">
        {metrics.map((m) => {
          const isPositiveChange = (m.label === 'Avg Response' ? m.change < 0 : m.change > 0)
          const changeColor = m.change === 0 ? 'text-muted-recall' : isPositiveChange ? 'text-accent-brand' : 'text-grade-again'
          return (
            <div key={m.label} className="flex items-center justify-between rounded-lg bg-void p-2.5">
              <span className="text-xs text-secondary-recall">{m.label}</span>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-recall">{data.previous[Object.keys(data.previous).find(k => k.toLowerCase().includes(m.label.toLowerCase().split(' ')[0])) as keyof typeof data.previous] ?? '—'}</span>
                <span className="text-muted-recall">→</span>
                <span className="text-sm font-semibold text-primary-recall">{m.current}{m.suffix}</span>
                <span className={cn('text-xs font-medium w-12 text-right', changeColor)}>
                  {m.change > 0 ? '+' : ''}{m.change}{m.suffix}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
