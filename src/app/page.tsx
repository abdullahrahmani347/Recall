'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore } from '@/stores/app-store'
import { useAuth } from '@/hooks/use-auth'
import { api } from '@/lib/api-client'
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
import { OnboardingFlow } from '@/components/app/onboarding-flow'
import { ViewTransition } from '@/components/app/view-transition'
import { CommandPalette } from '@/components/app/command-palette'
import { GraphView } from '@/components/app/graph-view'
import { Loader2 } from 'lucide-react'

// Use a mounted flag to skip the server-rendered content and only render
// the app after hydration. This avoids any hydration mismatch caused by
// persisted store state, theme classes, or auth cookies.
export default function Home() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    // Mark as mounted so we render the full app after hydration.
    // This is the standard "mounted" pattern for avoiding hydration mismatches
    // with persisted client state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const { user, view, isLoading } = useAuth()
  const setView = useAppStore((s) => s.setView)

  // Check onboarding status when user logs in.
  const { data: onboardingData, isLoading: onboardingLoading } = useQuery({
    queryKey: ['onboarding-check', user?.id],
    queryFn: () =>
      api<{ onboarding: { completed: boolean } | null }>('/api/onboarding'),
    enabled: !!user && mounted,
    staleTime: 60_000,
    retry: 1,
  })
  const needsOnboarding =
    !!user &&
    !onboardingLoading &&
    onboardingData !== undefined &&
    !onboardingData?.onboarding?.completed

  // Redirect logic based on auth state
  useEffect(() => {
    if (!mounted || isLoading) return
    if (!user && view !== 'landing' && view !== 'auth') {
      setView('landing')
    }
    if (user && (view === 'landing' || view === 'auth')) {
      setView('home')
    }
  }, [user, view, isLoading, setView, mounted])

  // Before mount, render a minimal skeleton to avoid hydration mismatch.
  // After mount, render the full app.
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-accent-brand" aria-label="Loading" />
      </div>
    )
  }

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

  // Show onboarding for new users (but allow them to skip into the app)
  if (needsOnboarding && view !== 'note-editor' && view !== 'review') {
    return <OnboardingFlow />
  }

  // FULL-SCREEN APP ROUTES (no bottom nav)
  if (view === 'note-editor') return <NoteEditor />
  if (view === 'review') return <ReviewSession />

  // APP SHELL ROUTES (with bottom nav)
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <ReminderBanner />
      <main id="main" className="flex-1">
        <ViewTransition key={view}>
          {view === 'home' && <HomeView />}
          {view === 'notes' && <NotesView />}
          {view === 'graph' && <GraphView />}
          {view === 'decks' && <DecksView />}
          {view === 'card-editor' && <CardEditor />}
          {view === 'search' && <SearchView />}
          {view === 'analytics' && <AnalyticsView />}
          {view === 'settings' && <SettingsView />}
        </ViewTransition>
      </main>
      <BottomNav />
      <CommandPalette />
    </div>
  )
}
