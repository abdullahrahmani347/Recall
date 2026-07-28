'use client'

import type { PresenceUser } from '@/lib/types'

/**
 * PresenceAvatars — shows stacked avatar bubbles for everyone currently
 * viewing the same note. Appears in the note editor header so you know
 * when someone else is looking at (or editing) the note with you.
 *
 * Pure presentational component — the parent passes the live presence
 * list from the useCollab hook.
 */
export function PresenceAvatars({
  presence,
  currentUserId,
  max = 5,
}: {
  presence: PresenceUser[]
  currentUserId: string
  max?: number
}) {
  // Exclude ourselves from the display — we know we're here.
  const others = presence.filter((p) => p.userId !== currentUserId)
  if (others.length === 0) return null

  const visible = others.slice(0, max)
  const overflow = others.length - visible.length

  return (
    <div
      className="flex items-center gap-1.5"
      role="group"
      aria-label={`${others.length} other ${others.length === 1 ? 'person' : 'people'} viewing`}
      title={`${others.length} other ${others.length === 1 ? 'person is' : 'people are'} viewing this note`}
    >
      <span className="mr-1 hidden items-center gap-1 text-xs text-muted-recall sm:flex">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-brand opacity-60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent-brand" />
        </span>
        Live
      </span>
      <div className="flex -space-x-2">
        {visible.map((user) => (
          <div
            key={user.userId}
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-canvas text-[10px] font-semibold text-void"
            style={{ backgroundColor: user.color }}
            title={`${user.name} is viewing`}
            aria-label={`${user.name} is viewing this note`}
          >
            {initials(user.name)}
          </div>
        ))}
        {overflow > 0 && (
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-canvas bg-card-surface text-[10px] font-semibold text-muted-recall"
            title={`${overflow} more`}
          >
            +{overflow}
          </div>
        )}
      </div>
    </div>
  )
}

function initials(name: string): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
