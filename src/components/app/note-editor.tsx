'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import ReactMarkdown from 'react-markdown'
import {
  ArrowLeft,
  Check,
  Loader2,
  Sparkles,
  Trash2,
  Pin,
  Plus,
  X,
  Eye,
  Pencil,
  Columns2,
  Bold,
  Italic,
  List,
  ListOrdered,
  Code2,
  Table as TableIcon,
  Quote,
  Heading1,
  Heading2,
  Link as LinkIcon,
  ImageIcon,
  Wand2,
} from 'lucide-react'
import type { ApiNote, ApiTag } from '@/lib/types'
import { toast } from 'sonner'
import { SummaryStream } from './summary-stream'
import { GenerateCardsDialog } from './generate-cards-dialog'
import { RelatedNotes } from './related-notes'
import { formatDistanceToNow } from 'date-fns'

type EditorMode = 'edit' | 'preview' | 'split'

export function NoteEditor() {
  const qc = useQueryClient()
  const { activeNoteId, setView, openNote } = useAppStore()
  const isNew = !activeNoteId

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [noteId, setNoteId] = useState<string | null>(activeNoteId)
  const [showSummary, setShowSummary] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [showTagSheet, setShowTagSheet] = useState(false)
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])
  const [editorMode, setEditorMode] = useState<EditorMode>('edit')
  const [showGenerateCards, setShowGenerateCards] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Ref mirror of noteId so the autosave callback always sees the latest
  // value — without this, a stale closure can re-create the note on every
  // keystroke after the first save.
  const noteIdRef = useRef<string | null>(activeNoteId)
  useEffect(() => {
    noteIdRef.current = noteId
  }, [noteId])

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load existing note
  const { data: noteData } = useQuery<{ note: ApiNote & { summaries?: { id: string; summaryText: string; status: string }[] } }>({
    queryKey: ['note', activeNoteId],
    queryFn: () => api(`/api/notes/${activeNoteId}`),
    enabled: !!activeNoteId,
  })

  // Load existing note into local editable state when it arrives.
  // We use the render-phase "adjust state when prop changes" pattern
  // (see https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // rather than setState-in-effect, because the latter triggers cascading
  // renders and is flagged by react-hooks/set-state-in-effect.
  const [loadedNoteId, setLoadedNoteId] = useState<string | null>(null)
  if (noteData?.note && noteData.note.id !== loadedNoteId) {
    setLoadedNoteId(noteData.note.id)
    setTitle(noteData.note.title)
    setBody(noteData.note.contentMarkdown)
    setNoteId(noteData.note.id)
    setSelectedTagIds(noteData.note.tags.map((t) => t.tag.id))
    // Show the latest completed summary on load if one exists
    const completed = noteData.note.summaries?.find(
      (s) => s.status === 'complete' && s.summaryText
    )
    if (completed) setShowSummary(true)
  }

  // Load tags
  const { data: tagsData } = useQuery<{ tags: (ApiTag & { noteCount: number })[] }>({
    queryKey: ['tags'],
    queryFn: () => api('/api/tags'),
  })

  const createNoteMutation = useMutation({
    mutationFn: (data: { title: string; contentMarkdown: string; tagIds: string[] }) =>
      api<{ note: ApiNote }>('/api/notes', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  })

  const updateNoteMutation = useMutation({
    mutationFn: (data: {
      title?: string
      contentMarkdown?: string
      tagIds?: string[]
      isPinned?: boolean
      isArchived?: boolean
    }) => api<{ note: ApiNote }>(`/api/notes/${noteId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),
  })

  const deleteNoteMutation = useMutation({
    mutationFn: () => api(`/api/notes/${noteId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Note deleted')
      setView('notes')
    },
  })

  // Autosave (debounced 1.2s) — per §9 of the brief
  const save = useCallback(async () => {
    if (!dirty) return
    const currentNoteId = noteIdRef.current
    try {
      if (isNew || !currentNoteId) {
        // Only create if there's actual content
        if (!title && !body) {
          setDirty(false)
          return
        }
        const res = await createNoteMutation.mutateAsync({
          title: title || 'Untitled',
          contentMarkdown: body,
          tagIds: selectedTagIds,
        })
        noteIdRef.current = res.note.id
        setNoteId(res.note.id)
        openNote(res.note.id) // update store so future nav returns here
        setDirty(false)
        setSavedAt(new Date())
        qc.invalidateQueries({ queryKey: ['notes'] })
        qc.invalidateQueries({ queryKey: ['stats'] })
      } else {
        await updateNoteMutation.mutateAsync({
          title: title || 'Untitled',
          contentMarkdown: body,
          tagIds: selectedTagIds,
        })
        setDirty(false)
        setSavedAt(new Date())
        qc.invalidateQueries({ queryKey: ['notes'] })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }, [
    dirty,
    isNew,
    title,
    body,
    selectedTagIds,
    createNoteMutation,
    updateNoteMutation,
    openNote,
    qc,
  ])

  // Debounced autosave
  useEffect(() => {
    if (!dirty) return
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    autosaveTimer.current = setTimeout(() => {
      save()
    }, 1200)
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [dirty, save])

  // Save on unmount
  useEffect(() => {
    return () => {
      if (dirty) {
        // Fire-and-forget final save
        save()
      }
    }
  }, [dirty, save])

  const onTitleChange = (v: string) => {
    setTitle(v)
    setDirty(true)
  }
  const onBodyChange = (v: string) => {
    setBody(v)
    setDirty(true)
  }

  /**
   * Insert markdown syntax at the cursor position, with optional
   * selection-wrapping behavior. Used by the toolbar buttons.
   */
  const insertMarkdown = useCallback(
    (before: string, after: string = '', placeholder: string = '') => {
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const selected = body.slice(start, end) || placeholder
      const newText = body.slice(0, start) + before + selected + after + body.slice(end)
      setBody(newText)
      setDirty(true)
      // Restore cursor position after React re-renders
      requestAnimationFrame(() => {
        ta.focus()
        const pos = start + before.length + selected.length + after.length
        ta.setSelectionRange(start + before.length, pos)
      })
    },
    [body]
  )

  const insertLinePrefix = useCallback(
    (prefix: string) => {
      const ta = textareaRef.current
      if (!ta) return
      const start = ta.selectionStart
      const lineStart = body.lastIndexOf('\n', start - 1) + 1
      const newText = body.slice(0, lineStart) + prefix + body.slice(lineStart)
      setBody(newText)
      setDirty(true)
      requestAnimationFrame(() => {
        ta.focus()
        ta.setSelectionRange(start + prefix.length, start + prefix.length)
      })
    },
    [body]
  )

  const insertTable = useCallback(() => {
    const table = '\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| | | |\n| | | |\n'
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const newText = body.slice(0, start) + table + body.slice(start)
    setBody(newText)
    setDirty(true)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + table.length, start + table.length)
    })
  }, [body])

  const insertCodeBlock = useCallback(() => {
    const block = '\n```\n// your code here\n```\n'
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const newText = body.slice(0, start) + block + body.slice(start)
    setBody(newText)
    setDirty(true)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + 6, start + 22) // select "your code here"
    })
  }, [body])

  /**
   * Image paste handler — reads the clipboard image, converts to a base64
   * data URL, and inserts a markdown image tag at the cursor. Phase 2
   * uses inline base64 to avoid the need for an upload service; the
   * Attachment model is ready for a Phase 3 migration to server storage.
   */
  const onPaste = useCallback(
    (e: React.ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault()
          const file = item.getAsFile()
          if (!file) continue
          if (file.size > 2 * 1024 * 1024) {
            toast.error('Image too large (max 2MB for inline paste)')
            return
          }
          const reader = new FileReader()
          reader.onload = () => {
            const dataUrl = reader.result as string
            insertMarkdown(`![image](${dataUrl})`, '', 'image')
            toast.success('Image inserted')
          }
          reader.readAsDataURL(file)
          return
        }
      }
    },
    [insertMarkdown]
  )

  const onSummarize = () => {
    if (dirty) {
      // Force a save first so the server has the latest content
      save().then(() => setShowSummary(true))
    } else {
      setShowSummary(true)
    }
  }

  const onTogglePin = async () => {
    if (!noteId) return
    try {
      await updateNoteMutation.mutateAsync({ isPinned: !noteData?.note.isPinned })
      qc.invalidateQueries({ queryKey: ['note', noteId] })
    } catch {
      toast.error('Failed to toggle pin')
    }
  }

  const onDelete = async () => {
    if (!noteId) {
      setView('notes')
      return
    }
    if (!confirm('Delete this note? This cannot be undone.')) return
    await deleteNoteMutation.mutateAsync()
  }

  const existingSummaryText =
    noteData?.note.summaries?.find((s) => s.status === 'complete' && s.summaryText)?.summaryText ?? null

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* TOP BAR */}
      <header className="sticky top-0 z-20 border-b border-hairline bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3 sm:px-6">
          <button
            onClick={() => {
              if (dirty) save()
              setView('notes')
            }}
            className="inline-flex items-center gap-1 text-sm text-secondary-recall transition hover:text-primary-recall"
            aria-label="Back to notes"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Notes</span>
          </button>

          <div className="flex items-center gap-2 text-xs text-muted-recall">
            {dirty ? (
              <span className="flex items-center gap-1">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Saving…
              </span>
            ) : savedAt ? (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-accent-brand" aria-hidden="true" />
                Saved {formatDistanceToNow(savedAt, { addSuffix: true })}
              </span>
            ) : noteData?.note?.updatedAt ? (
              <span>Saved {formatDistanceToNow(new Date(noteData.note.updatedAt), { addSuffix: true })}</span>
            ) : null}
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onTogglePin}
              disabled={!noteId}
              className="h-8 w-8 p-0"
              aria-label={noteData?.note.isPinned ? 'Unpin note' : 'Pin note'}
            >
              <Pin
                className={`h-4 w-4 ${
                  noteData?.note.isPinned ? 'text-accent-warm' : 'text-muted-recall'
                }`}
                aria-hidden="true"
              />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              className="h-8 w-8 p-0 text-muted-recall hover:text-grade-again"
              aria-label="Delete note"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* EDITOR */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        <Input
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Note title"
          className="border-0 bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 sm:text-3xl font-display tracking-tight"
          aria-label="Note title"
        />

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {selectedTagIds.length === 0 ? null : (
            tagsData?.tags
              .filter((t) => selectedTagIds.includes(t.id))
              .map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                >
                  {tag.name}
                  <button
                    onClick={() =>
                      setSelectedTagIds(selectedTagIds.filter((id) => id !== tag.id))
                    }
                    className="ml-0.5 rounded-full p-0.5 hover:bg-black/20"
                    aria-label={`Remove tag ${tag.name}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))
          )}
          <button
            onClick={() => setShowTagSheet(true)}
            className="inline-flex items-center gap-1 rounded-full border border-hairline bg-card-surface px-2 py-0.5 text-xs text-secondary-recall hover:text-primary-recall"
          >
            <Plus className="h-2.5 w-2.5" />
            Tag
          </button>
        </div>

        {/* MARKDOWN TOOLBAR */}
        <div className="mt-6 flex flex-wrap items-center gap-1 rounded-xl border border-hairline bg-card-surface p-1.5">
          <ToolbarButton onClick={() => insertLinePrefix('# ')} aria-label="Heading 1">
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertLinePrefix('## ')} aria-label="Heading 2">
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertMarkdown('**', '**', 'bold')} aria-label="Bold">
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertMarkdown('_', '_', 'italic')} aria-label="Italic">
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton onClick={() => insertLinePrefix('- ')} aria-label="Bullet list">
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertLinePrefix('1. ')} aria-label="Numbered list">
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={() => insertLinePrefix('> ')} aria-label="Quote">
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarSeparator />
          <ToolbarButton onClick={insertCodeBlock} aria-label="Code block">
            <Code2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={insertTable} aria-label="Table">
            <TableIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => insertMarkdown('[', '](https://)', 'link text')}
            aria-label="Link"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => insertMarkdown('![alt text](', ')', 'https://example.com/image.png')}
            aria-label="Image"
          >
            <ImageIcon className="h-4 w-4" />
          </ToolbarButton>

          {/* Mode toggle (right side) */}
          <div className="ml-auto flex items-center gap-0.5 rounded-lg bg-void p-0.5">
            <ModeButton active={editorMode === 'edit'} onClick={() => setEditorMode('edit')} aria-label="Edit mode">
              <Pencil className="h-3.5 w-3.5" />
            </ModeButton>
            <ModeButton active={editorMode === 'split'} onClick={() => setEditorMode('split')} aria-label="Split mode">
              <Columns2 className="h-3.5 w-3.5" />
            </ModeButton>
            <ModeButton active={editorMode === 'preview'} onClick={() => setEditorMode('preview')} aria-label="Preview mode">
              <Eye className="h-3.5 w-3.5" />
            </ModeButton>
          </div>
        </div>

        {/* EDITOR BODY — edit / split / preview */}
        <div className={`mt-4 ${editorMode === 'split' ? 'grid gap-4 lg:grid-cols-2' : ''}`}>
          {editorMode !== 'preview' && (
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              onPaste={onPaste}
              placeholder={`Start writing… Markdown is welcome.\n\n# Heading\n- bullet\n**bold** _italic_\n\n\`\`\`\n// code block\n\`\`\`\n\n| Col A | Col B |\n| --- | --- |\n| 1 | 2 |`}
              className="min-h-[60vh] resize-none border-0 bg-transparent px-0 text-base leading-relaxed shadow-none focus-visible:ring-0"
              aria-label="Note body"
            />
          )}
          {editorMode === 'split' && (
            <div className="min-h-[60vh] overflow-y-auto scrollbar-thin rounded-lg border border-hairline bg-card-surface p-4">
              {body.trim() ? (
                <MarkdownPreview source={body} />
              ) : (
                <p className="text-sm text-muted-recall">Preview will appear here…</p>
              )}
            </div>
          )}
          {editorMode === 'preview' && (
            <div className="min-h-[60vh]">
              {body.trim() ? (
                <MarkdownPreview source={body} />
              ) : (
                <p className="text-sm text-muted-recall">Nothing to preview yet.</p>
              )}
            </div>
          )}
        </div>

        {/* AI summary */}
        {showSummary && noteId && (
          <div className="mt-8">
            <SummaryStream
              noteId={noteId}
              existingSummary={existingSummaryText}
              onDismiss={() => setShowSummary(false)}
            />
          </div>
        )}

        {/* Related notes (Phase 2) — only for saved notes with content */}
        {noteId && body.trim() && (
          <div className="mt-6">
            <RelatedNotes noteId={noteId} />
          </div>
        )}
      </main>

      {/* ACTION BAR */}
      <footer
        className="sticky bottom-0 z-20 border-t border-hairline bg-canvas/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <p className="text-xs text-muted-recall">
            {body.trim().split(/\s+/).filter(Boolean).length} words
          </p>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => {
                if (dirty) {
                  save().then(() => setShowGenerateCards(true))
                } else {
                  setShowGenerateCards(true)
                }
              }}
              disabled={!title && !body}
              variant="ghost"
              size="sm"
              className="border border-hairline bg-card-surface"
            >
              <Wand2 className="mr-1 h-4 w-4 text-accent-warm" />
              <span className="hidden sm:inline">Make cards</span>
              <span className="sm:hidden">Cards</span>
            </Button>
            <Button
              onClick={onSummarize}
              disabled={!title && !body}
              className="bg-accent-brand text-void hover:bg-accent-brand/90"
              size="sm"
            >
              <Sparkles className="mr-1 h-4 w-4" />
              Summarize
            </Button>
          </div>
        </div>
      </footer>

      {/* GENERATE CARDS DIALOG (Phase 2) */}
      {showGenerateCards && noteId && (
        <GenerateCardsDialog
          noteId={noteId}
          onClose={() => setShowGenerateCards(false)}
        />
      )}

      {/* TAG BOTTOM SHEET */}
      {showTagSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setShowTagSheet(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl border border-hairline bg-card-surface p-6 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Tags"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Tags</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTagSheet(false)}
                className="h-8 w-8 p-0"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {tagsData?.tags?.length ? (
              <ul className="mb-4 max-h-72 space-y-1 overflow-y-auto scrollbar-thin">
                {tagsData.tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id)
                  return (
                    <li key={tag.id}>
                      <button
                        onClick={() =>
                          setSelectedTagIds(
                            selected
                              ? selectedTagIds.filter((id) => id !== tag.id)
                              : [...selectedTagIds, tag.id]
                          )
                        }
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-void"
                      >
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: tag.color }}
                          aria-hidden="true"
                        />
                        <span className="flex-1 text-sm">{tag.name}</span>
                        {selected && (
                          <Check className="h-4 w-4 text-accent-brand" aria-hidden="true" />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-muted-recall">
                No tags yet. Create one below.
              </p>
            )}

            <NewTagInline onCreated={(tag) => {
              setSelectedTagIds([...selectedTagIds, tag.id])
              qc.invalidateQueries({ queryKey: ['tags'] })
            }} />

            <Button
              onClick={() => {
                setDirty(true)
                setShowTagSheet(false)
              }}
              className="mt-4 w-full bg-accent-brand text-void hover:bg-accent-brand/90"
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function NewTagInline({ onCreated }: { onCreated: (tag: ApiTag) => void }) {
  const [name, setName] = useState('')
  const [color, setColor] = useState('#FFB454')
  const [pending, setPending] = useState(false)

  const create = async () => {
    if (!name.trim()) return
    setPending(true)
    try {
      const res = await api<{ tag: ApiTag }>('/api/tags', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), color }),
      })
      onCreated(res.tag)
      setName('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create tag')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        className="h-8 w-8 shrink-0 cursor-pointer rounded-md border border-hairline bg-transparent"
        aria-label="Tag color"
      />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') create()
        }}
        placeholder="New tag name…"
        className="bg-void"
        aria-label="New tag name"
      />
      <Button
        size="sm"
        onClick={create}
        disabled={pending || !name.trim()}
        className="shrink-0"
      >
        Add
      </Button>
    </div>
  )
}

