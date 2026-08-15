'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
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
import { ReminderBanner } from '@/components/app/reminder-banner'
import { OnboardingFlow } from '@/components/app/onboarding-flow'
import { ViewTransition } from '@/components/app/view-transition'
import { CommandPalette } from '@/components/app/command-palette'
import { QuickCapture } from '@/components/app/quick-capture'
import { useKeyboardShortcuts, ShortcutsHelpModal } from '@/hooks/use-keyboard-shortcuts'
import { TemplatePicker } from '@/components/app/template-picker'
import { CustomStudyPicker } from '@/components/app/custom-study-picker'
import { ErrorBoundary } from '@/components/providers/error-boundary'
import { PwaInstallPrompt } from '@/components/app/pwa-install-prompt'
import { Loader2 } from 'lucide-react'

// Lazy load heavy, rarely-used views to reduce initial bundle
const AnalyticsView = dynamic(() => import('@/components/app/analytics-view').then(m => ({ default: m.AnalyticsView })), { loading: () => <Loader2 className="h-6 w-6 animate-spin text-accent-brand" /> })
const GraphView = dynamic(() => import('@/components/app/graph-view').then(m => ({ default: m.GraphView })), { loading: () => <Loader2 className="h-6 w-6 animate-spin text-accent-brand" /> })
const ArticlesView = dynamic(() => import('@/components/app/articles-view').then(m => ({ default: m.ArticlesView })), { loading: () => <Loader2 className="h-6 w-6 animate-spin text-accent-brand" /> })
const ArticleReader = dynamic(() => import('@/components/app/article-reader').then(m => ({ default: m.ArticleReader })), { loading: () => <Loader2 className="h-6 w-6 animate-spin text-accent-brand" /> })
const OcrNoteCreator = dynamic(() => import('@/components/app/ocr-note-creator').then(m => ({ default: m.OcrNoteCreator })), { ssr: false })
const ConceptMap = dynamic(() => import('@/components/app/concept-map').then(m => ({ default: m.ConceptMap })), { ssr: false })
const AdaptiveDifficulty = dynamic(() => import('@/components/app/adaptive-difficulty').then(m => ({ default: m.AdaptiveDifficulty })), { ssr: false })
const PrivacyDashboard = dynamic(() => import('@/components/app/privacy-dashboard').then(m => ({ default: m.PrivacyDashboard })), { ssr: false })
const GuidedTour = dynamic(() => import('@/components/app/guided-tour').then(m => ({ default: m.GuidedTour })), { ssr: false })

export default function Home() {
  const [mounted, setMounted] = useState(false)
  const [showTemplatePicker, setShowTemplatePicker] = useState(false)
  const [showCustomStudy, setShowCustomStudy] = useState(false)
  const [showOcr, setShowOcr] = useState(false)
  const [showConceptMap, setShowConceptMap] = useState(false)
  const [showAdaptiveDifficulty, setShowAdaptiveDifficulty] = useState(false)
  const [showPrivacy, setShowPrivacy] = useState(false)
  const [showTour, setShowTour] = useState(false)

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
    const onOcr = () => setShowOcr(true)
    window.addEventListener('recall-ocr', onOcr)
    return () => window.removeEventListener('recall-ocr', onOcr)
  }, [])

  useEffect(() => {
    const onConceptMap = () => setShowConceptMap(true)
    window.addEventListener('recall-concept-map', onConceptMap)
    return () => window.removeEventListener('recall-concept-map', onConceptMap)
  }, [])

  useEffect(() => {
    const onAdaptiveDifficulty = () => setShowAdaptiveDifficulty(true)
    window.addEventListener('recall-adaptive-difficulty', onAdaptiveDifficulty)
    return () => window.removeEventListener('recall-adaptive-difficulty', onAdaptiveDifficulty)
  }, [])

  useEffect(() => {
    const onPrivacy = () => setShowPrivacy(true)
    window.addEventListener('recall-privacy', onPrivacy)
    return () => window.removeEventListener('recall-privacy', onPrivacy)
  }, [])

  useEffect(() => {
    const onTour = () => setShowTour(true)
    window.addEventListener('recall-start-tour', onTour)
    // Auto-start tour for new users who haven't completed it
    const tourCompleted = localStorage.getItem('guided-tour-completed')
    if (!tourCompleted) {
      // Check if user just finished onboarding
      const onboardingJustCompleted = sessionStorage.getItem('onboarding-just-completed')
      if (onboardingJustCompleted === 'true') {
        sessionStorage.removeItem('onboarding-just-completed')
        setTimeout(() => setShowTour(true), 500)
      }
    }
    return () => window.removeEventListener('recall-start-tour', onTour)
  }, [])

  // Listen for navigation events from the guided tour
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const view = (e as CustomEvent).detail as string
      setView(view as any)
    }
    window.addEventListener('recall-navigate', onNavigate as EventListener)
    return () => window.removeEventListener('recall-navigate', onNavigate as EventListener)
  }, [setView])

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

  if (view === 'note-editor') return <ErrorBoundary><NoteEditor /></ErrorBoundary>
  if (view === 'review') return <ErrorBoundary><ReviewSession /></ErrorBoundary>
  if (view === 'article-reader') return <ErrorBoundary><ArticleReader articleId={sessionStorage.getItem('recall-article-id') || ''} /></ErrorBoundary>

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <ReminderBanner />
      <main id="main" className="flex-1">
        <ErrorBoundary>
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
        </ErrorBoundary>
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
      {showOcr && <OcrNoteCreator onClose={() => setShowOcr(false)} />}
      {showConceptMap && <ConceptMap onClose={() => setShowConceptMap(false)} />}
      {showAdaptiveDifficulty && <AdaptiveDifficulty onClose={() => setShowAdaptiveDifficulty(false)} />}
      {showPrivacy && <PrivacyDashboard onClose={() => setShowPrivacy(false)} />}
      <PwaInstallPrompt />
      {showTour && <GuidedTour onClose={() => setShowTour(false)} />}
    </div>
  )
}
