'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
import { Flame, Clock, Target, TrendingUp, Layers } from 'lucide-react'

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
    <div className="mx-auto max-w-4xl px-4 pb-8 pt-6 sm:px-6">
      {/* HEADER */}
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-recall">Insights</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Analytics</h1>
        </div>
        <div className="flex gap-1 rounded-lg border border-hairline bg-card-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
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
        <StatCard
          icon={TrendingUp}
          label="Retention"
          value={`${retentionPct}%`}
          sub="correct / total"
          color="text-accent-brand"
        />
        <StatCard
          icon={Flame}
          label="Streak"
          value={`${data.streak}`}
          sub={`day${data.streak === 1 ? '' : 's'}`}
          color="text-accent-warm"
        />
        <StatCard
          icon={Clock}
          label="Reviews"
          value={`${data.totalReviews}`}
          sub={`in ${data.days} days`}
          color="text-grade-easy"
        />
        <StatCard
          icon={Target}
          label="Avg time"
          value={avgResponseSec > 0 ? `${avgResponseSec}s` : '—'}
          sub="per card"
          color="text-grade-hard"
        />
      </div>

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
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <Card className="border-hairline bg-card-surface p-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider text-muted-recall">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${color}`} aria-hidden="true" />
      </div>
      <p className="font-display text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-recall">{sub}</p>
    </Card>
  )
}