/* ============================================================
   Editor toolbar helpers
   ============================================================ */

function ToolbarButton({
  children,
  onClick,
  'aria-label': ariaLabel,
}: {
  children: React.ReactNode
  onClick: () => void
  'aria-label': string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="flex h-8 w-8 items-center justify-center rounded-md text-secondary-recall transition hover:bg-void hover:text-primary-recall"
    >
      {children}
    </button>
  )
}

function ToolbarSeparator() {
  return <span className="mx-1 h-5 w-px bg-hairline" aria-hidden="true" />
}

function ModeButton({
  active,
  onClick,
  children,
  'aria-label': ariaLabel,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  'aria-label': string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      className={`flex h-7 w-7 items-center justify-center rounded transition ${
        active
          ? 'bg-card-surface text-accent-brand'
          : 'text-muted-recall hover:text-primary-recall'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Markdown preview — renders markdown with proper styling for headings,
   lists, code blocks, tables, blockquotes, and images. Uses react-markdown
   with custom components for theme-aware styling.
 */
function MarkdownPreview({ source }: { source: string }) {
  return (
    <div className="prose-recall">
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="mb-3 mt-5 font-display text-2xl font-semibold tracking-tight">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-4 font-display text-xl font-semibold tracking-tight">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-3 font-display text-lg font-semibold">{children}</h3>
          ),
          p: ({ children }) => <p className="mb-3 leading-relaxed text-secondary-recall">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5 text-secondary-recall">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5 text-secondary-recall">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-accent-brand/40 pl-4 italic text-muted-recall">
              {children}
            </blockquote>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !className
            if (isInline) {
              return (
                <code className="rounded bg-void px-1.5 py-0.5 text-sm text-accent-brand" {...props}>
                  {children}
                </code>
              )
            }
            return (
              <code className="block" {...props}>
                {children}
              </code>
            )
          },
          pre: ({ children }) => (
            <pre className="my-3 overflow-x-auto rounded-lg border border-hairline bg-void p-4 text-sm scrollbar-thin">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto scrollbar-thin">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-hairline">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 text-left font-semibold text-primary-recall">{children}</th>,
          td: ({ children }) => <td className="border-t border-hairline px-3 py-2 text-secondary-recall">{children}</td>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-accent-brand underline underline-offset-2 hover:text-accent-brand/80">
              {children}
            </a>
          ),
          img: ({ src, alt }) => (
            <img src={src as string} alt={alt ?? ''} className="my-3 max-h-96 w-auto rounded-lg border border-hairline" />
          ),
          hr: () => <hr className="my-4 border-hairline" />,
          strong: ({ children }) => <strong className="font-semibold text-primary-recall">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  )
}
