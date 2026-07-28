'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Play,
  Layers,
} from 'lucide-react'
import type { ApiFlashcard, ApiDeck } from '@/lib/types'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

export function CardEditor() {
  const qc = useQueryClient()
  const { activeDeckId, setView, startReview } = useAppStore()

  const [front, setFront] = useState('')
  const [back, setBack] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const { data: deckData } = useQuery<{ deck: ApiDeck & { flashcards: ApiFlashcard[] } }>({
    queryKey: ['deck', activeDeckId],
    queryFn: () => api(`/api/decks/${activeDeckId}`),
    enabled: !!activeDeckId,
  })

  const deck = deckData?.deck
  const cards = deck?.flashcards ?? []

  const createCard = useMutation({
    mutationFn: (body: { front: string; back: string }) =>
      api<{ card: ApiFlashcard }>(`/api/decks/${activeDeckId}/cards`, {
        method: 'POST',
        body: JSON.stringify({ ...body, cardType: 'basic' }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deck', activeDeckId] }),
  })

  const updateCard = useMutation({
    mutationFn: ({ id, front, back }: { id: string; front: string; back: string }) =>
      api<{ card: ApiFlashcard }>(`/api/cards/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ front, back }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deck', activeDeckId] }),
  })

  const deleteCard = useMutation({
    mutationFn: (id: string) => api(`/api/cards/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deck', activeDeckId] }),
  })

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!front.trim() || !back.trim()) return
    try {
      if (editingId) {
        await updateCard.mutateAsync({ id: editingId, front: front.trim(), back: back.trim() })
        toast.success('Card updated')
      } else {
        await createCard.mutateAsync({ front: front.trim(), back: back.trim() })
        toast.success('Card added')
      }
      setFront('')
      setBack('')
      setEditingId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save card')
    }
  }

  const onEdit = (card: ApiFlashcard) => {
    setEditingId(card.id)
    setFront(card.front)
    setBack(card.back)
  }

  if (!activeDeckId) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 text-center">
        <p className="text-sm text-muted-recall">No deck selected.</p>
        <Button onClick={() => setView('decks')} className="mt-4">
          Back to decks
        </Button>
      </div>
    )
  }

  const dueCount = cards.filter(
    (c) => !c.schedulingState || new Date(c.schedulingState.dueDate) <= new Date()
  ).length

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6">
      <header className="mb-6">
        <button
          onClick={() => setView('decks')}
          className="mb-3 inline-flex items-center gap-1 text-sm text-secondary-recall transition hover:text-primary-recall"
        >
          <ArrowLeft className="h-4 w-4" />
          Decks
        </button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-recall">Deck</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              {deck?.name ?? 'Loading…'}
            </h1>
            {deck?.description && (
              <p className="mt-1 text-sm text-secondary-recall">{deck.description}</p>
            )}
          </div>
          <Button
            disabled={dueCount === 0}
            onClick={() => startReview(activeDeckId)}
            className="bg-accent-brand text-void hover:bg-accent-brand/90"
          >
            <Play className="mr-1 h-4 w-4" />
            Review ({dueCount})
          </Button>
        </div>
      </header>

      {/* ADD / EDIT CARD FORM */}
      <Card className="mb-6 border-hairline bg-card-surface p-4">
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="front">Front (question)</Label>
            <Textarea
              id="front"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="What goes on the front of the card?"
              className="min-h-[80px] bg-void"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="back">Back (answer)</Label>
            <Textarea
              id="back"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="What goes on the back?"
              className="min-h-[80px] bg-void"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="submit"
              disabled={!front.trim() || !back.trim() || createCard.isPending || updateCard.isPending}
              className="bg-accent-brand text-void hover:bg-accent-brand/90"
            >
              <Plus className="mr-1 h-4 w-4" />
              {editingId ? 'Save changes' : 'Add card'}
            </Button>
            {editingId && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setEditingId(null)
                  setFront('')
                  setBack('')
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* CARDS LIST */}
      {cards.length === 0 ? (
        <Card className="border border-dashed border-hairline bg-card-surface/50 p-8 text-center">
          <Layers className="mx-auto mb-3 h-8 w-8 text-muted-recall" aria-hidden="true" />
          <p className="font-medium">No cards in this deck yet</p>
          <p className="mt-1 text-sm text-secondary-recall">
            Add your first card using the form above.
          </p>
        </Card>
      ) : (
        <ul className="space-y-2">
          {cards.map((card) => (
            <li key={card.id}>
              <Card className="border-hairline bg-card-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => onEdit(card)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="text-sm font-medium">{card.front}</p>
                    <p className="mt-1 text-xs text-muted-recall line-clamp-2">
                      {card.back}
                    </p>
                    <p className="mt-2 text-[10px] text-muted-recall">
                      {card.schedulingState
                        ? `Due ${formatDistanceToNow(new Date(card.schedulingState.dueDate), { addSuffix: true })}`
                        : 'New · not reviewed'}
                      {' · '}
                      {card.schedulingState?.repetitions ?? 0} reps
                    </p>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm('Delete this card?')) return
                      await deleteCard.mutateAsync(card.id)
                      toast.success('Card deleted')
                    }}
                    className="h-8 w-8 shrink-0 p-0 text-muted-recall hover:text-grade-again"
                    aria-label="Delete card"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
