'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { ReviewHeatmap } from '@/components/app/review-heatmap'
import { Achievements } from '@/components/app/achievements'
import { useAppStore } from '@/stores/app-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Calendar, Zap } from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts'
import type { Analytics as AnalyticsT } from '@/lib/types'
import { Flame, Clock, Target, TrendingUp, Layers, Trophy } from 'lucide-react'

const GRADE_COLORS = {
  again: '#F0554B',
  hard: '#F5A623',
  good: '#34E7A8',
  easy: '#4C8CFF',
}

const RANGES = [
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
  { value: '365d', label: '1 year' },
] as const

export function AnalyticsView() {
  const { startReview } = useAppStore()
  const [range, setRange] = useState<'30d' | '90d' | '365d'>('30d')

  const { data, isLoading } = useQuery<AnalyticsT>({
    queryKey: ['analytics', range],
    queryFn: () => api<AnalyticsT>(`/api/analytics?range=${range}`),
  })

  // Forecast data — always loaded (not range-dependent)
  const { data: forecast } = useQuery<{
    dailyDue: { date: string; count: number }[]
    totalDue: number
    todayCount: number
    tomorrowCount: number
    nextHeavyDay: { date: string; count: number } | null
    avgPerDay: number
    estimatedDaysToClear: number | null
  }>({
    queryKey: ['forecast'],
    queryFn: () => api('/api/forecast'),
    staleTime: 60_000,
  })

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-recall">Loading analytics…</p>
      </div>
    )
  }

  // Format daily buckets for the chart — bucket by day for 30d, by 3 days for 90d, by week for 365d
  const bucketSize = range === '30d' ? 1 : range === '90d' ? 3 : 7
  const chartData = []
  for (let i = 0; i < data.dailyBuckets.length; i += bucketSize) {
    const chunk = data.dailyBuckets.slice(i, i + bucketSize)
    const reviewed = chunk.reduce((s, b) => s + b.reviewed, 0)
    const correct = chunk.reduce((s, b) => s + b.correct, 0)
    const again = chunk.reduce((s, b) => s + b.again, 0)
    const date = new Date(chunk[0].date)
    const label =
      bucketSize === 1
        ? `${date.getMonth() + 1}/${date.getDate()}`
        : bucketSize === 3
          ? `${date.getMonth() + 1}/${date.getDate()}`
          : `W${Math.ceil((date.getDate() + new Date(date.getFullYear(), date.getMonth(), 1).getDay()) / 7)}`
    chartData.push({ label, reviewed, correct, again })
  }

  const gradePieData = [
    { name: 'Again', value: data.gradeDistribution.again, color: GRADE_COLORS.again },
    { name: 'Hard', value: data.gradeDistribution.hard, color: GRADE_COLORS.hard },
    { name: 'Good', value: data.gradeDistribution.good, color: GRADE_COLORS.good },
    { name: 'Easy', value: data.gradeDistribution.easy, color: GRADE_COLORS.easy },
  ].filter((d) => d.value > 0)

  const totalGrade = gradePieData.reduce((s, d) => s + d.value, 0)
  const retentionPct = Math.round(data.retentionRate * 100)
  const avgResponseSec = Math.round(data.avgResponseTimeMs / 1000)

  return (
    <div className="mx-auto max-w-4xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
      {/* HEADER */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 animate-fade-in-up">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">Insights</p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Analytics</h1>
        </div>
        <div className="flex gap-1 rounded-xl border border-hairline bg-card-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-smooth press ${
                range === r.value
                  ? 'bg-accent-brand text-void'
                  : 'text-secondary-recall hover:text-primary-recall'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {/* TOP STATS */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={TrendingUp} label="Retention" value={`${retentionPct}%`} sub="correct / total" color="text-accent-brand" className="animate-fade-in-up stagger-1" />
        <StatCard icon={Flame} label="Streak" value={`${data.streak}`} sub={`day${data.streak === 1 ? '' : 's'}`} color="text-accent-warm" className="animate-fade-in-up stagger-2" />
        <StatCard icon={Clock} label="Reviews" value={`${data.totalReviews}`} sub={`in ${data.days} days`} color="text-grade-easy" className="animate-fade-in-up stagger-3" />
        <StatCard icon={Target} label="Avg time" value={avgResponseSec > 0 ? `${avgResponseSec}s` : '—'} sub="per card" color="text-grade-hard" className="animate-fade-in-up stagger-4" />
      </div>

      {/* REVIEW HEATMAP — GitHub-style contribution grid */}
      <Card className="mb-6 border-hairline bg-card-surface p-5 animate-fade-in-up stagger-2">
        <ReviewHeatmap days={365} />
      </Card>

      {/* ACHIEVEMENTS & GAMIFICATION */}
      <Card className="mb-6 border-hairline bg-card-surface p-5 animate-fade-in-up stagger-3">
        <div className="mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-accent-warm" aria-hidden="true" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-recall">
            Achievements
          </h2>
        </div>
        <Achievements />
      </Card>

      {/* FORECAST — upcoming review load + completion estimates */}
      {forecast && (
        <Card className="mb-6 border-hairline bg-card-surface p-5 animate-fade-in-up stagger-3">
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent-warm" aria-hidden="true" />
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-recall">
              Forecast
            </h2>
          </div>

          {/* Forecast stat row */}
          <div className="mb-4 grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-void p-3 text-center">
              <p className="font-display text-2xl font-semibold tabular-nums text-accent-warm">
                {forecast.todayCount}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-recall">Due today</p>
            </div>
            <div className="rounded-lg bg-void p-3 text-center">
              <p className="font-display text-2xl font-semibold tabular-nums text-secondary-recall">
                {forecast.tomorrowCount}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-recall">Tomorrow</p>
            </div>
            <div className="rounded-lg bg-void p-3 text-center">
              <p className="font-display text-2xl font-semibold tabular-nums text-accent-brand">
                {forecast.avgPerDay}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-muted-recall">Avg/day</p>
            </div>
          </div>

          {/* 14-day bar chart */}
          <div className="mb-4">
            <div className="flex items-end gap-1" style={{ height: '60px' }}>
              {forecast.dailyDue.map((day) => {
                const maxCount = Math.max(...forecast.dailyDue.map((d) => d.count), 1)
                const heightPct = (day.count / maxCount) * 100
                return (
                  <div
                    key={day.date}
                    className="flex-1 rounded-t-sm transition-smooth"
                    style={{
                      height: `${Math.max(heightPct, 4)}%`,
                      backgroundColor: day.count === 0 ? 'var(--border-hairline)' : 'var(--accent-brand)',
                      opacity: day.count === 0 ? 0.3 : 0.4 + heightPct * 0.006,
                    }}
                    title={`${day.date}: ${day.count} due`}
                  />
                )
              })}
            </div>
            <div className="mt-1.5 flex justify-between text-[9px] text-muted-recall">
              <span>Today</span>
              <span>+14 days</span>
            </div>
          </div>

          {/* Next heavy day + estimate */}
          <div className="flex flex-col gap-2 text-sm">
            {forecast.nextHeavyDay && (
              <div className="flex items-center gap-2 text-secondary-recall">
                <Zap className="h-3.5 w-3.5 text-accent-warm" />
                <span>
                  Next heavy day: <span className="font-medium text-primary-recall">
                    {forecast.nextHeavyDay.count} cards
                  </span>{' '}
                  on {new Date(forecast.nextHeavyDay.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
              </div>
            )}
            {forecast.estimatedDaysToClear !== null && forecast.totalDue > 0 && (
              <div className="flex items-center gap-2 text-secondary-recall">
                <TrendingUp className="h-3.5 w-3.5 text-accent-brand" />
                <span>
                  At your current pace, you&apos;ll clear the backlog in{' '}
                  <span className="font-medium text-primary-recall">
                    {forecast.estimatedDaysToClear} day{forecast.estimatedDaysToClear === 1 ? '' : 's'}
                  </span>
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* DAILY REVIEWS CHART */}
      <Card className="mb-6 border-hairline bg-card-surface p-5">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-muted-recall">
          Daily reviews
        </h2>
        <p className="mb-4 text-xs text-muted-recall">
          Stacked: correct (good + easy) vs forgotten (again).
        </p>
        {data.totalReviews === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-recall">
            No reviews in this range yet. Start a review session!
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2C2F36" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: '#8A8D94', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#2C2F36' }}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: '#8A8D94', fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: '#2C2F36' }}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#1C1F24',
                  border: '1px solid #2C2F36',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#F2F3F5' }}
                cursor={{ fill: '#2C2F36', opacity: 0.3 }}
              />
              <Bar dataKey="correct" stackId="a" fill={GRADE_COLORS.good} name="Correct" radius={[0, 0, 0, 0]} />
              <Bar dataKey="again" stackId="a" fill={GRADE_COLORS.again} name="Again" radius={[2, 2, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        {/* GRADE DISTRIBUTION */}
        <Card className="border-hairline bg-card-surface p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-recall">
            Grade distribution
          </h2>
          {totalGrade === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-recall">
              No graded reviews yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={gradePieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                >
                  {gradePieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1C1F24',
                    border: '1px solid #2C2F36',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* DECK MATURITY */}
        <Card className="border-hairline bg-card-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-recall">
              Deck maturity
            </h2>
            <Layers className="h-4 w-4 text-muted-recall" aria-hidden="true" />
          </div>
          {data.deckStats.length === 0 ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-recall">
              No decks yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {data.deckStats.map((deck) => {
                const total = deck.totalCards || 1
                const maturePct = (deck.matureCards / total) * 100
                const youngPct = (deck.youngCards / total) * 100
                const newPct = ((total - deck.matureCards - deck.youngCards) / total) * 100
                return (
                  <li key={deck.id}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="truncate font-medium">{deck.name}</span>
                      <span className="text-xs text-muted-recall">
                        {deck.totalCards} cards · {deck.dueCards} due
                      </span>
                    </div>
                    <div className="flex h-2 overflow-hidden rounded-full bg-void">
                      <div
                        className="bg-grade-easy"
                        style={{ width: `${maturePct}%` }}
                        title={`Mature: ${deck.matureCards}`}
                      />
                      <div
                        className="bg-grade-good"
                        style={{ width: `${youngPct}%` }}
                        title={`Young: ${deck.youngCards}`}
                      />
                      <div
                        className="bg-grade-hard"
                        style={{ width: `${newPct}%` }}
                        title={`New: ${total - deck.matureCards - deck.youngCards}`}
                      />
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* ACTIONS */}
      {data.totalReviews === 0 && (
        <Card className="border border-dashed border-hairline bg-card-surface/50 p-6 text-center">
          <p className="font-medium">No review data yet</p>
          <p className="mt-1 text-sm text-secondary-recall">
            Complete a review session to populate your analytics.
          </p>
          <Button
            onClick={() => startReview(null)}
            className="mt-4 bg-accent-brand text-void hover:bg-accent-brand/90"
          >
            Start a review
          </Button>
        </Card>
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  className = '',
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  value: string
  sub: string
  color: string
  className?: string
}) {
  return (
    <Card className={`border-hairline bg-card-surface p-4 card-lift ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-muted-recall">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${color}`} aria-hidden="true" />
      </div>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-recall">{sub}</p>
    </Card>
  )
}
