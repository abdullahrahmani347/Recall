'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

interface DayBucket {
  date: string
  reviewed: number
}

interface HeatmapData {
  dailyBuckets: DayBucket[]
}

/**
 * ReviewHeatmap — GitHub-style contribution grid showing daily review
 * activity over the past N days.
 *
 * - 365-day grid on the analytics page (full)
 * - 30-day strip on the home screen (compact)
 *
 * Color intensity: 0 reviews = empty, 1-4 = light, 5-9 = medium,
 * 10-19 = dark, 20+ = darkest. Uses the accent-brand green scale.
 */
export function ReviewHeatmap({ days = 365, compact = false }: { days?: number; compact?: boolean }) {
  const { data, isLoading } = useQuery<HeatmapData>({
    queryKey: ['heatmap', days],
    queryFn: () => api<HeatmapData>(`/api/analytics?range=${days >= 365 ? '365d' : days >= 90 ? '90d' : '30d'}`),
  })

  if (isLoading) {
    return (
      <div className={`shimmer rounded-lg ${compact ? 'h-8' : 'h-24'}`} />
    )
  }

  const buckets = data?.dailyBuckets ?? []

  // Build a map of date → count for quick lookup
  const countMap = new Map<string, number>()
  for (const b of buckets) {
    countMap.set(b.date, b.reviewed)
  }

  // Generate the grid: most recent day is at the right
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const cells: { date: string; count: number }[] = []

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    cells.push({ date: key, count: countMap.get(key) ?? 0 })
  }

  // Color levels
  const getColor = (count: number) => {
    if (count === 0) return 'bg-card-surface'
    if (count < 5) return 'bg-accent-brand/30'
    if (count < 10) return 'bg-accent-brand/50'
    if (count < 20) return 'bg-accent-brand/70'
    return 'bg-accent-brand'
  }

  // For compact mode (30 days), render as a single row
  if (compact) {
    const total = cells.reduce((s, c) => s + c.count, 0)
    return (
      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
        {cells.map((cell) => (
          <div
            key={cell.date}
            className={`h-7 w-2.5 shrink-0 rounded-sm ${getColor(cell.count)}`}
            title={`${cell.date}: ${cell.count} review${cell.count === 1 ? '' : 's'}`}
          />
        ))}
      </div>
    )
  }

  // Full mode: 7 rows (days of week), N/7 columns
  const weeks: { date: string; count: number }[][] = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  const totalReviews = cells.reduce((s, c) => s + c.count, 0)
  const activeDays = cells.filter((c) => c.count > 0).length

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">
            Review activity
          </p>
          <p className="mt-1 text-sm text-secondary-recall">
            {totalReviews} reviews in {activeDays} active {activeDays === 1 ? 'day' : 'days'}
          </p>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-recall">
          <span>Less</span>
          <div className="h-2.5 w-2.5 rounded-sm bg-card-surface" />
          <div className="h-2.5 w-2.5 rounded-sm bg-accent-brand/30" />
          <div className="h-2.5 w-2.5 rounded-sm bg-accent-brand/50" />
          <div className="h-2.5 w-2.5 rounded-sm bg-accent-brand/70" />
          <div className="h-2.5 w-2.5 rounded-sm bg-accent-brand" />
          <span>More</span>
        </div>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <div className="flex gap-[3px]" style={{ minWidth: 'fit-content' }}>
          {weeks.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-[3px]">
              {week.map((cell) => (
                <div
                  key={cell.date}
                  className={`h-2.5 w-2.5 rounded-sm ${getColor(cell.count)} transition-smooth hover:ring-1 hover:ring-accent-brand`}
                  title={`${cell.date}: ${cell.count} review${cell.count === 1 ? '' : 's'}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
