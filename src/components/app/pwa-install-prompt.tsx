'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'
import { toast } from 'sonner'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * PwaInstallPrompt — shows an "Add to Home Screen" banner when the
 * browser fires the beforeinstallprompt event (PWA install).
 *
 * Dismissed state is stored in localStorage so it doesn't nag.
 */
export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)

  useEffect(() => {
    // Don't show if previously dismissed
    const dismissed = localStorage.getItem('pwa-install-dismissed')
    if (dismissed === 'true') return

    const handler = (e: Event) => {
      e.preventDefault() // Prevent the default browser prompt
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setShowPrompt(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice
    if (choice.outcome === 'accepted') {
      toast.success('Installed! Find Recall on your home screen.')
    }
    setDeferredPrompt(null)
    setShowPrompt(false)
  }

  const handleDismiss = () => {
    localStorage.setItem('pwa-install-dismissed', 'true')
    setShowPrompt(false)
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-20 left-1/2 z-50 w-full max-w-sm -translate-x-1/2 px-4 animate-fade-in-up">
      <div className="flex items-center gap-3 rounded-2xl border border-hairline bg-card-surface p-3 shadow-floating">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-brand-dim text-accent-brand">
          <Download className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-primary-recall">Install Recall</p>
          <p className="text-xs text-muted-recall">Add to home screen for offline use</p>
        </div>
        <button
          onClick={handleInstall}
          className="rounded-lg bg-accent-brand px-3 py-1.5 text-xs font-medium text-void hover:bg-accent-brand/90"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="text-muted-recall hover:text-primary-recall"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
