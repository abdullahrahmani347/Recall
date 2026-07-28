'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Bell, X, Play } from 'lucide-react'
import { useState } from 'react'

interface ReminderState {
  enabled: boolean
  reminderTime: string | null
  dueCount: number
  shouldRemind: boolean
  currentHHMM: string
}

/**
 * ReminderBanner — shows a dismissible banner when the user has due cards
 * AND their reminder time window is active. Polls /api/reminders every 5 min.
 *
 * The banner respects a per-session dismissal — once closed, it won't
 * reappear until the next day or the next due-count change.
 *
 * Dismissal is read from sessionStorage lazily in the initializer (avoiding
 * setState-in-effect), so a stale dismissal from a previous day won't
 * prevent the banner from re-showing.
 */
export function ReminderBanner() {
  const { startReview } = useAppStore()

  // Initialize dismissed state from sessionStorage — if the stored
  // dismissal is from a previous day, treat as not dismissed.
  const today = new Date().toISOString().slice(0, 10)
  const [state, setState] = useState(() => {
    const storedDay = sessionStorage.getItem('reminder-dismissed-day')
    const storedKey = sessionStorage.getItem('reminder-dismissed-key')
    return {
      dismissed: storedDay === today,
      dismissedKey: storedKey ?? '',
    }
  })

  const { data } = useQuery<ReminderState>({
    queryKey: ['reminder'],
    queryFn: () => api<ReminderState>('/api/reminders'),
    refetchInterval: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  })

  const onDismiss = () => {
    const currentKey = `${today}-${data?.dueCount ?? 0}`
    sessionStorage.setItem('reminder-dismissed-day', today)
    sessionStorage.setItem('reminder-dismissed-key', currentKey)
    setState({ dismissed: true, dismissedKey: currentKey })
  }

  const currentKey = `${today}-${data?.dueCount ?? 0}`
  const wasDismissedToday = state.dismissed && state.dismissedKey === currentKey

  if (!data?.enabled || !data.shouldRemind || data.dueCount === 0 || wasDismissedToday) {
    return null
  }

  return (
    <div
      className="border-b border-accent-warm/30 bg-accent-warm/10 px-4 py-2.5"
      role="region"
      aria-label="Study reminder"
    >
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4 shrink-0 text-accent-warm" aria-hidden="true" />
          <span>
            <span className="font-medium text-accent-warm">
              {data.dueCount} card{data.dueCount === 1 ? '' : 's'} due
            </span>
            <span className="text-secondary-recall"> · time to review</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => startReview(null)}
            className="inline-flex items-center gap-1 rounded-md bg-accent-warm px-3 py-1 text-xs font-medium text-void transition hover:bg-accent-warm/90"
          >
            <Play className="h-3 w-3" />
            Review now
          </button>
          <button
            onClick={onDismiss}
            className="rounded-md p-1 text-muted-recall transition hover:text-primary-recall"
            aria-label="Dismiss reminder"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
