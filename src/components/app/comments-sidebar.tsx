'use client'

import { useState } from 'react'
import { useQuery as useReactQuery, useMutation as useReactMutation, useQueryClient as useQC } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  MessageSquare,
  X,
  Check,
  Trash2,
  CornerDownRight,
  Send,
} from 'lucide-react'
import type { ApiComment } from '@/lib/types'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface CommentsSidebarProps {
  noteId: string
  open: boolean
  onClose: () => void
  onBroadcastComment: (commentId: string, action: 'added' | 'resolved' | 'deleted') => void
}

/**
 * CommentsSidebar — slide-in panel showing all comments on a note.
 * Supports adding new comments, resolving/unresolving, and deleting.
 *
 * When a comment is added/resolved/deleted, we broadcast the event via
 * the collab socket so other viewers' sidebars refresh in real time.
 */
export function CommentsSidebar({
  noteId,
  open,
  onClose,
  onBroadcastComment,
}: CommentsSidebarProps) {
  const qc = useQC()
  const [newComment, setNewComment] = useState('')
  const [anchorText, setAnchorText] = useState<string | null>(null)

  const { data, isLoading } = useReactQuery<{ comments: ApiComment[] }>({
    queryKey: ['comments', noteId],
    queryFn: () => api<{ comments: ApiComment[] }>(`/api/notes/${noteId}/comments`),
    enabled: !!noteId && open,
  })

  const addMutation = useReactMutation({
    mutationFn: (body: { body: string; anchorText?: string | null }) =>
      api<{ comment: ApiComment }>(`/api/notes/${noteId}/comments`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['comments', noteId] })
      onBroadcastComment(res.comment.id, 'added')
      setNewComment('')
      setAnchorText(null)
    },
  })

  const resolveMutation = useReactMutation({
    mutationFn: ({ id, resolved }: { id: string; resolved: boolean }) =>
      api<{ comment: ApiComment }>(`/api/comments/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ resolved }),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['comments', noteId] })
      onBroadcastComment(res.comment.id, 'resolved')
    },
  })

  const deleteMutation = useReactMutation({
    mutationFn: (id: string) => api(`/api/comments/${id}`, { method: 'DELETE' }),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: ['comments', noteId] })
      onBroadcastComment(id, 'deleted')
    },
  })

  const onAdd = async () => {
    if (!newComment.trim()) return
    try {
      await addMutation.mutateAsync({
        body: newComment.trim(),
        anchorText: anchorText ?? null,
      })
      toast.success('Comment added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to add comment')
    }
  }

  const onResolve = async (comment: ApiComment) => {
    try {
      await resolveMutation.mutateAsync({ id: comment.id, resolved: !comment.resolved })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update comment')
    }
  }

  const onDelete = async (comment: ApiComment) => {
    if (!confirm('Delete this comment?')) return
    try {
      await deleteMutation.mutateAsync(comment.id)
      toast.success('Comment deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete comment')
    }
  }

  const comments = data?.comments ?? []
  const openCount = comments.filter((c) => !c.resolved).length
  const resolvedCount = comments.length - openCount

  if (!open) return null

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/40 sm:bg-transparent"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <aside
        className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-hairline bg-canvas shadow-xl"
        role="complementary"
        aria-label="Comments"
      >
        {/* Header */}
        <header className="flex items-center justify-between border-b border-hairline p-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-accent-brand" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold">Comments</h2>
            {openCount > 0 && (
              <span className="rounded-full bg-accent-brand/15 px-2 py-0.5 text-[10px] font-semibold text-accent-brand">
                {openCount} open
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
            aria-label="Close comments"
          >
            <X className="h-4 w-4" />
          </Button>
        </header>

        {/* New comment composer */}
        <div className="border-b border-hairline p-4">
          {anchorText && (
            <div className="mb-2 flex items-start gap-2 rounded-md border-l-2 border-accent-warm bg-accent-warm/10 p-2 text-xs">
              <CornerDownRight className="mt-0.5 h-3 w-3 shrink-0 text-accent-warm" aria-hidden="true" />
              <div className="flex-1">
                <p className="text-muted-recall">Re: selected text</p>
                <p className="mt-0.5 line-clamp-2 italic">&ldquo;{anchorText}&rdquo;</p>
              </div>
              <button
                onClick={() => setAnchorText(null)}
                className="text-muted-recall hover:text-primary-recall"
                aria-label="Clear anchor text"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}
          <Textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment…"
            className="min-h-[80px] resize-none bg-card-surface"
            aria-label="New comment"
          />
          <div className="mt-2 flex items-center justify-between">
            <p className="text-[10px] text-muted-recall">
              {anchorText ? 'Commenting on selected text' : 'General comment'}
            </p>
            <Button
              size="sm"
              onClick={onAdd}
              disabled={!newComment.trim() || addMutation.isPending}
              className="bg-accent-brand text-void hover:bg-accent-brand/90"
            >
              <Send className="mr-1 h-3 w-3" />
              Comment
            </Button>
          </div>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-recall">Loading comments…</p>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
              <MessageSquare className="mb-3 h-8 w-8 text-muted-recall" aria-hidden="true" />
              <p className="text-sm font-medium">No comments yet</p>
              <p className="mt-1 text-xs text-muted-recall">
                Start a discussion by adding the first comment.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-hairline">
              {comments.map((comment) => (
                <li key={comment.id} className={`p-4 ${comment.resolved ? 'opacity-60' : ''}`}>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-card-surface text-[10px] font-semibold">
                        {initials(comment.userName)}
                      </div>
                      <div>
                        <p className="text-xs font-medium">{comment.userName ?? 'Anonymous'}</p>
                        <p className="text-[10px] text-muted-recall">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onResolve(comment)}
                        className={`h-7 px-2 text-xs ${
                          comment.resolved
                            ? 'text-accent-brand'
                            : 'text-muted-recall hover:text-accent-brand'
                        }`}
                        aria-label={comment.resolved ? 'Reopen comment' : 'Resolve comment'}
                      >
                        <Check className="h-3 w-3" />
                        {comment.resolved ? 'Resolved' : 'Resolve'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(comment)}
                        className="h-7 w-7 p-0 text-muted-recall hover:text-grade-again"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {comment.anchorText && (
                    <div className="mb-2 rounded-md border-l-2 border-accent-warm bg-accent-warm/5 p-2 text-xs italic text-muted-recall">
                      &ldquo;{comment.anchorText}&rdquo;
                    </div>
                  )}
                  <p className="text-sm leading-relaxed text-secondary-recall whitespace-pre-wrap">
                    {comment.body}
                  </p>
                </li>
              ))}
              {resolvedCount > 0 && (
                <li className="p-3 text-center text-[10px] text-muted-recall">
                  {resolvedCount} resolved comment{resolvedCount === 1 ? '' : 's'} hidden
                </li>
              )}
            </ul>
          )}
        </div>
      </aside>
    </>
  )
}

function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
