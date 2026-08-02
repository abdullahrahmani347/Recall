'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Plus, FileText, Trash2, BookOpen, Check, X } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'

interface ArticleListItem {
  id: string
  title: string
  sourceUrl: string | null
  createdAt: string
  totalSections: number
  readSections: number
  totalHighlights: number
  progress: number
}

/**
 * ArticlesView — list of articles + create new article flow.
 * Shows reading progress, highlight count, and a "New article" button
 * that opens a paste-text modal.
 */
export function ArticlesView() {
  const qc = useQueryClient()
  const { setView } = useAppStore()
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')

  const { data, isLoading } = useQuery<{ articles: ArticleListItem[] }>({
    queryKey: ['articles'],
    queryFn: () => api('/api/articles'),
  })

  const createMutation = useMutation({
    mutationFn: (body: { title: string; content: string; sourceUrl?: string }) =>
      api<{ article: { id: string } }>('/api/articles', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['articles'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
      toast.success('Article imported — split into sections')
      setShowCreate(false)
      setTitle('')
      setContent('')
      setSourceUrl('')
      // Open the reader
      sessionStorage.setItem('recall-article-id', res.article.id)
      setView('article-reader')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/api/articles/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['articles'] })
      toast.success('Article deleted')
    },
  })

  const articles = data?.articles ?? []

  const onCreate = async () => {
    if (!title.trim() || !content.trim()) return
    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        content: content.trim(),
        sourceUrl: sourceUrl.trim() || undefined,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to import')
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
      <header className="mb-6 flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">
            Incremental reading
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Articles
          </h1>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand"
        >
          <Plus className="mr-1.5 h-4 w-4" />
          New article
        </Button>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-hairline bg-card-surface p-4">
              <div className="h-4 w-1/3 shimmer rounded" />
              <div className="mt-3 h-2.5 w-1/2 shimmer rounded" />
            </div>
          ))}
        </div>
      ) : articles.length === 0 ? (
        <Card className="border border-dashed border-hairline bg-card-surface/50 p-10 text-center animate-fade-in">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-brand-dim text-accent-brand">
            <BookOpen size={28} />
          </div>
          <p className="font-medium">Paste an article to start reading</p>
          <p className="mt-1.5 text-sm text-secondary-recall">
            Paste a textbook chapter, research paper, or blog post. We&apos;ll split it into
            sections, and you can highlight key sentences that become flashcards.
          </p>
          <Button
            onClick={() => setShowCreate(true)}
            className="mt-5 bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Import article
          </Button>
        </Card>
      ) : (
        <ul className="space-y-2">
          {articles.map((article, i) => (
            <li
              key={article.id}
              className="animate-fade-in-up"
              style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}
            >
              <Card className="border-hairline bg-card-surface p-4 card-lift">
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => {
                      sessionStorage.setItem('recall-article-id', article.id)
                      setView('article-reader')
                    }}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-recall" />
                      <p className="truncate font-medium">{article.title}</p>
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-xs text-muted-recall">
                      <span>{article.totalSections} sections</span>
                      <span>·</span>
                      <span>{article.totalHighlights} highlights</span>
                      <span>·</span>
                      <span>{formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-border-hairline">
                      <div
                        className="h-full rounded-full bg-accent-brand"
                        style={{ width: `${article.progress}%` }}
                      />
                    </div>
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!confirm('Delete this article and all its highlights?')) return
                      await deleteMutation.mutateAsync(article.id)
                    }}
                    className="h-8 w-8 shrink-0 p-0 text-muted-recall hover:text-grade-again"
                    aria-label="Delete article"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {/* Create modal */}
      {showCreate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-t-3xl border border-hairline bg-card-surface p-5 shadow-panel animate-fade-in-up sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Import article"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Import article</h2>
              <button
                onClick={() => setShowCreate(false)}
                className="rounded-md p-1 text-muted-recall hover:text-primary-recall"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto scrollbar-thin">
              <div>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Article title"
                  className="bg-void"
                  autoFocus
                />
              </div>
              <div>
                <Input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  placeholder="Source URL (optional)"
                  className="bg-void"
                />
              </div>
              <div>
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Paste the article text here…"
                  className="min-h-[200px] resize-none bg-void"
                />
                <p className="mt-1 text-xs text-muted-recall">
                  {content.trim().split(/\s+/).filter(Boolean).length} words
                </p>
              </div>
            </div>

            <Button
              onClick={onCreate}
              disabled={!title.trim() || content.trim().length < 100 || createMutation.isPending}
              className="mt-4 w-full bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand"
            >
              {createMutation.isPending ? 'Splitting into sections…' : 'Import & split'}
            </Button>
            {content.trim().length < 100 && content.trim().length > 0 && (
              <p className="mt-2 text-center text-xs text-muted-recall">
                Need at least 100 characters
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
