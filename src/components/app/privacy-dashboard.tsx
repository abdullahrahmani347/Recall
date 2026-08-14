'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { X, Shield, Database, Trash2, AlertTriangle, Loader2, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface DataCategory {
  category: string
  storage: string
  location: string
  items: { name: string; count: number | string; retained: string }[]
}

interface DataMapResponse {
  user: { email: string; name: string | null; authProvider: string; createdAt: string } | null
  dataCategories: DataCategory[]
  totalItems: number
  accountCreated: string | null
}

export function PrivacyDashboard({ onClose }: { onClose: () => void }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [confirmEmail, setConfirmEmail] = useState('')

  const { data, isLoading } = useQuery<DataMapResponse>({
    queryKey: ['privacy-data-map'],
    queryFn: () => api<DataMapResponse>('/api/privacy/data-map'),
  })

  const deleteMutation = useMutation({
    mutationFn: (email: string) =>
      api('/api/privacy/delete-account', {
        method: 'POST',
        body: JSON.stringify({ confirmEmail: email }),
      }),
    onSuccess: () => {
      toast.success('Account deleted permanently')
      setTimeout(() => window.location.href = '/', 2000)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'Deletion failed'),
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-2xl border border-hairline bg-card-surface p-6 shadow-floating animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Privacy and data controls"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Shield className="h-5 w-5 text-accent-brand" />
            Your Data &amp; Privacy
          </h2>
          <button onClick={onClose} className="text-muted-recall hover:text-primary-recall" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-accent-brand" />
          </div>
        )}

        {data && !showDeleteConfirm && (
          <div className="space-y-4 overflow-y-auto scrollbar-thin pr-1">
            {/* Summary */}
            <div className="rounded-lg border border-hairline bg-void p-4">
              <div className="flex items-center gap-2 text-sm text-primary-recall">
                <Database className="h-4 w-4 text-accent-brand" />
                <span className="font-medium">{data.totalItems} items</span>
                <span className="text-muted-recall">stored across {data.dataCategories.length} categories</span>
              </div>
              {data.accountCreated && (
                <p className="mt-1 text-xs text-muted-recall">
                  Account created {new Date(data.accountCreated).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Data categories */}
            {data.dataCategories.map((cat) => (
              <div key={cat.category} className="rounded-lg border border-hairline bg-void p-4">
                <h3 className="text-sm font-semibold text-primary-recall">{cat.category}</h3>
                <p className="mt-0.5 text-xs text-muted-recall">{cat.storage} · {cat.location}</p>
                <div className="mt-3 space-y-1.5">
                  {cat.items.map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-xs">
                      <span className="text-secondary-recall">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-recall">{item.retained}</span>
                        <span className="font-medium text-primary-recall tabular-nums min-w-[2rem] text-right">
                          {item.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Delete account */}
            <div className="rounded-lg border border-grade-again/30 bg-grade-again/5 p-4">
              <h3 className="text-sm font-semibold text-grade-again flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Danger Zone
              </h3>
              <p className="mt-1 text-xs text-muted-recall">
                Permanently delete your account and all associated data. This cannot be undone.
              </p>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="mt-3 flex items-center gap-1.5 rounded-lg border border-grade-again/30 bg-grade-again/10 px-3 py-1.5 text-xs font-medium text-grade-again hover:bg-grade-again/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete my account
              </button>
            </div>
          </div>
        )}

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="space-y-4">
            <div className="rounded-lg border border-grade-again/30 bg-grade-again/5 p-4">
              <h3 className="text-sm font-semibold text-grade-again flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Confirm Permanent Deletion
              </h3>
              <p className="mt-2 text-sm text-secondary-recall">
                This will permanently delete:
              </p>
              <ul className="mt-2 space-y-1 text-xs text-muted-recall">
                <li>• All notes, notebooks, and tags</li>
                <li>• All flashcards, decks, and review history</li>
                <li>• All articles and highlights</li>
                <li>• All AI-generated summaries and embeddings</li>
                <li>• All comments and collaboration data</li>
                <li>• Your account and settings</li>
              </ul>
              <p className="mt-3 text-sm text-secondary-recall">
                Type your email <strong className="text-primary-recall">{data?.user?.email}</strong> to confirm:
              </p>
              <input
                type="email"
                value={confirmEmail}
                onChange={(e) => setConfirmEmail(e.target.value)}
                placeholder={data?.user?.email}
                className="mt-2 w-full rounded-lg border border-hairline bg-void px-3 py-2 text-sm focus:border-grade-again focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowDeleteConfirm(false); setConfirmEmail('') }}
                className="rounded-lg border border-hairline bg-card-surface px-4 py-2 text-sm font-medium text-secondary-recall hover:text-primary-recall"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmEmail)}
                disabled={confirmEmail !== data?.user?.email || deleteMutation.isPending}
                className="flex items-center gap-1.5 rounded-lg bg-grade-again px-4 py-2 text-sm font-medium text-void hover:bg-grade-again/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleteMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</>
                ) : deleteMutation.isSuccess ? (
                  <><CheckCircle className="h-4 w-4" /> Deleted</>
                ) : (
                  <><Trash2 className="h-4 w-4" /> Delete permanently</>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
