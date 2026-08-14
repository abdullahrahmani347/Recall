'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, apiDownload, apiUpload } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Input } from '@/components/ui/input'
import {
  Sun,
  Moon,
  Download,
  Upload,
  LogOut,
  RotateCw,
  Sparkles,
  Loader2,
  Bell,
  Package,
  Shield,
} from 'lucide-react'
import type { ApiSettings } from '@/lib/types'
import { useTheme } from 'next-themes'
import { toast } from 'sonner'

export function SettingsView() {
  const qc = useQueryClient()
  const { user, logout } = useAuth()
  const { setView } = useAppStore()
  const { theme, setTheme } = useTheme()

  const { data } = useQuery<{ settings: ApiSettings | null }>({
    queryKey: ['settings'],
    queryFn: () => api('/api/settings'),
  })

  const [local, setLocal] = useState<ApiSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (data?.settings) {
      setLocal(data.settings)
      // Sync theme toggle to next-themes
      setTheme(data.settings.theme)
    }
  }, [data, setTheme])

  const update = useMutation({
    mutationFn: (body: Partial<ApiSettings>) =>
      api<{ settings: ApiSettings }>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  })

  const onChange = async (patch: Partial<ApiSettings>) => {
    if (!local) return
    const next = { ...local, ...patch }
    setLocal(next)
    setSaving(true)
    try {
      await update.mutateAsync(patch)
      qc.invalidateQueries({ queryKey: ['settings'] })
      qc.invalidateQueries({ queryKey: ['auth'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
      setLocal(local) // rollback
    } finally {
      setSaving(false)
    }
  }

  const onExport = async (format: 'markdown' | 'json' | 'csv' | 'apkg' | 'gdpr') => {
    try {
      const blob = await apiDownload(`/api/export?format=${format}`)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'markdown' ? 'md' : format === 'csv' ? 'csv' : format === 'apkg' ? 'apkg' : 'json'
      a.download = format === 'gdpr'
        ? `recall-gdpr-export-${new Date().toISOString().slice(0, 10)}.json`
        : `recall-export.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Export downloaded')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const onImport = async (file: File, format: 'markdown' | 'json') => {
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('format', format)
      const res = await apiUpload<{ notesCreated: number; tagsCreated: number }>(
        '/api/import',
        fd
      )
      toast.success(
        `Imported ${res.notesCreated} note${res.notesCreated === 1 ? '' : 's'}${
          res.tagsCreated ? `, ${res.tagsCreated} tag${res.tagsCreated === 1 ? '' : 's'}` : ''
        }`
      )
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['tags'] })
      qc.invalidateQueries({ queryKey: ['stats'] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  const onLogout = async () => {
    await logout()
    setView('landing')
  }

  if (!local) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-recall" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-8 pt-6 sm:px-6 sm:pt-8">
      <header className="mb-6 animate-fade-in-up">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">Account</p>
        <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1.5 text-sm text-secondary-recall">{user?.email}</p>
      </header>

      {/* APPEARANCE */}
      <Card className="mb-4 border-hairline bg-card-surface p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-recall">
          Appearance
        </h2>

        <div className="space-y-4">
          <div>
            <Label className="text-sm">Theme</Label>
            <p className="mb-2 text-xs text-muted-recall">Dark is the default canvas for Recall.</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setTheme('dark')
                  onChange({ theme: 'dark' })
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm transition ${
                  theme === 'dark'
                    ? 'border-accent-brand bg-accent-brand/10 text-accent-brand'
                    : 'border-hairline bg-void text-secondary-recall hover:text-primary-recall'
                }`}
              >
                <Moon className="h-4 w-4" aria-hidden="true" />
                Dark
              </button>
              <button
                onClick={() => {
                  setTheme('light')
                  onChange({ theme: 'light' })
                }}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl border p-3 text-sm transition ${
                  theme === 'light'
                    ? 'border-accent-brand bg-accent-brand/10 text-accent-brand'
                    : 'border-hairline bg-void text-secondary-recall hover:text-primary-recall'
                }`}
              >
                <Sun className="h-4 w-4" aria-hidden="true" />
                Light
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm">Reduce motion</Label>
              <p className="text-xs text-muted-recall">
                Disable animations and the 3D hero. Recommended for vestibular sensitivity.
              </p>
            </div>
            <Switch
              checked={local.reducedMotion}
              onCheckedChange={(v) => onChange({ reducedMotion: v })}
              aria-label="Reduce motion"
            />
          </div>
        </div>
      </Card>

      {/* STUDY */}
      <Card className="mb-4 border-hairline bg-card-surface p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-recall">
          Study
        </h2>

        <div className="space-y-5">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm">Daily review limit</Label>
              <span className="text-sm tabular-nums text-accent-brand">
                {local.dailyReviewLimit}
              </span>
            </div>
            <Slider
              value={[local.dailyReviewLimit]}
              min={10}
              max={500}
              step={10}
              onValueChange={([v]) => onChange({ dailyReviewLimit: v })}
              aria-label="Daily review limit"
            />
            <p className="mt-1 text-xs text-muted-recall">
              Maximum cards shown per review session.
            </p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm">Daily new-card limit</Label>
              <span className="text-sm tabular-nums text-accent-brand">
                {local.dailyNewCardLimit}
              </span>
            </div>
            <Slider
              value={[local.dailyNewCardLimit]}
              min={5}
              max={100}
              step={5}
              onValueChange={([v]) => onChange({ dailyNewCardLimit: v })}
              aria-label="Daily new-card limit"
            />
            <p className="mt-1 text-xs text-muted-recall">
              Maximum new cards introduced per day (Phase 2 enforcement).
            </p>
          </div>

          <div>
            <Label htmlFor="tz" className="text-sm">Timezone</Label>
            <Input
              id="tz"
              value={local.timezone}
              onChange={(e) => onChange({ timezone: e.target.value })}
              className="mt-1 bg-void"
              placeholder="UTC"
            />
            <p className="mt-1 text-xs text-muted-recall">
              Used for streak / daily-reset calculations.
            </p>
          </div>
        </div>
      </Card>

      {/* AI PRIVACY */}
      <Card className="mb-4 border-hairline bg-card-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-accent-brand" aria-hidden="true" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-recall">
            AI & Privacy
          </h2>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label className="text-sm">Opt out of AI processing</Label>
            <p className="text-xs text-muted-recall">
              When enabled, the &quot;Summarize&quot; and &quot;Generate cards&quot; actions
              are disabled. Your note content is never sent to the LLM provider.
            </p>
          </div>
          <Switch
            checked={local.aiProcessingOptOut}
            onCheckedChange={(v) => onChange({ aiProcessingOptOut: v })}
            aria-label="Opt out of AI processing"
          />
        </div>
      </Card>

      {/* REMINDERS (Phase 2) */}
      <Card className="mb-4 border-hairline bg-card-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4 text-accent-warm" aria-hidden="true" />
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-recall">
            Reminders
          </h2>
        </div>
        <div className="space-y-4">
          <div>
            <Label htmlFor="reminder-time" className="text-sm">Daily reminder time</Label>
            <p className="mb-2 text-xs text-muted-recall">
              Show an in-app banner when you have due cards at this time. Leave blank to disable.
            </p>
            <div className="flex items-center gap-2">
              <Input
                id="reminder-time"
                type="time"
                value={local.reminderTime ?? ''}
                onChange={(e) => {
                  const v = e.target.value || null
                  onChange({ reminderTime: v })
                }}
                className="bg-void"
              />
              {local.reminderTime && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange({ reminderTime: null })}
                  className="border border-hairline bg-void text-muted-recall"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <Label className="text-sm">Email reminders</Label>
              <p className="text-xs text-muted-recall">
                When enabled, you&apos;ll receive a daily email digest of due cards at your
                reminder time. Requires an SMTP provider (Phase 2 — in-app banner is active now).
              </p>
            </div>
            <Switch
              checked={local.reminderEmailEnabled}
              onCheckedChange={(v) => onChange({ reminderEmailEnabled: v })}
              disabled={!local.reminderTime}
              aria-label="Email reminders"
            />
          </div>

          {local.reminderEmailEnabled && (
            <div>
              <Label htmlFor="reminder-email" className="text-sm">Reminder email (optional)</Label>
              <Input
                id="reminder-email"
                type="email"
                value={local.reminderEmail ?? ''}
                onChange={(e) => onChange({ reminderEmail: e.target.value || null })}
                placeholder={user?.email ?? 'you@example.com'}
                className="mt-1 bg-void"
              />
            </div>
          )}
        </div>
      </Card>

      {/* DATA */}
      <Card className="mb-4 border-hairline bg-card-surface p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-recall">
          Data
        </h2>

        <div className="space-y-3">
          <div>
            <Label className="text-sm">Export library</Label>
            <p className="mb-2 text-xs text-muted-recall">
              Download all your notes, tags, decks, and cards.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                onClick={() => onExport('markdown')}
                className="border border-hairline bg-void"
                size="sm"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                Markdown
              </Button>
              <Button
                variant="ghost"
                onClick={() => onExport('json')}
                className="border border-hairline bg-void"
                size="sm"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                JSON
              </Button>
              <Button
                variant="ghost"
                onClick={() => onExport('csv')}
                className="border border-hairline bg-void"
                size="sm"
              >
                <Download className="mr-1 h-3.5 w-3.5" />
                CSV
              </Button>
              <Button
                variant="ghost"
                onClick={() => onExport('apkg')}
                className="border border-hairline bg-void"
                size="sm"
              >
                <Package className="mr-1 h-3.5 w-3.5" />
                Anki (.apkg)
              </Button>
              <Button
                variant="ghost"
                onClick={() => onExport('gdpr')}
                className="border border-accent-brand/30 bg-accent-brand-dim text-accent-brand"
                size="sm"
              >
                <Shield className="mr-1 h-3.5 w-3.5" />
                GDPR Data Download
              </Button>
            </div>
          </div>

          <div className="border-t border-hairline pt-3">
            <Label className="text-sm">Import notes</Label>
            <p className="mb-2 text-xs text-muted-recall">
              Import a single Markdown file (becomes one note) or a JSON export.
            </p>
            <div className="flex gap-2">
              <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-hairline bg-void px-3 text-xs font-medium transition hover:text-accent-brand">
                <Upload className="h-3.5 w-3.5" />
                Markdown
                <input
                  type="file"
                  accept=".md,text/markdown"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onImport(f, 'markdown')
                    e.target.value = ''
                  }}
                  disabled={importing}
                />
              </label>
              <label className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-hairline bg-void px-3 text-xs font-medium transition hover:text-accent-brand">
                <Upload className="h-3.5 w-3.5" />
                JSON
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) onImport(f, 'json')
                    e.target.value = ''
                  }}
                  disabled={importing}
                />
              </label>
              {importing && (
                <Loader2 className="h-4 w-4 animate-spin text-accent-brand" aria-hidden="true" />
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ACCOUNT */}
      <Card className="border-hairline bg-card-surface p-5">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-recall">
          Account
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            onClick={async () => {
              try {
                await api('/api/onboarding', {
                  method: 'POST',
                  body: JSON.stringify({ completed: false }),
                })
                qc.invalidateQueries({ queryKey: ['onboarding-check'] })
                qc.invalidateQueries({ queryKey: ['onboarding'] })
                toast.success('Onboarding reset — reload to retake')
                setTimeout(() => window.location.reload(), 1000)
              } catch {
                toast.error('Failed to reset onboarding')
              }
            }}
            className="border border-hairline bg-void text-secondary-recall hover:text-primary-recall"
            size="sm"
          >
            <RotateCw className="mr-1 h-3.5 w-3.5" />
            Retake onboarding
          </Button>
          <Button
            variant="ghost"
            onClick={() => window.dispatchEvent(new CustomEvent('recall-privacy'))}
            className="border border-hairline bg-void text-secondary-recall hover:text-primary-recall"
            size="sm"
          >
            <Shield className="mr-1 h-3.5 w-3.5" />
            Your Data
          </Button>
          <Button
            variant="ghost"
            onClick={onLogout}
            className="border border-hairline bg-void text-grade-again hover:bg-grade-again/10"
            size="sm"
          >
            <LogOut className="mr-1 h-3.5 w-3.5" />
            Log out
          </Button>
        </div>
      </Card>

      {saving && (
        <p className="mt-4 text-center text-xs text-muted-recall">
          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" aria-hidden="true" />
          Saving…
        </p>
      )}

      <p className="mt-8 text-center text-[10px] text-muted-recall">
        Recall · FSRS-4.5 scheduler · SSE streaming · TF-IDF semantic search · .apkg export
      </p>
    </div>
  )
}
