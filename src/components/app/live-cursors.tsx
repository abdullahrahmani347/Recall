'use client'

import type { PresenceUser } from '@/lib/types'

/**
 * LiveCursors — renders colored cursor labels for each collaborator
 * currently editing the note. Since we can't overlay DOM inside a
 * <textarea>, we show a floating bar above the editor with each
 * collaborator's current cursor position (line:col) and name.
 *
 * When a collaborator's cursor goes idle (no update in 10s), their
 * label fades. This is a pragmatic Phase 3 approach — a full rich-text
 * editor with inline cursors would require migrating off the textarea
 * to a contenteditable or ProseMirror-based editor (deferred).
 */
export function LiveCursors({
  cursors,
  currentUserId,
}: {
  cursors: Record<string, PresenceUser & { cursor: { line: number; col: number } }>
  currentUserId: string
}) {
  const active = Object.values(cursors).filter((c) => c.userId !== currentUserId)
  if (active.length === 0) return null

  return (
    <div
      className="flex flex-wrap items-center gap-2"
      role="status"
      aria-live="polite"
      aria-label="Collaborator cursor positions"
    >
      {active.map((c) => (
        <div
          key={c.userId}
          className="flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium"
          style={{
            borderColor: c.color,
            backgroundColor: `${c.color}15`,
            color: c.color,
          }}
          title={`${c.name} at line ${c.cursor.line + 1}, column ${c.cursor.col + 1}`}
        >
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: c.color }}
            aria-hidden="true"
          />
          <span className="max-w-[80px] truncate">{c.name}</span>
          <span className="opacity-70 tabular-nums">
            {c.cursor.line + 1}:{c.cursor.col + 1}
          </span>
        </div>
      ))}
    </div>
  )
}
