'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAuth } from '@/hooks/use-auth'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Brain,
  ArrowRight,
  ArrowLeft,
  Check,
  GraduationCap,
  Languages,
  Briefcase,
  Heart,
  School,
  Clock,
  Sparkles,
} from 'lucide-react'
import type { ApiOnboarding } from '@/lib/types'
import { toast } from 'sonner'

const STUDY_GOALS = [
  { id: 'exam', label: 'Pass an exam', icon: GraduationCap, description: 'GCSEs, A-levels, bar exam, certifications' },
  { id: 'language', label: 'Learn a language', icon: Languages, description: 'Vocabulary, grammar, listening' },
  { id: 'school', label: 'School / university', icon: School, description: 'Course material, lectures, revision' },
  { id: 'work', label: 'Professional skills', icon: Briefcase, description: 'Onboarding, certifications, domain knowledge' },
  { id: 'hobby', label: 'Personal interest', icon: Heart, description: 'Hobbies, reading notes, self-improvement' },
] as const

const EXPERIENCE_LEVELS = [
  { id: 'beginner', label: 'New to spaced repetition', description: 'I have not used flashcard apps before' },
  { id: 'intermediate', label: 'Some experience', description: 'I have used flashcard apps before' },
  { id: 'advanced', label: 'Experienced', description: 'I know FSRS / SM-2 and have a review habit' },
] as const

const INTEREST_SUGGESTIONS = [
  'Mathematics', 'Computer Science', 'Biology', 'Chemistry', 'Physics',
  'History', 'Languages', 'Medicine', 'Law', 'Engineering',
  'Psychology', 'Economics', 'Philosophy', 'Art', 'Music',
]

const DAILY_GOALS = [
  { minutes: 10, label: '10 min', description: 'Light · ~20 cards/day' },
  { minutes: 15, label: '15 min', description: 'Casual · ~30 cards/day' },
  { minutes: 30, label: '30 min', description: 'Regular · ~60 cards/day' },
  { minutes: 60, label: '1 hour', description: 'Serious · ~120 cards/day' },
] as const

/**
 * OnboardingFlow — multi-step personalization shown after first signup.
 * Collects: study goal, experience level, subject interests, daily time
 * commitment. Sets the daily review limit based on the time commitment
 * (1 card ≈ 30s, so dailyGoalMinutes * 2 = dailyReviewLimit).
 *
 * Skippable — the user can complete it later from Settings. Once
 * completed, the flow won't show again (controlled by the Onboarding
 * record's `completed` flag).
 */
