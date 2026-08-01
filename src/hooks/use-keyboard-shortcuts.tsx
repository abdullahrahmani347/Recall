'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useAppStore } from '@/stores/app-store'

const INPUT_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']

export function useKeyboardShortcuts() {
  // Use selectors to avoid re-rendering on every store change
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)
  const openNote = useAppStore((s) => s.openNote)
  const chordRef = useRef<string | null>(null)
  const chordTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showHelp, setShowHelp] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)

  const isInInput = useCallback(() => {
    try {
      const el = document.activeElement
      if (!el) return false
      if (INPUT_TAGS.includes(el.tagName)) return true
      if (el.getAttribute('contenteditable') === 'true') return true
      return false
    } catch {
      return false
    }
  }, [])

  const isModalOpen = useCallback(() => {
    try {
      return !!document.querySelector('[role="dialog"]')
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      try {
        if ((e.metaKey || e.ctrlKey) && e.key === '/') {
          e.preventDefault()
          setShowHelp(true)
          return
        }

        if (e.key === 'Escape' && showHelp) {
          setShowHelp(false)
          return
        }

        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'n') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('recall-new-note'))
          return
        }

        if ((e.metaKey || e.ctrlKey) && !e.shiftKey && e.key === 'd') {
          e.preventDefault()
          setView('decks')
          return
        }

        if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 's') {
          e.preventDefault()
          window.dispatchEvent(new CustomEvent('recall-summarize'))
          return
        }

        if (isInInput() || isModalOpen()) return

        if (e.key === 'g' && !e.metaKey && !e.ctrlKey && !e.shiftKey) {
          chordRef.current = 'g'
          if (chordTimer.current) clearTimeout(chordTimer.current)
          chordTimer.current = setTimeout(() => { chordRef.current = null }, 1000)
          return
        }

        if (chordRef.current === 'g') {
          chordRef.current = null
          if (chordTimer.current) clearTimeout(chordTimer.current)
          const key = e.key.toLowerCase()
          const viewMap: Record<string, string> = {
            h: 'home', n: 'notes', d: 'decks', s: 'search', a: 'analytics',
          }
          if (viewMap[key]) {
            e.preventDefault()
            setView(viewMap[key] as typeof view)
            return
          }
        }

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
          if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('recall-open-selected', { detail: { index: selectedIndex } }))
            return
          }
          if (e.key === 'd' || e.key === 'D') {
            e.preventDefault()
            window.dispatchEvent(new CustomEvent('recall-delete-selected', { detail: { index: selectedIndex } }))
            return
          }
        }
      } catch {
        // Silently ignore keyboard errors
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, setView, isInInput, isModalOpen, showHelp, selectedIndex])

  return { showHelp, setShowHelp, selectedIndex }
}

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
      title: 'Navigation',
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
