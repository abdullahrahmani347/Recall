'use client'

import { useEffect } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useAuth } from '@/hooks/use-auth'
import { LandingPage } from '@/components/landing/landing-page'
import { AuthScreen } from '@/components/auth/auth-screen'
import { BottomNav } from '@/components/app/bottom-nav'
import { HomeView } from '@/components/app/home-view'
import { NotesView } from '@/components/app/notes-view'
import { NoteEditor } from '@/components/app/note-editor'
import { DecksView } from '@/components/app/decks-view'
import { CardEditor } from '@/components/app/card-editor'
import { ReviewSession } from '@/components/app/review-session'
import { SearchView } from '@/components/app/search-view'
import { SettingsView } from '@/components/app/settings-view'
import { AnalyticsView } from '@/components/app/analytics-view'
import { ReminderBanner } from '@/components/app/reminder-banner'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const { user, view, isLoading } = useAuth()
  const setView = useAppStore((s) => s.setView)

  // Redirect logic based on auth state
  useEffect(() => {
    if (isLoading) return
    if (!user && view !== 'landing' && view !== 'auth') {
      setView('landing')
    }
    if (user && (view === 'landing' || view === 'auth')) {
      setView('home')
    }
  }, [user, view, isLoading, setView])

  // First-load splash — only show briefly while the auth query resolves
  if (isLoading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-accent-brand" aria-label="Loading" />
      </div>
    )
  }

  // PUBLIC ROUTES
  if (!user) {
    if (view === 'auth') return <AuthScreen />
    return <LandingPage />
  }

  // FULL-SCREEN APP ROUTES (no bottom nav)
  if (view === 'note-editor') return <NoteEditor />
  if (view === 'review') return <ReviewSession />

  // APP SHELL ROUTES (with bottom nav)
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <ReminderBanner />
      <main id="main" className="flex-1">
        {view === 'home' && <HomeView />}
        {view === 'notes' && <NotesView />}
        {view === 'decks' && <DecksView />}
        {view === 'card-editor' && <CardEditor />}
        {view === 'search' && <SearchView />}
        {view === 'analytics' && <AnalyticsView />}
        {view === 'settings' && <SettingsView />}
      </main>
      <BottomNav />
    </div>
  )
}