export function OnboardingFlow() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const { setView } = useAppStore()

  const [step, setStep] = useState(0)
  const [studyGoal, setStudyGoal] = useState<string | null>(null)
  const [experienceLevel, setExperienceLevel] = useState<string | null>(null)
  const [interests, setInterests] = useState<string[]>([])
  const [customInterest, setCustomInterest] = useState('')
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(15)

  const totalSteps = 4

  const saveMutation = useMutation({
    mutationFn: (body: Partial<ApiOnboarding> & { completed?: boolean }) =>
      api<{ onboarding: ApiOnboarding }>('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  })

  const toggleInterest = (interest: string) => {
    setInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    )
  }

  const addCustomInterest = () => {
    const trimmed = customInterest.trim()
    if (!trimmed || interests.includes(trimmed)) return
    setInterests([...interests, trimmed])
    setCustomInterest('')
  }

  const next = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1)
    } else {
      // Final step — save and finish
      onFinish()
    }
  }

  const back = () => {
    if (step > 0) setStep(step - 1)
  }

  const onFinish = async () => {
    try {
      await saveMutation.mutateAsync({
        completed: true,
        studyGoal,
        experienceLevel,
        interests,
        dailyGoalMinutes,
      })
      qc.invalidateQueries({ queryKey: ['onboarding'] })
      qc.invalidateQueries({ queryKey: ['auth'] })
      toast.success('Welcome to Recall!')
      setView('home')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save')
    }
  }

  const onSkip = async () => {
    try {
      await saveMutation.mutateAsync({ completed: true })
      qc.invalidateQueries({ queryKey: ['onboarding'] })
      qc.invalidateQueries({ queryKey: ['auth'] })
    } catch {
      // ignore
    }
    setView('home')
  }

  const canProceed =
    step === 0 ? !!studyGoal :
    step === 1 ? !!experienceLevel :
    step === 2 ? interests.length > 0 :
    true

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas">
      <div className="absolute inset-0 -z-10 hero-gradient-fallback" aria-hidden="true" />

      {/* Top bar with skip */}
      <header className="mx-auto flex w-full max-w-2xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-brand text-void">
            <Brain className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">Recall</span>
        </div>
        <button
          onClick={onSkip}
          className="text-sm text-muted-recall transition hover:text-primary-recall"
        >
          Skip for now
        </button>
      </header>

      {/* Progress dots */}
      <div className="mx-auto mb-8 flex w-full max-w-2xl gap-2 px-6">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? 'bg-accent-brand' : 'bg-card-surface'
            }`}
            aria-hidden="true"
          />
        ))}
      </div>

      {/* Step content */}
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 pb-8">
        {step === 0 && (
          <Step
            title="What are you studying for?"
            subtitle="We'll tailor your review schedule and suggestions."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {STUDY_GOALS.map((g) => {
                const Icon = g.icon
                const selected = studyGoal === g.id
                return (
                  <button
                    key={g.id}
                    onClick={() => setStudyGoal(g.id)}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                      selected
                        ? 'border-accent-brand bg-accent-brand/10'
                        : 'border-hairline bg-card-surface hover:border-accent-brand/50'
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-accent-brand text-void' : 'bg-accent-brand/10 text-accent-brand'}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{g.label}</p>
                      <p className="mt-0.5 text-xs text-muted-recall">{g.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </Step>
        )}

        {step === 1 && (
          <Step
            title="How familiar are you with spaced repetition?"
            subtitle="This helps us set sensible defaults for your review load."
          >
            <div className="space-y-3">
              {EXPERIENCE_LEVELS.map((lvl) => {
                const selected = experienceLevel === lvl.id
                return (
                  <button
                    key={lvl.id}
                    onClick={() => setExperienceLevel(lvl.id)}
                    className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${
                      selected
                        ? 'border-accent-brand bg-accent-brand/10'
                        : 'border-hairline bg-card-surface hover:border-accent-brand/50'
                    }`}
                  >
                    <div className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${selected ? 'border-accent-brand bg-accent-brand text-void' : 'border-hairline'}`}>
                      {selected && <Check className="h-3 w-3" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{lvl.label}</p>
                      <p className="mt-0.5 text-xs text-muted-recall">{lvl.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </Step>
        )}

        {step === 2 && (
          <Step
            title="What subjects are you studying?"
            subtitle="Pick a few — we'll use these to suggest tags and organize your library."
          >
            <div className="mb-4 flex flex-wrap gap-2">
              {INTEREST_SUGGESTIONS.map((s) => {
                const selected = interests.includes(s)
                return (
                  <button
                    key={s}
                    onClick={() => toggleInterest(s)}
                    className={`rounded-full border px-3 py-1 text-sm transition ${
                      selected
                        ? 'border-accent-brand bg-accent-brand/10 text-accent-brand'
                        : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall'
                    }`}
                  >
                    {selected && <Check className="mr-1 inline h-3 w-3" aria-hidden="true" />}
                    {s}
                  </button>
                )
              })}
            </div>

            {/* Custom interest input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customInterest}
                onChange={(e) => setCustomInterest(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addCustomInterest()
                  }
                }}
                placeholder="Add your own subject…"
                className="flex-1 rounded-md border border-hairline bg-card-surface px-3 py-2 text-sm"
                aria-label="Custom subject"
              />
              <Button
                onClick={addCustomInterest}
                variant="ghost"
                className="border border-hairline bg-card-surface"
              >
                Add
              </Button>
            </div>

            {interests.length > 0 && (
              <p className="mt-3 text-xs text-muted-recall">
                {interests.length} subject{interests.length === 1 ? '' : 's'} selected
              </p>
            )}
          </Step>
        )}

        {step === 3 && (
          <Step
            title="How much time can you commit daily?"
            subtitle="We'll set your daily review limit based on this. You can change it later."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {DAILY_GOALS.map((g) => {
                const selected = dailyGoalMinutes === g.minutes
                const Icon = Clock
                return (
                  <button
                    key={g.minutes}
                    onClick={() => setDailyGoalMinutes(g.minutes)}
                    className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                      selected
                        ? 'border-accent-brand bg-accent-brand/10'
                        : 'border-hairline bg-card-surface hover:border-accent-brand/50'
                    }`}
                  >
                    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-accent-brand text-void' : 'bg-accent-brand/10 text-accent-brand'}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{g.label}</p>
                      <p className="mt-0.5 text-xs text-muted-recall">{g.description}</p>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Summary */}
            <Card className="mt-6 border border-accent-brand/30 bg-accent-brand/5 p-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-accent-brand" aria-hidden="true" />
                <p className="text-sm font-medium">Your study plan</p>
              </div>
              <ul className="mt-2 space-y-1 text-xs text-secondary-recall">
                <li>Goal: {STUDY_GOALS.find((g) => g.id === studyGoal)?.label ?? '—'}</li>
                <li>Experience: {EXPERIENCE_LEVELS.find((l) => l.id === experienceLevel)?.label ?? '—'}</li>
                <li>Subjects: {interests.length > 0 ? interests.join(', ') : '—'}</li>
                <li>Daily target: {dailyGoalMinutes} min (~{dailyGoalMinutes * 2} cards)</li>
              </ul>
            </Card>
          </Step>
        )}
      </main>

      {/* Navigation */}
      <footer
        className="sticky bottom-0 border-t border-hairline bg-canvas/95 backdrop-blur"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
          <Button
            variant="ghost"
            onClick={back}
            disabled={step === 0}
            className="border border-hairline bg-card-surface"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <p className="text-xs text-muted-recall">
            Step {step + 1} of {totalSteps}
          </p>
          <Button
            onClick={next}
            disabled={!canProceed || saveMutation.isPending}
            className="bg-accent-brand text-void hover:bg-accent-brand/90"
          >
            {step === totalSteps - 1 ? (
              saveMutation.isPending ? 'Saving…' : 'Get started'
            ) : (
              <>
                Next
                <ArrowRight className="ml-1 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </footer>
    </div>
  )
}

function Step({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div>
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-secondary-recall sm:text-base">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  )
}
