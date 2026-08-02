'use client'

import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ArrowLeft, Check, Highlighter, Trash2, ChevronRight, ChevronLeft, FileText } from 'lucide-react'
import { toast } from 'sonner'

interface ArticleSection {
  id: string
  order: number
  heading: string
  content: string
  isRead: boolean
  highlights: { id: string; text: string; note: string | null; cardType: string }[]
}

interface Article {
  id: string
  title: string
  sourceUrl: string | null
  sections: ArticleSection[]
}

/**
 * ArticleReader — the incremental reading view.
 *
 * Shows one section at a time. User can:
 * - Select text → creates a highlight → auto-creates a cloze card
 * - Mark section as read → advances to next section
 * - Navigate between sections with prev/next
 * - View all highlights for the current section
 */
export function ArticleReader({ articleId }: { articleId: string }) {
  const qc = useQueryClient()
  const setView = useAppStore((s) => s.setView)
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedText, setSelectedText] = useState('')
  const contentRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery<{ article: Article }>({
    queryKey: ['article', articleId],
    queryFn: () => api(`/api/articles/${articleId}`),
  })

  const markReadMutation = useMutation({
    mutationFn: (sectionId: string) =>
      api(`/api/articles/${articleId}/sections?sectionId=${sectionId}`, {
        method: 'PATCH',
        body: JSON.stringify({ isRead: true }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['article', articleId] }),
  })

  const highlightMutation = useMutation({
    mutationFn: (body: { sectionId: string; text: string; cardType: 'cloze' | 'basic' }) =>
      api(`/api/articles/${articleId}/highlights`, {
        method: 'POST',
        body: JSON.stringify({ ...body, createCard: true }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['article', articleId] })
      qc.invalidateQueries({ queryKey: ['decks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Highlight saved — card created')
      setSelectedText('')
    },
  })

  const deleteHighlightMutation = useMutation({
    mutationFn: (highlightId: string) =>
      api(`/api/highlights/${highlightId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['article', articleId] })
      qc.invalidateQueries({ queryKey: ['decks'] })
      toast.success('Highlight removed')
    },
  })

  if (isLoading || !data) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-recall">Loading article…</p>
      </div>
    )
  }

  const article = data.article
  const sections = article.sections
  const section = sections[currentIdx]
  const isLastSection = currentIdx === sections.length - 1
  const readCount = sections.filter((s) => s.isRead).length
  const totalHighlights = sections.reduce((sum, s) => sum + s.highlights.length, 0)

  const onMouseUp = () => {
    const selection = window.getSelection()
    const text = selection?.toString().trim()
    if (text && text.length > 5 && text.length < 2000) {
      setSelectedText(text)
    } else {
      setSelectedText('')
    }
  }

  const createHighlight = (cardType: 'cloze' | 'basic') => {
    if (!selectedText || !section) return
    highlightMutation.mutate({
      sectionId: section.id,
      text: selectedText,
      cardType,
    })
  }

  const next = () => {
    if (section && !section.isRead) {
      markReadMutation.mutate(section.id)
    }
    if (!isLastSection) {
      setCurrentIdx(currentIdx + 1)
      setSelectedText('')
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const prev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1)
      setSelectedText('')
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <button
            onClick={() => setView('articles')}
            className="inline-flex items-center gap-1 text-sm text-secondary-recall hover:text-primary-recall"
          >
            <ArrowLeft className="h-4 w-4" />
            Articles
          </button>
          <div className="flex items-center gap-3 text-xs text-muted-recall">
            <span>{readCount}/{sections.length} read</span>
            <span>·</span>
            <span>{totalHighlights} highlights</span>
          </div>
        </div>
        {/* Progress bar */}
        <div className="h-0.5 w-full bg-border-hairline">
          <div
            className="h-full bg-accent-brand transition-smooth"
            style={{ width: `${sections.length > 0 ? (readCount / sections.length) * 100 : 0}%` }}
          />
        </div>
      </header>

      {/* Content */}
      <main ref={contentRef} className="mx-auto w-full max-w-2xl flex-1 overflow-y-auto px-4 py-6 sm:px-6">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
          {article.title}
        </h1>
        {article.sourceUrl && (
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-accent-brand hover:underline"
          >
            Source ↗
          </a>
        )}

        {/* Section indicator */}
        <div className="mt-6 flex items-center gap-2">
          <span className="font-mono text-xs text-accent-brand">
            {String(currentIdx + 1).padStart(2, '0')}
          </span>
          <span className="h-px flex-1 bg-border-hairline" />
          {section?.isRead && (
            <span className="flex items-center gap-1 text-xs text-accent-brand">
              <Check className="h-3 w-3" />
              Read
            </span>
          )}
        </div>

        {/* Section content */}
        {section && (
          <div className="mt-4">
            <h2 className="mb-4 font-display text-xl font-semibold">{section.heading}</h2>
            <div
              onMouseUp={onMouseUp}
              className="prose-recall select-text text-base leading-relaxed text-secondary-recall"
            >
              {section.content.split('\n').map((para, i) => (
                <p key={i} className="mb-4">
                  {renderHighlightedText(para, section.highlights)}
                </p>
              ))}
            </div>

            {/* Selection action bar */}
            {selectedText && (
              <div className="sticky bottom-20 mt-4 flex items-center gap-2 rounded-xl border border-accent-brand/30 bg-card-surface p-3 shadow-panel">
                <Highlighter className="h-4 w-4 text-accent-brand" aria-hidden="true" />
                <span className="flex-1 truncate text-xs text-secondary-recall">
                  "{selectedText.slice(0, 60)}{selectedText.length > 60 ? '…' : ''}"
                </span>
                <Button
                  size="sm"
                  onClick={() => createHighlight('cloze')}
                  disabled={highlightMutation.isPending}
                  className="bg-accent-brand text-void hover:bg-accent-brand/90"
                >
                  Cloze
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => createHighlight('basic')}
                  disabled={highlightMutation.isPending}
                  className="border border-hairline"
                >
                  Q&A
                </Button>
              </div>
            )}

            {/* Existing highlights for this section */}
            {section.highlights.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-recall">
                  Highlights ({section.highlights.length})
                </p>
                <ul className="space-y-2">
                  {section.highlights.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-start justify-between gap-2 rounded-lg border border-hairline bg-card-surface p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-secondary-recall">"{h.text}"</p>
                        {h.note && <p className="mt-1 text-xs text-muted-recall">{h.note}</p>}
                        <span className="mt-1 inline-block rounded-full bg-accent-brand-dim px-1.5 py-0.5 text-[10px] font-medium text-accent-brand">
                          {h.cardType}
                        </span>
                      </div>
                      <button
                        onClick={() => deleteHighlightMutation.mutate(h.id)}
                        className="shrink-0 text-muted-recall hover:text-grade-again"
                        aria-label="Delete highlight"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Navigation */}
      <footer className="sticky bottom-0 border-t border-hairline bg-canvas/95 backdrop-blur" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Button
            variant="ghost"
            onClick={prev}
            disabled={currentIdx === 0}
            className="border border-hairline"
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="text-xs text-muted-recall">
            {currentIdx + 1} / {sections.length}
          </span>
          <Button
            onClick={next}
            className="bg-accent-brand text-void hover:bg-accent-brand/90"
          >
            {isLastSection ? 'Finish' : 'Next'}
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  )
}

/**
 * Renders a paragraph with highlighted text wrapped in a colored span.
 */
function renderHighlightedText(
  text: string,
  highlights: { text: string; note: string | null }[]
): React.ReactNode {
  if (highlights.length === 0) return text

  let result: React.ReactNode[] = [text]
  for (const h of highlights) {
    const newResult: React.ReactNode[] = []
    for (const part of result) {
      if (typeof part !== 'string') {
        newResult.push(part)
        continue
      }
      const idx = part.indexOf(h.text)
      if (idx === -1) {
        newResult.push(part)
        continue
      }
      newResult.push(part.slice(0, idx))
      newResult.push(
        <mark
          key={h.text + idx}
          className="rounded bg-accent-brand/20 px-0.5 text-primary-recall"
          title={h.note || undefined}
        >
          {h.text}
        </mark>
      )
      newResult.push(part.slice(idx + h.text.length))
    }
    result = newResult
  }
  return <>{result}</>
}
