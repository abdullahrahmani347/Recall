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
import { QuickCapture } from '@/components/app/quick-capture'
import { GraphView } from '@/components/app/graph-view'
import { ArticlesView } from '@/components/app/articles-view'
import { ArticleReader } from '@/components/app/article-reader'
import { useKeyboardShortcuts, ShortcutsHelpModal } from '@/hooks/use-keyboard-shortcuts'
import { TemplatePicker } from '@/components/app/template-picker'
import { CustomStudyPicker } from '@/components/app/custom-study-picker'
import { StudyPlanGenerator } from '@/components/app/study-plan-generator'
import { Loader2 } from 'lucide-react'

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showCustomStudy, setShowCustomStudy] = useState(false)
  const [showStudyPlan, setShowStudyPlan] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true)
  }, [])

  const { user, view, isLoading } = useAuth()
  const setView = useAppStore((s) => s.setView)
  const openNote = useAppStore((s) => s.openNote)
  const { showHelp, setShowHelp } = useKeyboardShortcuts()

  useEffect(() => {
    const onNewNote = () => setShowTemplatePicker(true)
    window.addEventListener('recall-new-note', onNewNote)
    return () => window.removeEventListener('recall-new-note', onNewNote)
  }, [])

  useEffect(() => {
    const onCustomStudy = () => setShowCustomStudy(true)
    window.addEventListener('recall-custom-study', onCustomStudy)
    return () => window.removeEventListener('recall-custom-study', onCustomStudy)
  }, [])

  useEffect(() => {
    const onStudyPlan = () => setShowStudyPlan(true)
    window.addEventListener('recall-study-plan', onStudyPlan)
    return () => window.removeEventListener('recall-study-plan', onStudyPlan)
  }, [])

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

  useEffect(() => {
    if (!mounted || isLoading) return
    if (!user && view !== 'landing' && view !== 'auth') {
      setView('landing')
    }
    if (user && (view === 'landing' || view === 'auth')) {
      setView('home')
    }
  }, [user, view, isLoading, setView, mounted])

  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-accent-brand" aria-label="Loading" />
      </div>
    )
  }

  if (isLoading && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-accent-brand" aria-label="Loading" />
      </div>
    )
  }

  if (!user) {
    if (view === 'auth') return <AuthScreen />
    return <LandingPage />
  }

  if (needsOnboarding && view !== 'note-editor' && view !== 'review') {
    return <OnboardingFlow />
  }

  if (view === 'note-editor') return <NoteEditor />
  if (view === 'review') return <ReviewSession />
  if (view === 'article-reader') return <ArticleReader articleId={sessionStorage.getItem('recall-article-id') || ''} />

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <ReminderBanner />
      <main id="main" className="flex-1">
        <ViewTransition key={view}>
          {view === 'home' && <HomeView />}
          {view === 'notes' && <NotesView />}
          {view === 'graph' && <GraphView />}
          {view === 'articles' && <ArticlesView />}
          {view === 'decks' && <DecksView />}
          {view === 'card-editor' && <CardEditor />}
          {view === 'search' && <SearchView />}
          {view === 'analytics' && <AnalyticsView />}
          {view === 'settings' && <SettingsView />}
        </ViewTransition>
      </main>
      <BottomNav />
      <CommandPalette />
      <QuickCapture />
      <ShortcutsHelpModal open={showHelp} onClose={() => setShowHelp(false)} />
      {showTemplatePicker && (
        <TemplatePicker
          onPick={(template) => {
            setShowTemplatePicker(false)
            sessionStorage.setItem('recall-template-title', template.title)
            sessionStorage.setItem('recall-template-content', template.content)
            openNote(null)
          }}
          onClose={() => setShowTemplatePicker(false)}
        />
      )}
      {showCustomStudy && (
        <CustomStudyPicker
          deckId={null}
          onClose={() => setShowCustomStudy(false)}
        />
      )}
      {showStudyPlan && (
        <StudyPlanGenerator onClose={() => setShowStudyPlan(false)} />
      )}
    </div>
  )
}
