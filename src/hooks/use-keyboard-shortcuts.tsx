'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'

/**
 * useKeyboardShortcuts — global keyboard handler for the app shell.
 *
 * Supports:
 * - Cmd/Ctrl+N → new note
 * - Cmd/Ctrl+D → new deck (goes to decks view)
 * - Cmd/Ctrl+/ → show shortcuts help
 * - Cmd/Ctrl+Shift+S → summarize current note (if in editor)
 * - J/K → navigate note list (if on notes view)
 * - Enter → open selected note
 * - E → edit selected note
 * - D → delete selected note (with confirmation)
 * - G then H → go to home (vim-style two-key chord)
 * - G then N → go to notes
 * - G then D → go to decks
 * - G then S → go to search
 * - G then A → go to analytics
 *
 * All shortcuts are ignored when:
 * - The user is typing in an input/textarea/contenteditable
 * - A modal/dialog is open (detected via [role="dialog"])
 * - The command palette is open
 */

const INPUT_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']

export function useKeyboardShortcuts() {
  const { view, setView, openNote } = useAppStore()
  const chordRef = useRef<string | null>(null)
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const isInInput = useCallback(() => {
    const el = document.activeElement
    if (!el) return false
    if (INPUT_TAGS.includes(el.tagName)) return true
    if (el.getAttribute('contenteditable') === 'true') return true
    return false
  }, [])

  const isModalOpen = useCallback(() => {
    return !!document.querySelector('[role="dialog"]')
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Cmd/Ctrl+/ → show shortcuts help
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault()
        setShowHelp(true)
        return
      }

      // Escape closes help
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false)
        return
      }

      // Cmd/Ctrl+N → new note (show template picker)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('recall-new-note'))
        return
      }

      // Cmd/Ctrl+D → go to decks (can't create deck directly, go to view)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'd') {
        e.preventDefault()
        setView('decks')
        return
      }

      // Cmd/Ctrl+Shift+S → summarize (dispatch custom event the editor listens for)
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('recall-summarize'))
        return
      }

      // Don't process further shortcuts if in an input or modal is open
      if (isInInput() || isModalOpen()) return

      // Two-key chord: G then [H/N/D/S/A]
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
        chordRef.current = 'g'
        if (chordTimer.current) clearTimeout(chordTimer.current)
        chordTimer.current = setTimeout(() => {
          chordRef.current = null
        }, 1000)
        return
      }

      if (chordRef.current === 'g') {
        chordRef.current = null
        if (chordTimer.current) clearTimeout(chordTimer.current)
        const key = e.key.toLowerCase()
        const viewMap: Record<string, string> = {
          h: 'home',
          n: 'notes',
          d: 'decks',
          s: 'search',
          a: 'analytics',
        }
        if (viewMap[key]) {
          e.preventDefault()
          setView(viewMap[key] as typeof view)
          return
        }
      }

      // J/K navigation (only on notes view)
      if (view === 'notes') {
        if (e.key === 'j' || e.key === 'ArrowDown') {
          e.preventDefault()
          setSelectedIndex((i) => Math.min(i + 1, 50))
          return
        }
        if (e.key === 'k' || e.key === 'ArrowUp') {
          e.preventDefault()
          setSelectedIndex((i) => Math.max(i - 1, 0))
          return
        }
        // Enter → open selected note (dispatch event the notes view listens for)
        if (e.key === 'Enter') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('recall-open-selected', { detail: { index: selectedIndex } }))
          return
        }
        // E → edit selected note
        if (e.key === 'e' || e.key === 'E') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('recall-open-selected', { detail: { index: selectedIndex } }))
          return
        }
        // D → delete selected note
        if (e.key === 'd' || e.key === 'D') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('recall-delete-selected', { detail: { index: selectedIndex } }))
          return
        }
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, setView, openNote, isInInput, isModalOpen, showHelp, selectedIndex])

  return { showHelp, setShowHelp, selectedIndex }
}

/**
 * ShortcutsHelpModal — shows all available keyboard shortcuts.
 */
export function ShortcutsHelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null

  const sections = [
    {
      title: 'Global',
      shortcuts: [
        { keys: ['Cmd', 'N'], label: 'New note' },
        { keys: ['Cmd', 'D'], label: 'Go to decks' },
        { keys: ['Cmd', '/'], label: 'Show this help' },
        { keys: ['Cmd', 'K'], label: 'Command palette' },
        { keys: ['Cmd', 'Shift', 'N'], label: 'Quick capture' },
        { keys: ['Cmd', 'Shift', 'S'], label: 'Summarize note' },
      ],
    },
    {
      title: 'Navigation (vim-style)',
      shortcuts: [
        { keys: ['G', 'H'], label: 'Go to Home' },
        { keys: ['G', 'N'], label: 'Go to Notes' },
        { keys: ['G', 'D'], label: 'Go to Decks' },
        { keys: ['G', 'S'], label: 'Go to Search' },
        { keys: ['G', 'A'], label: 'Go to Analytics' },
      ],
    },
    {
      title: 'Notes list',
      shortcuts: [
        { keys: ['J'], label: 'Next note' },
        { keys: ['K'], label: 'Previous note' },
        { keys: ['Enter'], label: 'Open note' },
        { keys: ['E'], label: 'Edit note' },
        { keys: ['D'], label: 'Delete note' },
      ],
    },
    {
      title: 'Review session',
      shortcuts: [
        { keys: ['Space'], label: 'Reveal answer' },
        { keys: ['1'], label: 'Again' },
        { keys: ['2'], label: 'Hard' },
        { keys: ['3'], label: 'Good' },
        { keys: ['4'], label: 'Easy' },
      ],
    },
    {
      title: 'Editor',
      shortcuts: [
        { keys: ['Cmd', 'Shift', 'C'], label: 'Cloze deletion' },
        { keys: ['Cmd', 'Z'], label: 'Undo' },
      ],
    },
  ]

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-2xl overflow-y-auto scrollbar-thin rounded-2xl border border-hairline bg-card-surface p-6 shadow-panel animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-recall hover:text-primary-recall"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          {sections.map((section) => (
            <div key={section.title}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-recall">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.shortcuts.map((sc) => (
                  <li key={sc.label} className="flex items-center justify-between gap-4">
                    <span className="text-sm text-secondary-recall">{sc.label}</span>
                    <div className="flex items-center gap-1">
                      {sc.keys.map((key, i) => (
                        <kbd
                          key={i}
                          className="rounded border border-hairline bg-void px-1.5 py-0.5 text-[10px] font-medium text-primary-recall"
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-muted-recall">
          Press <kbd className="rounded border border-hairline bg-void px-1 py-0.5">Esc</kbd> to close
        </p>
      </div>
    </div>
  )
}
