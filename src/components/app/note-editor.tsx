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
  MessageSquare,
  Users,
  MoreHorizontal,
  Undo2,
  Redo2,
} from 'lucide-react'
import type { ApiNote, ApiTag } from '@/lib/types'
import { toast } from 'sonner'
import { SummaryStream } from './summary-stream'
import { GenerateCardsDialog } from './generate-cards-dialog'
import { RelatedNotes } from './related-notes'
import { Backlinks } from './backlinks'
import { AutoTagSuggestions } from './auto-tag-suggestions'
import { SuggestConnections } from './suggest-connections'
import { PresenceAvatars } from './presence-avatars'
import { LiveCursors } from './live-cursors'
import { CommentsSidebar } from './comments-sidebar'
import { CollaboratorsDialog } from './collaborators-dialog'
import { RichTextEditor } from './rich-text-editor'
import { ImageOcclusionEditor } from './image-occlusion-editor'
import { AudioNoteRecorder } from './audio-note-recorder'
import { useCollab } from '@/hooks/use-collab'
import { useAuth } from '@/hooks/use-auth'
import { formatDistanceToNow } from 'date-fns'

type EditorMode = 'edit' | 'preview' | 'split'

export function NoteEditor() {
  const qc = useQueryClient()
  // Use selectors to avoid re-rendering on every store change (e.g. when
  // the autosave invalidates queries and triggers refetches).
  const activeNoteId = useAppStore((s) => s.activeNoteId)
  const setView = useAppStore((s) => s.setView)
  const openNote = useAppStore((s) => s.openNote)
  const { user } = useAuth()
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
  const [showOcclusionEditor, setShowOcclusionEditor] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [showCollaborators, setShowCollaborators] = useState(false)
  const [remoteUpdateBanner, setRemoteUpdateBanner] = useState<string | null>(null)
  const [showOverflow, setShowOverflow] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showActionsMenu, setShowActionsMenu] = useState(false)

  // Undo/redo history — simple stack-based implementation for the textarea
  const undoStack = useRef<string[]>([])
  const redoStack = useRef<string[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Ref mirror of noteId so the autosave callback always sees the latest
  // value — without this, a stale closure can re-create the note on every
  // keystroke after the first save.
  const noteIdRef = useRef<string | null>(activeNoteId)
  useEffect(() => {
    noteIdRef.current = noteId
  }, [noteId])

  // Guard against concurrent saves. Without this, when the user types in a
  // NEW note, the autosave timer fires, save() starts the async POST, but
  // before it completes the user types more, dirty becomes true again,
  // another timer fires, and save() runs again — noteIdRef.current is still
  // null (first save hasn't completed), so it creates ANOTHER note. This
  // caused dozens of duplicate notes from a single typing session.
  const savingRef = useRef(false)
  // Ref mirror of dirty so the save() finally block can check if the user
  // typed more during the save, without depending on the stale closure value.
  const dirtyRef = useRef(false)
  useEffect(() => {
    dirtyRef.current = dirty
  }, [dirty])

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
    const completed = noteData.note.summaries?.find(
      (s) => s.status === 'complete' && s.summaryText
    )
    if (completed) setShowSummary(true)
  }

  // Load template content for new notes (set by TemplatePicker)
  const [templateLoaded, setTemplateLoaded] = useState(false)
  if (isNew && !templateLoaded && typeof window !== 'undefined') {
    const tmplTitle = sessionStorage.getItem('recall-template-title')
    const tmplContent = sessionStorage.getItem('recall-template-content')
    if (tmplTitle !== null || tmplContent !== null) {
      if (tmplTitle) setTitle(tmplTitle)
      if (tmplContent) setBody(tmplContent)
      setDirty(true)
      sessionStorage.removeItem('recall-template-title')
      sessionStorage.removeItem('recall-template-content')
    }
    setTemplateLoaded(true)
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

  // Phase 3: real-time collaboration hook
  const collabUser = user
    ? { id: user.id, name: user.name }
    : null
  const { presence, cursors, sendCursor, broadcastNoteUpdate, broadcastComment } = useCollab(
    noteId,
    collabUser,
    {
      onNoteUpdated: () => {
        // Another user edited the note — show a banner and refresh the query
        setRemoteUpdateBanner('Another editor just updated this note')
        qc.invalidateQueries({ queryKey: ['note', noteId] })
        // Auto-clear the banner after 4 seconds
        setTimeout(() => setRemoteUpdateBanner(null), 4000)
      },
      onComment: () => {
        qc.invalidateQueries({ queryKey: ['comments', noteId] })
      },
    }
  )
  // Keep broadcastNoteUpdate in a ref so the save callback's identity stays
  // stable (the eslint rule requires manual memoization to be preserved).
  const broadcastNoteUpdateRef = useRef(broadcastNoteUpdate)
  useEffect(() => {
    broadcastNoteUpdateRef.current = broadcastNoteUpdate
  })

  // Autosave (debounced 1.2s) — per §9 of the brief.
  // The savingRef guard prevents concurrent saves: if a save is in-flight
  // (the async POST hasn't completed), subsequent save() calls return early.
  // After the save completes, if dirty became true again during the save,
  // we schedule another save to pick up the latest content.
  //
  // IMPORTANT: we check `!noteIdRef.current` instead of `isNew` because
  // `isNew` is captured in this closure and stays true even after the first
  // save creates the note and updates noteIdRef. Using the ref ensures
  // subsequent saves take the update path, not the create path.
  const save = useCallback(async () => {
    if (!dirty) return
    if (savingRef.current) return // A save is already in-flight — skip
    const currentNoteId = noteIdRef.current
    savingRef.current = true // Set synchronously before any await
    try {
      if (!currentNoteId) {
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
        // Phase 3: broadcast the edit to other viewers
        broadcastNoteUpdateRef.current()
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      savingRef.current = false
      // If the user typed more while we were saving, schedule another save.
      // save() will see noteIdRef.current is now set and take the update path.
      if (dirtyRef.current) {
        setTimeout(() => save(), 500)
      }
    }
  }, [
    dirty,
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
    // Push the previous body to the undo stack before changing
    if (body !== v) {
      undoStack.current.push(body)
      if (undoStack.current.length > 50) undoStack.current.shift()
      redoStack.current = []
      setCanUndo(true)
      setCanRedo(false)
    }
    setBody(v)
    setDirty(true)
  }

  const handleUndo = () => {
    if (undoStack.current.length === 0) return
    const prev = undoStack.current.pop()!
    redoStack.current.push(body)
    setBody(prev)
    setDirty(true)
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(true)
    requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const handleRedo = () => {
    if (redoStack.current.length === 0) return
    const next = redoStack.current.pop()!
    undoStack.current.push(body)
    setBody(next)
    setDirty(true)
    setCanUndo(true)
    setCanRedo(redoStack.current.length > 0)
    requestAnimationFrame(() => textareaRef.current?.focus())
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
   * Cloze deletion — wraps selected text in {{c1::selected text}}.
   * Triggered by Cmd+Shift+C or the cloze toolbar button.
   */
  const insertCloze = useCallback(() => {
    insertMarkdown('{{c1::', '}}', 'selected text')
  }, [insertMarkdown])

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
      {/* TOP BAR — minimal: back, save status, more menu */}
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
            {/* Presence indicators */}
            {noteId && (
              <PresenceAvatars
                presence={presence}
                currentUserId={user?.id ?? ''}
              />
            )}

            {/* More menu — pin, comments, collaborators, delete */}
            <div className="relative">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="h-8 w-8 p-0"
                aria-label="More options"
                title="More options"
              >
                <MoreHorizontal className="h-4 w-4 text-secondary-recall" />
              </Button>
              {showMoreMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMoreMenu(false)} />
                  <div className="absolute right-0 top-full z-40 mt-1 w-48 rounded-lg border border-hairline bg-card-surface py-1 shadow-panel">
                    <button
                      onClick={() => { onTogglePin(); setShowMoreMenu(false) }}
                      disabled={!noteId}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary-recall hover:bg-accent-brand-dim disabled:opacity-30"
                    >
                      <Pin className={`h-4 w-4 ${noteData?.note.isPinned ? 'text-accent-warm' : ''}`} />
                      {noteData?.note.isPinned ? 'Unpin note' : 'Pin note'}
                    </button>
                    {noteId && (
                      <button
                        onClick={() => { setShowComments(true); setShowMoreMenu(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary-recall hover:bg-accent-brand-dim"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Comments
                      </button>
                    )}
                    {noteId && noteData?.note?.notebookId && (
                      <button
                        onClick={() => { setShowCollaborators(true); setShowMoreMenu(false) }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary-recall hover:bg-accent-brand-dim"
                      >
                        <Users className="h-4 w-4" />
                        Collaborators
                      </button>
                    )}
                    <div className="my-1 border-t border-hairline" />
                    <button
                      onClick={() => { onDelete(); setShowMoreMenu(false) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-grade-again hover:bg-grade-again/10"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete note
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Remote update banner */}
        {remoteUpdateBanner && (
          <div
            className="border-b border-accent-brand/30 bg-accent-brand/10 px-4 py-2 text-center text-xs text-accent-brand"
            role="status"
            aria-live="polite"
          >
            {remoteUpdateBanner}
          </div>
        )}
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

        {/* AI: Auto-tag suggestions */}
        {noteId && (
          <div className="mt-2">
            <AutoTagSuggestions
              noteId={noteId}
              selectedTagIds={selectedTagIds}
              onAddTag={(tagId) => setSelectedTagIds([...selectedTagIds, tagId])}
            />
          </div>
        )}

        {/* MODE TOGGLE — clean segmented control */}
        <div className="mt-6 flex items-center justify-center">
          <div className="flex items-center gap-1 rounded-xl border border-hairline bg-card-surface p-1">
            <ModeButton active={editorMode === 'edit'} onClick={() => setEditorMode('edit')} aria-label="Edit mode">
              <Pencil className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Edit</span>
            </ModeButton>
            <ModeButton active={editorMode === 'split'} onClick={() => setEditorMode('split')} aria-label="Split mode">
              <Columns2 className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Split</span>
            </ModeButton>
            <ModeButton active={editorMode === 'preview'} onClick={() => setEditorMode('preview')} aria-label="Preview mode">
              <Eye className="h-3.5 w-3.5" />
              <span className="ml-1 text-xs">Preview</span>
            </ModeButton>
          </div>
        </div>

        {/* FORMATTING TOOLBAR — only in split mode (edit mode uses RichTextEditor's own toolbar) */}
        {editorMode === 'split' && (
        <div className="mt-3 flex items-center gap-1 rounded-xl border border-hairline bg-card-surface p-1.5">
          {/* Undo/Redo */}
          <ToolbarButton onClick={handleUndo} aria-label="Undo" disabled={!canUndo}>
            <Undo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton onClick={handleRedo} aria-label="Redo" disabled={!canRedo}>
            <Redo2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarSeparator />

          {/* Formatting — horizontally scrollable on mobile */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
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
            <ToolbarButton onClick={() => insertLinePrefix('- ')} aria-label="Bullet list">
              <List className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => insertLinePrefix('1. ')} aria-label="Numbered list">
              <ListOrdered className="h-4 w-4" />
            </ToolbarButton>
            <ToolbarButton onClick={() => insertLinePrefix('> ')} aria-label="Quote">
              <Quote className="h-4 w-4" />
            </ToolbarButton>

            {/* Secondary formatting — hidden on mobile, shown in overflow */}
            <div className="hidden items-center gap-1 sm:flex">
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
            </div>
          </div>

          {/* Overflow menu for mobile — code, table, link, image */}
          <div className="relative sm:hidden">
            <ToolbarButton
              onClick={() => setShowOverflow(!showOverflow)}
              aria-label="More formatting"
            >
              <MoreHorizontal className="h-4 w-4" />
            </ToolbarButton>
            {showOverflow && (
              <div className="absolute right-0 top-full z-30 mt-1 flex flex-col gap-1 rounded-lg border border-hairline bg-card-surface p-1.5 shadow-panel">
                <ToolbarButton onClick={() => { insertCodeBlock(); setShowOverflow(false) }} aria-label="Code block">
                  <Code2 className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => { insertTable(); setShowOverflow(false) }} aria-label="Table">
                  <TableIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => { insertMarkdown('[', '](https://)', 'link text'); setShowOverflow(false) }} aria-label="Link">
                  <LinkIcon className="h-4 w-4" />
                </ToolbarButton>
                <ToolbarButton onClick={() => { insertMarkdown('![alt text](', ')', 'https://example.com/image.png'); setShowOverflow(false) }} aria-label="Image">
                  <ImageIcon className="h-4 w-4" />
                </ToolbarButton>
              </div>
            )}
          </div>
        </div>
        )}

        {/* Phase 3: Live cursor indicators */}
        {noteId && editorMode !== 'preview' && (
          <div className="mt-2 min-h-[24px]">
            <LiveCursors cursors={cursors} currentUserId={user?.id ?? ''} />
          </div>
        )}

        {/* EDITOR BODY — edit / split / preview */}
        <div className={`mt-4 ${editorMode === 'split' ? 'grid gap-4 lg:grid-cols-2' : ''}`}>
          {editorMode === 'edit' && (
            <div className="min-h-[60vh]">
              <RichTextEditor
                content={body}
                onChange={onBodyChange}
                placeholder={`Start writing… Markdown is welcome.\n\n# Heading\n- bullet\n**bold** _italic_\n\nInline card:\nFSRS :: Free Spaced Repetition Scheduler\n\nWiki link:\nThis relates to [[Ebbinghaus]]`}
              />
            </div>
          )}
          {editorMode === 'split' && (
            <Textarea
              ref={textareaRef}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
              onPaste={onPaste}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'c') {
                  e.preventDefault()
                  insertCloze()
                }
              }}
              onKeyUp={(e) => {
                const ta = e.currentTarget
                const pos = ta.selectionStart
                const line = (body.slice(0, pos).match(/\n/g) ?? []).length
                const col = pos - body.lastIndexOf('\n', pos - 1) - 1
                if (line >= 0 && col >= 0) sendCursor(line, col)
              }}
              onClick={(e) => {
                const ta = e.currentTarget
                const pos = ta.selectionStart
                const line = (body.slice(0, pos).match(/\n/g) ?? []).length
                const col = pos - body.lastIndexOf('\n', pos - 1) - 1
                if (line >= 0 && col >= 0) sendCursor(line, col)
              }}
              placeholder={`Start writing… Markdown is welcome.\n\n# Heading\n- bullet\n**bold** _italic_\n\nInline card:\nFSRS :: Free Spaced Repetition Scheduler\n\nWiki link:\nThis relates to [[Ebbinghaus]]`}
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

        {/* Backlinks (Tier 1) — notes that link to this one */}
        {noteId && (
          <div className="mt-4">
            <Backlinks noteId={noteId} />
          </div>
        )}

        {/* AI: Suggest connections between this note and others */}
        {noteId && body.trim().length > 50 && (
          <div className="mt-4">
            <SuggestConnections noteId={noteId} />
          </div>
        )}
      </main>

      {/* ACTION BAR — clean: word count, primary action, more menu */}
      <footer
        className="sticky bottom-0 z-20 border-t border-hairline bg-canvas/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <p className="text-xs text-muted-recall">
            {body.trim().split(/\s+/).filter(Boolean).length} words
          </p>
          <div className="flex items-center gap-2">
            {/* Secondary actions in a dropdown */}
            <div className="relative">
              <Button
                onClick={() => setShowActionsMenu(!showActionsMenu)}
                variant="ghost"
                size="sm"
                className="border border-hairline bg-card-surface"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="ml-1 hidden sm:inline">More</span>
              </Button>
              {showActionsMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowActionsMenu(false)} />
                  <div className="absolute right-0 bottom-full z-40 mb-1 w-52 rounded-lg border border-hairline bg-card-surface py-1 shadow-panel">
                    <button
                      onClick={() => {
                        if (dirty) { save().then(() => setShowGenerateCards(true)) }
                        else { setShowGenerateCards(true) }
                        setShowActionsMenu(false)
                      }}
                      disabled={!title && !body}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary-recall hover:bg-accent-brand-dim disabled:opacity-30"
                    >
                      <Wand2 className="h-4 w-4 text-accent-warm" />
                      Make cards
                    </button>
                    <div className="px-3 py-2">
                      <AudioNoteRecorder
                        onTranscribed={(text) => { setBody((prev) => prev + '\n\n' + text); setDirty(true) }}
                      />
                    </div>
                    <button
                      onClick={() => { setShowOcclusionEditor(true); setShowActionsMenu(false) }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary-recall hover:bg-accent-brand-dim"
                    >
                      <ImageIcon className="h-4 w-4" />
                      Image occlusion
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Primary action */}
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

      {/* IMAGE OCCLUSION EDITOR */}
      {showOcclusionEditor && (
        <ImageOcclusionEditor
          onClose={() => setShowOcclusionEditor(false)}
          onCreate={async ({ imageUrl, occlusions }) => {
            const decksRes = await api<{ decks: { id: string; name: string }[] }>('/api/decks')
            let deck = decksRes.decks.find((d) => d.name === 'Image Occlusion')
            if (!deck) {
              const res = await api<{ deck: { id: string } }>('/api/decks', {
                method: 'POST',
                body: JSON.stringify({ name: 'Image Occlusion', description: 'Cards with hidden regions', color: '#4C8CFF' }),
              })
              deck = { id: res.deck.id, name: 'Image Occlusion' }
            }
            await api('/api/cards/image-occlusion', {
              method: 'POST',
              body: JSON.stringify({ deckId: deck.id, imageUrl, occlusions }),
            })
            toast.success(`Created ${occlusions.length} image occlusion card${occlusions.length === 1 ? '' : 's'}`)
            setShowOcclusionEditor(false)
          }}
        />
      )}

      {/* Phase 3: Comments sidebar */}
      {showComments && noteId && (
        <CommentsSidebar
          noteId={noteId}
          open={showComments}
          onClose={() => setShowComments(false)}
          onBroadcastComment={broadcastComment}
        />
      )}

      {/* Phase 3: Collaborators dialog */}
      {showCollaborators && noteId && noteData?.note?.notebookId && (
        <CollaboratorsDialog
          notebookId={noteData.note.notebookId}
          notebookName={noteData.note.notebook?.name ?? 'Notebook'}
          isOwner={noteData.note.userId === user?.id}
          onClose={() => setShowCollaborators(false)}
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
                        className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-accent-brand-dim"
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
  disabled = false,
}: {
  children: React.ReactNode
  onClick: () => void
  'aria-label': string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="flex h-8 w-8 items-center justify-center rounded-md text-primary-recall transition hover:bg-accent-brand-dim hover:text-accent-brand disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-primary-recall"
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
      className={`flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium transition ${
        active
          ? 'bg-accent-brand text-void shadow-sm'
          : 'text-secondary-recall hover:text-primary-recall hover:bg-card-surface'
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
