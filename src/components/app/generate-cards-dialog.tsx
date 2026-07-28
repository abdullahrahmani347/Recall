'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  X,
  Sparkles,
  Loader2,
  Check,
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import type { SuggestedCard, ApiDeck } from '@/lib/types'
import { toast } from 'sonner'

interface GenerateCardsDialogProps {
  noteId: string
  onClose: () => void
  onCreated?: () => void
}

export function GenerateCardsDialog({ noteId, onClose, onCreated }: GenerateCardsDialogProps) {
  const qc = useQueryClient()
  const [suggestions, setSuggestions] = useState<SuggestedCard[]>([])
  const [accepted, setAccepted] = useState<Set<number>>(new Set())
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null)
  const [showDeckPicker, setShowDeckPicker] = useState(false)

  const { data: decksData } = useQuery<{ decks: ApiDeck[] }>({
    queryKey: ['decks'],
    queryFn: () => api<{ decks: ApiDeck[] }>('/api/decks'),
  })
  const decks = decksData?.decks ?? []

  const generateMutation = useMutation({
    mutationFn: ({ count, deckId }: { count: number; deckId?: string }) =>
      api<{ suggestions: SuggestedCard[]; deckId?: string }>(
        `/api/notes/${noteId}/generate-cards`,
        {
          method: 'POST',
          body: JSON.stringify({ count, deckId }),
        }
      ),
    onSuccess: (res) => {
      setSuggestions(res.suggestions)
      setAccepted(new Set(res.suggestions.map((_, i) => i)))
      if (res.deckId) setSelectedDeckId(res.deckId)
    },
  })

  const bulkCreateMutation = useMutation({
    mutationFn: ({ deckId, cards }: { deckId: string; cards: SuggestedCard[] }) =>
      api<{ created: number }>('/api/cards/bulk', {
        method: 'POST',
        body: JSON.stringify({
          deckId,
          cards: cards.map((c) => ({ ...c, sourceNoteId: noteId })),
        }),
      }),
    onSuccess: (res) => {
      toast.success(`${res.created} card${res.created === 1 ? '' : 's'} added`)
      qc.invalidateQueries({ queryKey: ['decks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      onCreated?.()
      onClose()
    },
  })

  const onGenerate = () => {
    if (!selectedDeckId && decks.length > 0) {
      setSelectedDeckId(decks[0].id)
    }
    generateMutation.mutate({ count: 8, deckId: selectedDeckId ?? undefined })
  }

  const onCreate = async () => {
    const selectedDeck = selectedDeckId ?? decks[0]?.id
    if (!selectedDeck) {
      toast.error('Create a deck first')
      return
    }
    const cardsToCreate = suggestions.filter((_, i) => accepted.has(i))
    if (cardsToCreate.length === 0) {
      toast.error('Select at least one card')
      return
    }
    await bulkCreateMutation.mutateAsync({
      deckId: selectedDeck,
      cards: cardsToCreate,
    })
  }

  const toggleAccept = (i: number) => {
    setAccepted((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const selectedDeck = decks.find((d) => d.id === selectedDeckId)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-3xl border border-hairline bg-card-surface sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Generate flashcards from note"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-hairline p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-brand/15 text-accent-brand">
              <Sparkles className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">Generate flashcards</h3>
              <p className="text-xs text-muted-recall">
                AI suggests cards from this note — review and accept.
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* BODY */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
          {suggestions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {generateMutation.isPending ? (
                <>
                  <Loader2 className="mb-3 h-8 w-8 animate-spin text-accent-brand" aria-hidden="true" />
                  <p className="font-medium">Generating flashcard suggestions…</p>
                  <p className="mt-1 text-sm text-secondary-recall">
                    The model is reading your note and drafting 8 cards.
                  </p>
                </>
              ) : generateMutation.isError ? (
                <>
                  <p className="font-medium text-grade-again">Generation failed</p>
                  <p className="mt-1 text-sm text-secondary-recall">
                    {generateMutation.error instanceof Error
                      ? generateMutation.error.message
                      : 'Please try again.'}
                  </p>
                  <Button onClick={onGenerate} variant="ghost" className="mt-4 border border-hairline">
                    Retry
                  </Button>
                </>
              ) : (
                <>
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-brand/10 text-accent-brand">
                    <Sparkles className="h-7 w-7" aria-hidden="true" />
                  </div>
                  <p className="font-medium">Generate flashcards from this note</p>
                  <p className="mt-1 max-w-sm text-sm text-secondary-recall">
                    We&apos;ll use the AI to draft flashcard questions and answers from
                    your note content. You review and accept the ones you want.
                  </p>
                  <Button
                    onClick={onGenerate}
                    className="mt-6 bg-accent-brand text-void hover:bg-accent-brand/90"
                  >
                    <Sparkles className="mr-1 h-4 w-4" />
                    Generate 8 suggestions
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* DECK PICKER */}
              <div className="mb-4">
                <button
                  onClick={() => setShowDeckPicker((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl border border-hairline bg-void p-3 text-left text-sm transition hover:border-accent-brand/50"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: selectedDeck?.color ?? '#34E7A8' }}
                      aria-hidden="true"
                    />
                    <span className="font-medium">
                      {selectedDeck?.name ?? 'Choose a deck…'}
                    </span>
                  </div>
                  {showDeckPicker ? (
                    <ChevronDown className="h-4 w-4 text-muted-recall" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-recall" />
                  )}
                </button>
                {showDeckPicker && (
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto scrollbar-thin rounded-xl border border-hairline bg-void p-2">
                    {decks.length === 0 ? (
                      <li className="p-3 text-sm text-muted-recall">
                        No decks yet. Create one in the Decks tab first.
                      </li>
                    ) : (
                      decks.map((d) => (
                        <li key={d.id}>
                          <button
                            onClick={() => {
                              setSelectedDeckId(d.id)
                              setShowDeckPicker(false)
                            }}
                            className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm transition hover:bg-card-surface"
                          >
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: d.color }}
                              aria-hidden="true"
                            />
                            {d.name}
                          </button>
                        </li>
                      ))
                    )}
                  </ul>
                )}
              </div>

              {/* SUGGESTIONS LIST */}
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium">
                  {accepted.size} of {suggestions.length} selected
                </p>
                <button
                  onClick={() => {
                    if (accepted.size === suggestions.length) {
                      setAccepted(new Set())
                    } else {
                      setAccepted(new Set(suggestions.map((_, i) => i)))
                    }
                  }}
                  className="text-xs text-accent-brand hover:underline"
                >
                  {accepted.size === suggestions.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              <ul className="space-y-2">
                {suggestions.map((card, i) => {
                  const isAccepted = accepted.has(i)
                  return (
                    <li key={i}>
                      <button
                        onClick={() => toggleAccept(i)}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          isAccepted
                            ? 'border-accent-brand/50 bg-accent-brand/5'
                            : 'border-hairline bg-void opacity-60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                              isAccepted
                                ? 'border-accent-brand bg-accent-brand text-void'
                                : 'border-hairline'
                            }`}
                            aria-hidden="true"
                          >
                            {isAccepted && <Check className="h-3 w-3" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs uppercase tracking-wider text-muted-recall">
                              Front
                            </p>
                            <p className="mt-1 text-sm font-medium">{card.front}</p>
                            <p className="mt-3 text-xs uppercase tracking-wider text-muted-recall">
                              Back
                            </p>
                            <p className="mt-1 text-sm text-secondary-recall">{card.back}</p>
                          </div>
                        </div>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </>
          )}
        </div>

        {/* FOOTER */}
        {suggestions.length > 0 && (
          <div className="border-t border-hairline p-4">
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={() => setSuggestions([])} className="border border-hairline">
                Back
              </Button>
              <Button
                onClick={onCreate}
                disabled={
                  bulkCreateMutation.isPending ||
                  accepted.size === 0 ||
                  (!selectedDeckId && decks.length === 0)
                }
                className="bg-accent-brand text-void hover:bg-accent-brand/90"
              >
                {bulkCreateMutation.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-1 h-4 w-4" />
                )}
                Add {accepted.size} card{accepted.size === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
