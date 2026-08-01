'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Plus,
  Trash2,
  ChevronRight,
  Play,
  GripVertical,
  X,
} from 'lucide-react'
import { LayersIcon } from '@/components/icons/recall-icons'
import type { ApiDeck } from '@/lib/types'
import { toast } from 'sonner'

type Deck = ApiDeck & { cardCount: number; dueCount: number }

export function DecksView() {
  const qc = useQueryClient()
  const openDeck = useAppStore((s) => s.openDeck)
  const startReview = useAppStore((s) => s.startReview)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newColor, setNewColor] = useState('#34E7A8')

  const { data, isLoading } = useQuery<{ decks: Deck[] }>({
    queryKey: ['decks'],
    queryFn: () => api<{ decks: Deck[] }>('/api/decks'),
  })

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description?: string; color?: string }) =>
      api<{ deck: ApiDeck }>('/api/decks', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/decks/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['decks'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })

  const onCreate = async () => {
    if (!newName.trim()) return
    try {
      await createMutation.mutateAsync({
        name: newName.trim(),
        description: newDesc.trim(),
        color: newColor,
      })
      setNewName('')
      setNewDesc('')
      setShowCreate(false)
      toast.success('Deck created')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create deck')
    }
  }

  const decks = data?.decks ?? []
  const [localDecks, setLocalDecks] = useState<Deck[]>([])

  if (data && data.decks !== localDecks) {
    setLocalDecks(data.decks)
  }

  const reorderMutation = useMutation({
    mutationFn: (deckIds: string[]) =>
      api('/api/decks/reorder', {
        method: 'POST',
        body: JSON.stringify({ deckIds }),
      }),
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setLocalDecks((prev) => {
      const oldIndex = prev.findIndex((d) => d.id === active.id)
      const newIndex = prev.findIndex((d) => d.id === over.id)
      const next = arrayMove(prev, oldIndex, newIndex)
      reorderMutation.mutate(next.map((d) => d.id))
      return next
    })
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
      <header className="mb-6 flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">
            Flashcards
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Decks
          </h1>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New deck
        </Button>
      </header>

      {/* Summary stats */}
      {localDecks.length > 0 && (
        <div className="mb-6 grid grid-cols-3 gap-3 animate-fade-in-up stagger-1">
          <Card className="border-hairline bg-card-surface p-3 text-center">
            <p className="font-display text-xl font-semibold tabular-nums">{localDecks.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-muted-recall">Decks</p>
          </Card>
          <Card className="border-hairline bg-card-surface p-3 text-center">
            <p className="font-display text-xl font-semibold tabular-nums text-accent-brand">
              {localDecks.reduce((s, d) => s + d.cardCount, 0)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-recall">Cards</p>
          </Card>
          <Card className="border-hairline bg-card-surface p-3 text-center">
            <p className="font-display text-xl font-semibold tabular-nums text-accent-warm">
              {localDecks.reduce((s, d) => s + d.dueCount, 0)}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-muted-recall">Due</p>
          </Card>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-hairline bg-card-surface p-4">
              <div className="flex items-center gap-3">
                <div className="h-9 w-1.5 shimmer rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/4 shimmer rounded" />
                  <div className="h-3 w-1/6 shimmer rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : localDecks.length === 0 ? (
        <Card className="border border-dashed border-hairline bg-card-surface/50 p-10 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-brand-dim text-accent-brand">
            <LayersIcon size={28} aria-hidden="true" />
          </div>
          <p className="font-medium">No decks yet</p>
          <p className="mt-1.5 text-sm text-secondary-recall">
            Create a deck, then add flashcards to start reviewing.
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            className="mt-5 bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Create deck
          </Button>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={localDecks.map((d) => d.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2">
              {localDecks.map((deck, i) => (
                <SortableDeckItem
                  key={deck.id}
                  deck={deck}
                  index={i}
                  onOpen={() => openDeck(deck.id)}
                  onReview={() => startReview(deck.id)}
                  onDelete={async () => {
                    if (!confirm(`Delete "${deck.name}"? All cards in it will be lost.`)) return
                    await deleteMutation.mutateAsync(deck.id)
                    toast.success('Deck deleted')
                  }}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* CREATE SHEET */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-hairline bg-card-surface p-6 animate-slide-in-right sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Create deck"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">New deck</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreate(false)}
                className="h-8 w-8 p-0 press"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="deck-name" className="text-sm">Name</Label>
                <Input
                  id="deck-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Spanish vocabulary"
                  className="bg-void"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deck-desc" className="text-sm">Description (optional)</Label>
                <Input
                  id="deck-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="What's this deck for?"
                  className="bg-void"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deck-color" className="text-sm">Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="deck-color"
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="h-10 w-16 cursor-pointer rounded-md border border-hairline bg-transparent"
                  />
                  <span className="text-sm text-muted-recall">{newColor}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={onCreate}
              disabled={!newName.trim() || createMutation.isPending}
              className="mt-6 w-full bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand"
            >
              {createMutation.isPending ? 'Creating…' : 'Create deck'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function SortableDeckItem({
  deck,
  index,
  onOpen,
  onReview,
  onDelete,
}: {
  deck: Deck
  index: number
  onOpen: () => void
  onReview: () => void
  onDelete: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deck.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      className="animate-fade-in-up"
      style={{ ...style, animationDelay: `${Math.min(index, 8) * 40}ms` }}
    >
      <Card className={`border-hairline bg-card-surface p-4 card-lift ${isDragging ? 'shadow-panel' : ''}`}>
        <div className="flex items-center gap-2">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab touch-none text-muted-recall hover:text-primary-recall active:cursor-grabbing"
            aria-label="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <span
            className="h-10 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: deck.color }}
            aria-hidden="true"
          />
          <button
            onClick={onOpen}
            className="flex flex-1 items-center justify-between gap-2 text-left"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{deck.name}</p>
              <p className="text-xs text-muted-recall">
                {deck.cardCount} card{deck.cardCount === 1 ? '' : 's'} ·{' '}
                <span className={deck.dueCount > 0 ? 'text-accent-warm' : ''}>
                  {deck.dueCount} due
                </span>
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-recall" aria-hidden="true" />
          </button>

          <Button
            size="sm"
            disabled={deck.dueCount === 0}
            onClick={onReview}
            className="bg-accent-brand text-void hover:bg-accent-brand/90 press"
          >
            <Play className="h-3 w-3" />
            <span className="sr-only">Review</span>
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-8 w-8 p-0 text-muted-recall hover:text-grade-again press"
            aria-label="Delete deck"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </Card>
    </li>
  )
}