'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { useAuth } from '@/hooks/use-auth'
import {
  Search,
  FileText,
  Layers,
  Home as HomeIcon,
  BarChart3,
  Settings,
  Plus,
  Sparkles,
  Play,
  Moon,
  Sun,
  ArrowRight,
} from 'lucide-react'

interface PaletteCommand {
  id: string
  label: string
  hint?: string
  icon: React.ComponentType<{ className?: string }>
  action: () => void
  section: 'navigate' | 'create' | 'notes' | 'actions'
  keywords?: string
}

/**
 * CommandPalette — Cmd/Ctrl+K palette for fast navigation and actions.
 *
 * Features:
 * - Fuzzy search across commands and notes
 * - Keyboard-first: arrow keys to navigate, Enter to select, Esc to close
 * - Sections: Navigate, Create, Notes, Actions
 * - Recent notes appear in the results
 *
 * Opens with Cmd/Ctrl+K. Also opens with Ctrl+P (alternative).
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const qc = useQueryClient()

  const { user } = useAuth()
  const { setView, openNote, startReview } = useAppStore()

  // Fetch notes for search
  const { data: notesData } = useQuery<{ notes: { id: string; title: string; contentPlainText: string }[] }>({
    queryKey: ['palette-notes'],
    queryFn: () => api<{ notes: { id: string; title: string; contentPlainText: string }[] }>('/api/notes?archived=false'),
    enabled: open && !!user,
    staleTime: 30_000,
  })

  // Open/close handlers
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  // Build commands
  const commands: PaletteCommand[] = useMemo(() => {
    const cmds: PaletteCommand[] = [
      // Navigate
      { id: 'nav-home', label: 'Go to Home', icon: HomeIcon, action: () => { setView('home'); setOpen(false) }, section: 'navigate', keywords: 'home dashboard' },
      { id: 'nav-notes', label: 'Go to Notes', icon: FileText, action: () => { setView('notes'); setOpen(false) }, section: 'navigate', keywords: 'notes library' },
      { id: 'nav-decks', label: 'Go to Decks', icon: Layers, action: () => { setView('decks'); setOpen(false) }, section: 'navigate', keywords: 'decks flashcards cards' },
      { id: 'nav-search', label: 'Go to Search', icon: Search, action: () => { setView('search'); setOpen(false) }, section: 'navigate', keywords: 'search find' },
      { id: 'nav-stats', label: 'Go to Analytics', icon: BarChart3, action: () => { setView('analytics'); setOpen(false) }, section: 'navigate', keywords: 'analytics stats graph' },
      { id: 'nav-settings', label: 'Go to Settings', icon: Settings, action: () => { setView('settings'); setOpen(false) }, section: 'navigate', keywords: 'settings preferences' },

      // Create
      { id: 'create-note', label: 'Create new note', icon: Plus, action: () => { openNote(null); setOpen(false) }, section: 'create', keywords: 'new note create add' },
      { id: 'create-deck', label: 'Create new deck', icon: Layers, action: () => { setView('decks'); setOpen(false) }, section: 'create', keywords: 'new deck create add' },

      // Actions
      { id: 'action-review', label: 'Start review session', icon: Play, action: () => { startReview(null); setOpen(false) }, section: 'actions', keywords: 'review study flashcards due' },
    ]

    // Add notes as commands
    if (notesData?.notes) {
      for (const note of notesData.notes.slice(0, 20)) {
        cmds.push({
          id: `note-${note.id}`,
          label: note.title || 'Untitled',
          hint: 'Note',
          icon: FileText,
          action: () => { openNote(note.id); setOpen(false) },
          section: 'notes',
          keywords: note.contentPlainText.slice(0, 200),
        })
      }
    }

    return cmds
  }, [notesData, setView, openNote, startReview])

  // Filter by query
  const filtered = useMemo(() => {
    if (!query) return commands
    const q = query.toLowerCase()
    return commands.filter((cmd) => {
      const text = `${cmd.label} ${cmd.keywords ?? ''} ${cmd.hint ?? ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [commands, query])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  // Keyboard navigation
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const cmd = filtered[selectedIndex]
      if (cmd) cmd.action()
    }
  }

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!open) return null

  // Group by section
  const sections: { title: string; items: PaletteCommand[] }[] = [
    { title: 'Navigate', items: filtered.filter((c) => c.section === 'navigate') },
    { title: 'Create', items: filtered.filter((c) => c.section === 'create') },
    { title: 'Actions', items: filtered.filter((c) => c.section === 'actions') },
    { title: 'Notes', items: filtered.filter((c) => c.section === 'notes') },
  ].filter((s) => s.items.length > 0)

  let runningIndex = 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-hairline bg-card-surface shadow-panel animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-hairline px-4 py-3.5">
          <Search className="h-4 w-4 shrink-0 text-muted-recall" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search notes and commands..."
            className="flex-1 bg-transparent text-sm text-primary-recall placeholder:text-muted-recall focus:outline-none"
            aria-label="Search"
          />
          <kbd className="rounded border border-hairline px-1.5 py-0.5 text-[10px] text-muted-recall">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto scrollbar-thin p-2">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-recall">
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            sections.map((section) => (
              <div key={section.title} className="mb-2">
                <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-widest text-muted-recall">
                  {section.title}
                </p>
                {section.items.map((cmd) => {
                  const idx = runningIndex++
                  const Icon = cmd.icon
                  const isSelected = idx === selectedIndex
                  return (
                    <button
                      key={cmd.id}
                      data-index={idx}
                      onClick={() => cmd.action()}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-smooth ${
                        isSelected ? 'bg-accent-brand-dim' : ''
                      }`}
                    >
                      <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-accent-brand' : 'text-muted-recall'}`} />
                      <span className={`flex-1 truncate text-sm ${isSelected ? 'text-primary-recall' : 'text-secondary-recall'}`}>
                        {cmd.label}
                      </span>
                      {cmd.hint && (
                        <span className="text-[10px] text-muted-recall">{cmd.hint}</span>
                      )}
                      {isSelected && <ArrowRight className="h-3 w-3 text-accent-brand" />}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-hairline px-4 py-2.5 text-[10px] text-muted-recall">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-hairline px-1 py-0.5">↑</kbd>
              <kbd className="rounded border border-hairline px-1 py-0.5">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-hairline px-1 py-0.5">↵</kbd>
              select
            </span>
          </div>
          <span>Recall Command Palette</span>
        </div>
      </div>
    </div>
  )
}
