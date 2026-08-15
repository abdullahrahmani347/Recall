'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Trophy, Flame, Target, Zap, BookOpen, Brain, Star, Award, TrendingUp, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Stats {
  noteCount: number
  deckCount: number
  cardCount: number
  dueCount: number
  todayReviews: number
  streak: number
  streakFreezes?: number
}

interface Achievement {
  id: string
  label: string
  description: string
  icon: typeof Trophy
  unlocked: boolean
  progress?: number // 0-100
}

/**
 * Achievements — shows milestone badges and a daily goal progress bar.
 *
 * Achievements:
 * - First Steps: Created your first note
 * - Note Taker: 10 notes
 * - Scholar: 50 notes
 * - Card Creator: Created your first deck
 * - Collector: 100 flashcards
 * - Streak Starter: 3-day streak
 * - On Fire: 7-day streak
 * - Unstoppable: 30-day streak
 * - Daily Goal: Reviewed today's goal
 * - Knowledge Seeker: Reviewed 500 cards total
 */
export function Achievements() {
  const { data: stats } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => api<Stats>('/api/stats'),
  })

  const { data: analytics } = useQuery<{ totalReviews: number }>({
    queryKey: ['analytics', '30d'],
    queryFn: () => api<{ totalReviews: number }>('/api/analytics?range=30d'),
  })

  const noteCount = stats?.noteCount ?? 0
  const cardCount = stats?.cardCount ?? 0
  const streak = stats?.streak ?? 0
  const todayReviews = stats?.todayReviews ?? 0
  const totalReviews = analytics?.totalReviews ?? 0
  const dailyReviewLimit = 50 // default

  const achievements: Achievement[] = [
    { id: 'first-note', label: 'First Steps', description: 'Created your first note', icon: BookOpen, unlocked: noteCount >= 1, progress: Math.min(100, noteCount * 100) },
    { id: 'ten-notes', label: 'Note Taker', description: 'Created 10 notes', icon: Star, unlocked: noteCount >= 10, progress: Math.min(100, (noteCount / 10) * 100) },
    { id: 'fifty-notes', label: 'Scholar', description: 'Created 50 notes', icon: Award, unlocked: noteCount >= 50, progress: Math.min(100, (noteCount / 50) * 100) },
    { id: 'first-deck', label: 'Card Creator', description: 'Created your first deck', icon: Brain, unlocked: (stats?.deckCount ?? 0) >= 1, progress: Math.min(100, (stats?.deckCount ?? 0) * 100) },
    { id: 'hundred-cards', label: 'Collector', description: 'Created 100 flashcards', icon: Zap, unlocked: cardCount >= 100, progress: Math.min(100, (cardCount / 100) * 100) },
    { id: 'streak-3', label: 'Streak Starter', description: '3-day streak', icon: Flame, unlocked: streak >= 3, progress: Math.min(100, (streak / 3) * 100) },
    { id: 'streak-7', label: 'On Fire', description: '7-day streak', icon: Flame, unlocked: streak >= 7, progress: Math.min(100, (streak / 7) * 100) },
    { id: 'streak-30', label: 'Unstoppable', description: '30-day streak', icon: Trophy, unlocked: streak >= 30, progress: Math.min(100, (streak / 30) * 100) },
    { id: 'daily-goal', label: 'Daily Goal', description: `Reviewed ${dailyReviewLimit} cards today`, icon: Target, unlocked: todayReviews >= dailyReviewLimit, progress: Math.min(100, (todayReviews / dailyReviewLimit) * 100) },
    { id: '500-reviews', label: 'Knowledge Seeker', description: 'Reviewed 500 cards total', icon: TrendingUp, unlocked: totalReviews >= 500, progress: Math.min(100, (totalReviews / 500) * 100) },
  ]

  const unlockedCount = achievements.filter(a => a.unlocked).length
  const dailyProgress = Math.min(100, (todayReviews / dailyReviewLimit) * 100)

  return (
    <div className="space-y-4">
      {/* Daily goal progress bar */}
      <div className="rounded-xl border border-hairline bg-card-surface p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-accent-brand" />
            <span className="text-sm font-medium text-primary-recall">Daily Goal</span>
          </div>
          <span className="text-xs text-muted-recall tabular-nums">
            {todayReviews} / {dailyReviewLimit}
          </span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-void">
          <div
            className="h-full rounded-full bg-accent-brand transition-all duration-500"
            style={{ width: `${dailyProgress}%` }}
          />
        </div>
        {dailyProgress >= 100 && (
          <p className="mt-2 flex items-center gap-1 text-xs text-accent-brand">
            <CheckCircle className="h-3.5 w-3.5" />
            Daily goal achieved!
          </p>
        )}
      </div>

      {/* Streak display */}
      <div className="rounded-xl border border-hairline bg-card-surface p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-accent-warm" />
            <div>
              <p className="text-sm font-medium text-primary-recall">{streak} day streak</p>
              <p className="text-xs text-muted-recall">{unlockedCount} / {achievements.length} achievements</p>
            </div>
          </div>
          {(stats?.streakFreezes ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-xs text-accent-brand">
              <span className="flex items-center gap-0.5 rounded-full bg-accent-brand-dim px-2 py-0.5">
                {stats?.streakFreezes} freeze{(stats?.streakFreezes ?? 0) === 1 ? '' : 's'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Achievement badges grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {achievements.map((a) => {
          const Icon = a.icon
          return (
            <div
              key={a.id}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition',
                a.unlocked
                  ? 'border-accent-brand/30 bg-accent-brand-dim'
                  : 'border-hairline bg-void opacity-60'
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full',
                  a.unlocked ? 'bg-accent-brand text-void' : 'bg-card-surface text-muted-recall'
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className={cn('text-xs font-medium', a.unlocked ? 'text-accent-brand' : 'text-muted-recall')}>
                  {a.label}
                </p>
                <p className="text-[10px] text-muted-recall mt-0.5">{a.description}</p>
              </div>
              {!a.unlocked && a.progress !== undefined && a.progress > 0 && (
                <div className="h-1 w-full overflow-hidden rounded-full bg-card-surface">
                  <div
                    className="h-full rounded-full bg-accent-brand/50"
                    style={{ width: `${a.progress}%` }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
