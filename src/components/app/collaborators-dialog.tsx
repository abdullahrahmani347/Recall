'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  X,
  UserPlus,
  Trash2,
  Users,
  Crown,
  Loader2,
} from 'lucide-react'
import type { ApiCollaborator } from '@/lib/types'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'

interface CollaboratorsDialogProps {
  notebookId: string
  notebookName: string
  isOwner: boolean
  onClose: () => void
}

/**
 * CollaboratorsDialog — manage who has access to a shared notebook.
 * The owner can invite by email and remove collaborators. Collaborators
 * can view the list but not modify it.
 */
export function CollaboratorsDialog({
  notebookId,
  notebookName,
  isOwner,
  onClose,
}: CollaboratorsDialogProps) {
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('editor')

  const { data, isLoading } = useQuery<{ collaborators: ApiCollaborator[] }>({
    queryKey: ['collaborators', notebookId],
    queryFn: () =>
      api<{ collaborators: ApiCollaborator[] }>(
        `/api/notebooks/${notebookId}/collaborators`
      ),
  })

  const inviteMutation = useMutation({
    mutationFn: (body: { email: string; role: 'editor' | 'viewer' }) =>
      api<{ collaborator: ApiCollaborator }>(
        `/api/notebooks/${notebookId}/collaborators`,
        { method: 'POST', body: JSON.stringify(body) }
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collaborators', notebookId] })
    },
  })

  const removeMutation = useMutation({
    mutationFn: (collaboratorId: string) =>
      api(`/api/collaborators/${collaboratorId}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collaborators', notebookId] })
    },
  })

  const onInvite = async () => {
    if (!email.trim()) return
    try {
      const res = await inviteMutation.mutateAsync({ email: email.trim(), role })
      if ('alreadyExists' in res) {
        toast.success('Updated collaborator role')
      } else {
        toast.success(`Invited ${email.trim()} as ${role}`)
      }
      setEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite')
    }
  }

  const onRemove = async (collaborator: ApiCollaborator) => {
    if (!confirm(`Remove ${collaborator.name ?? collaborator.email} from this notebook?`)) return
    try {
      await removeMutation.mutateAsync(collaborator.id)
      toast.success('Collaborator removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    }
  }

  const collaborators = data?.collaborators ?? []

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-3xl border border-hairline bg-card-surface sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`Collaborators for ${notebookName}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline p-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-brand/15 text-accent-brand">
              <Users className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">Sharing</h3>
              <p className="text-xs text-muted-recall">{notebookName}</p>
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

        {/* Body */}
        <div className="flex-1 overflow-y-auto scrollbar-thin p-5">
          {isOwner ? (
            <>
              {/* Invite form */}
              <div className="mb-5">
                <Label htmlFor="invite-email" className="text-sm">Invite by email</Label>
                <p className="mb-2 text-xs text-muted-recall">
                  They must already have a Recall account.
                </p>
                <div className="flex gap-2">
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="collaborator@example.com"
                    className="bg-void"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onInvite()
                    }}
                  />
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')}
                    className="rounded-md border border-hairline bg-void px-2 text-sm"
                    aria-label="Collaborator role"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                  <Button
                    onClick={onInvite}
                    disabled={!email.trim() || inviteMutation.isPending}
                    className="shrink-0 bg-accent-brand text-void hover:bg-accent-brand/90"
                  >
                    {inviteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UserPlus className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="mb-5 rounded-md border border-hairline bg-void p-3 text-xs text-muted-recall">
              Only the notebook owner can invite or remove collaborators.
            </p>
          )}

          {/* Collaborator list */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-recall">
              People with access
            </p>
            {isLoading ? (
              <p className="text-sm text-muted-recall">Loading…</p>
            ) : (
              <ul className="space-y-2">
                {/* Owner (always first) */}
                <li className="flex items-center gap-3 rounded-lg border border-hairline bg-void p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-warm/20 text-accent-warm">
                    <Crown className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Owner</p>
                    <p className="text-xs text-muted-recall">You (this notebook belongs to you)</p>
                  </div>
                </li>

                {collaborators.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-lg border border-hairline bg-void p-3"
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card-surface text-xs font-semibold">
                      {initials(c.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {c.name ?? 'Anonymous'}
                      </p>
                      <p className="truncate text-xs text-muted-recall">{c.email}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        c.role === 'editor'
                          ? 'bg-accent-brand/15 text-accent-brand'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {c.role}
                    </span>
                    {isOwner && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemove(c)}
                        className="h-7 w-7 p-0 text-muted-recall hover:text-grade-again"
                        aria-label={`Remove ${c.name ?? c.email}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </li>
                ))}

                {collaborators.length === 0 && !isLoading && (
                  <li className="rounded-lg border border-dashed border-hairline p-6 text-center">
                    <Users className="mx-auto mb-2 h-6 w-6 text-muted-recall" aria-hidden="true" />
                    <p className="text-sm text-muted-recall">
                      No collaborators yet.
                    </p>
                    {isOwner && (
                      <p className="mt-1 text-xs text-muted-recall">
                        Invite someone by email to start sharing.
                      </p>
                    )}
                  </li>
                )}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function initials(name: string | null): string {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
