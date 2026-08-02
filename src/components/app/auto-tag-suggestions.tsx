'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Sparkles, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

interface SuggestedTag {
  name: string
  color: string
}

/**
 * AutoTagSuggestions — shows AI-suggested tags for a note.
 * Appears as a small bar below the tag row in the editor.
 * User can accept individual suggestions (creates the tag + assigns it)
 * or dismiss the bar.
 */
export function AutoTagSuggestions({
  noteId,
  selectedTagIds,
  onAddTag,
}: {
  noteId: string
  selectedTagIds: string[]
  onAddTag: (tagId: string) => void
}) {
  const qc = useQueryClient()
  const [suggestions, setSuggestions] = useState<SuggestedTag[]>([])
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(false)

  const fetchSuggestions = async () => {
    setLoading(true)
    try {
      const res = await api<{ suggestions: SuggestedTag[] }>(
        `/api/notes/${noteId}/auto-tag`,
        { method: 'POST' }
      )
      // Filter out tags that are already selected
      const existingNames = new Set<string>()
      const tagsData = await api<{ tags: { id: string; name: string }[] }>('/api/tags')
      for (const t of tagsData.tags) {
        if (selectedTagIds.includes(t.id)) existingNames.add(t.name.toLowerCase())
      }
      const filtered = res.suggestions.filter(
        (s) => !existingNames.has(s.name.toLowerCase())
      )
      setSuggestions(filtered)
      if (filtered.length === 0) {
        toast.info('No new tag suggestions — your tags look good.')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to get suggestions')
    } finally {
      setLoading(false)
    }
  }

  const createAndAssignTag = async (suggestion: SuggestedTag) => {
    try {
      // Create the tag
      const res = await api<{ tag: { id: string } }>('/api/tags', {
        method: 'POST',
        body: JSON.stringify({ name: suggestion.name, color: suggestion.color }),
      })
      onAddTag(res.tag.id)
      setSuggestions((prev) => prev.filter((s) => s.name !== suggestion.name))
      qc.invalidateQueries({ queryKey: ['tags'] })
      toast.success(`Added tag "${suggestion.name}"`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add tag')
    }
  }

  if (dismissed || (!loading && suggestions.length === 0)) {
    return (
      <button
        onClick={fetchSuggestions}
        disabled={loading}
        className="inline-flex items-center gap-1 text-xs text-muted-recall hover:text-accent-brand"
      >
        <Sparkles className="h-3 w-3" />
        {loading ? 'Analyzing…' : 'Suggest tags'}
      </button>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center gap-1 text-xs text-muted-recall">
        <Sparkles className="h-3 w-3 animate-pulse text-accent-brand" />
        Analyzing note content…
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Sparkles className="h-3 w-3 text-accent-brand" aria-hidden="true" />
      <span className="text-[10px] uppercase tracking-wider text-muted-recall">AI tags</span>
      {suggestions.map((s) => (
        <button
          key={s.name}
          onClick={() => createAndAssignTag(s)}
          className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-smooth press hover:scale-105"
          style={{ borderColor: s.color, color: s.color, backgroundColor: `${s.color}15` }}
        >
          <Plus className="h-2.5 w-2.5" />
          {s.name}
        </button>
      ))}
      <button
        onClick={() => setDismissed(true)}
        className="text-muted-recall hover:text-primary-recall"
        aria-label="Dismiss suggestions"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
