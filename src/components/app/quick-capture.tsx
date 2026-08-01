'use client'

import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { X, Send } from 'lucide-react'
import { toast } from 'sonner'

/**
 * QuickCapture — floating action button that instantly opens a minimal
 * text field for capturing a thought without the overhead of the full
 * note editor (no title, no tags, no notebook).
 *
 * The captured text becomes an "inbox" note titled "Quick capture" with
 * the text as the body. The user can process it later (add title, tags,
 * summarize, turn into cards).
 *
 * Opens via the floating button (bottom-right, above the nav) or via
 * keyboard shortcut (Cmd/Ctrl+Shift+N).
 */
export function QuickCapture() {
  const qc = useQueryClient()
  const openNote = useAppStore((s) => s.openNote)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')

  // Keyboard shortcut: Cmd/Ctrl+Shift+N
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'n') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const createMutation = useMutation({
    mutationFn: (body: { title: string; contentMarkdown: string }) =>
      api<{ note: { id: string } }>('/api/notes', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Captured')
      setText('')
      setOpen(false)
      // Optionally open the note for editing
      // openNote(res.note.id)
    },
  })

  const onSave = async () => {
    if (!text.trim()) {
      setOpen(false)
      return
    }
    try {
      // Use first line as title if short enough, otherwise "Quick capture"
      const lines = text.trim().split('\n')
      const title = lines[0].length <= 80 && lines.length === 1
        ? lines[0]
        : 'Quick capture'
      const body = lines.length > 1
        ? text.trim()
        : text.trim()

      await createMutation.mutateAsync({ title, contentMarkdown: body })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to capture')
    }
  }

  return (
    <>
      {/* Floating action button — above the bottom nav */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-accent-brand text-void shadow-glow-brand press transition-smooth hover:bg-accent-brand/90 sm:bottom-24 sm:right-6"
          aria-label="Quick capture"
          title="Quick capture (Cmd+Shift+N)"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      )}

      {/* Quick capture modal */}
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-3xl border border-hairline bg-card-surface p-5 shadow-panel animate-fade-in-up sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Quick capture"
          >
            {/* Header */}
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">
                Quick capture
              </p>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-recall hover:text-primary-recall"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Text area — autofocus, minimal */}
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault()
                  onSave()
                }
                if (e.key === 'Escape') {
                  setOpen(false)
                }
              }}
              placeholder="What's on your mind?"
              className="min-h-[100px] w-full resize-none bg-transparent text-base text-primary-recall placeholder:text-muted-recall focus:outline-none"
              aria-label="Capture text"
            />

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between border-t border-hairline pt-3">
              <span className="text-[10px] text-muted-recall">
                Cmd+Enter to save · Esc to cancel
              </span>
              <button
                onClick={onSave}
                disabled={!text.trim() || createMutation.isPending}
                className="flex items-center gap-1.5 rounded-full bg-accent-brand px-4 py-2 text-sm font-medium text-void press transition-smooth hover:bg-accent-brand/90 disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" />
                Capture
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
