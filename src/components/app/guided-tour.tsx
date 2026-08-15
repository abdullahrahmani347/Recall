'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, Check, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface TourStep {
  target: string // CSS selector for the element to highlight
  title: string
  description: string
  view?: string // app view to navigate to before showing this step
  action?: string // optional action label for interactive demo
}

const TOUR_STEPS: TourStep[] = [
  {
    target: '[data-tour="home-header"]',
    title: 'Welcome to Recall!',
    description: 'Your personal study companion. Capture notes, generate flashcards, and review with spaced repetition. Let\'s take a quick tour of the key features.',
    view: 'home',
  },
  {
    target: '[data-tour="start-review"]',
    title: 'Review Your Cards',
    description: 'Start a review session here. Recall uses the FSRS-4.5 algorithm to schedule cards at the optimal time for long-term retention.',
    view: 'home',
  },
  {
    target: '[data-tour="quick-actions"]',
    title: 'Quick Actions',
    description: 'Create new notes, read articles, or manage flashcard decks from this panel. You can also scan images with AI (OCR) and generate concept maps.',
    view: 'home',
  },
  {
    target: '[data-tour="streak"]',
    title: 'Build Your Streak',
    description: 'Review daily to build your streak. You get one freeze per week to protect it if you miss a day. Consistency is the key to remembering!',
    view: 'home',
  },
  {
    target: '[data-tour="bottom-nav"]',
    title: 'Navigate the App',
    description: 'Use these tabs to switch between Home, Notes, Graph, Decks, Search, Analytics, and Settings. Try clicking through them!',
    view: 'home',
  },
  {
    target: '[data-tour="notes-create"]',
    title: 'Create Your First Note',
    description: 'Click here to create a new note. The rich text editor supports markdown, [[wiki links]], and inline flashcard creation with :: syntax.',
    view: 'notes',
  },
  {
    target: '[data-tour="bottom-nav"]',
    title: 'Explore Decks & Review',
    description: 'Head to the Decks tab to see your flashcard collections, or start a review session. The AI can generate cards from your notes automatically!',
    view: 'decks',
  },
  {
    target: '[data-tour="ai-features"]',
    title: 'AI-Powered Features',
    description: 'Recall includes AI summaries, smart tag suggestions, OCR (scan photos to notes), concept maps, adaptive difficulty analysis, and natural language search.',
    view: 'home',
  },
  {
    target: '[data-tour="settings"]',
    title: 'Customize Your Experience',
    description: 'Adjust daily review limits, theme, reminders, and export your data. You can also retake this tour anytime from Settings.',
    view: 'settings',
  },
]

interface GuidedTourProps {
  onClose: () => void
}

export function GuidedTour({ onClose }: GuidedTourProps) {
  const [stepIndex, setStepIndex] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [showFeedback, setShowFeedback] = useState(false)
  const [feedback, setFeedback] = useState('')
  const observerRef = useRef<MutationObserver | null>(null)

  const step = TOUR_STEPS[stepIndex]
  const totalSteps = TOUR_STEPS.length
  const isLastStep = stepIndex === totalSteps - 1

  // Navigate to the correct view and find the target element
  const navigateAndHighlight = useCallback(async (stepData: TourStep) => {
    if (stepData.view) {
      // Dispatch a custom event to change the view
      window.dispatchEvent(new CustomEvent('recall-navigate', { detail: stepData.view }))
      // Wait for the view to render
      await new Promise(resolve => setTimeout(resolve, 400))
    }

    // Find the target element
    const findTarget = () => {
      const el = document.querySelector(stepData.target)
      if (el) {
        setTargetRect(el.getBoundingClientRect())
        return true
      }
      return false
    }

    // Try immediately, then retry a few times
    if (!findTarget()) {
      let retries = 0
      const interval = setInterval(() => {
        if (findTarget() || retries >= 10) {
          clearInterval(interval)
        }
        retries++
      }, 200)
    }
  }, [])

  useEffect(() => {
    navigateAndHighlight(step)
  }, [step, navigateAndHighlight])

  // Update target position on scroll/resize
  useEffect(() => {
    const updatePosition = () => {
      const el = document.querySelector(step.target)
      if (el) {
        setTargetRect(el.getBoundingClientRect())
      }
    }

    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [step.target])

  const handleNext = () => {
    if (isLastStep) {
      setShowFeedback(true)
    } else {
      setStepIndex(prev => prev + 1)
    }
  }

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(prev => prev - 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('guided-tour-completed', 'skipped')
    onClose()
  }

  const handleFinish = () => {
    localStorage.setItem('guided-tour-completed', 'completed')
    if (feedback.trim()) {
      toast.success('Thanks for your feedback!')
    }
    onClose()
  }

  // Calculate tooltip position based on target element
  const getTooltipPosition = () => {
    if (!targetRect) {
      return { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
    }

    const padding = 16
    const tooltipWidth = 360
    const tooltipHeight = 220

    // Try to position below the target, centered
    let top = targetRect.bottom + padding
    let left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2

    // If not enough space below, position above
    if (top + tooltipHeight > window.innerHeight) {
      top = targetRect.top - tooltipHeight - padding
    }

    // Clamp horizontally
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding))

    // Clamp vertically
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding))

    return { top: `${top}px`, left: `${left}px` }
  }

  const getSpotlightStyle = () => {
    if (!targetRect) return null
    const padding = 8
    return {
      left: targetRect.left - padding,
      top: targetRect.top - padding,
      width: targetRect.width + padding * 2,
      height: targetRect.height + padding * 2,
    }
  }

  if (showFeedback) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="w-full max-w-md rounded-2xl border border-hairline bg-card-surface p-6 shadow-floating animate-scale-in">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-brand-dim text-accent-brand">
              <Check className="h-5 w-5" />
            </div>
            <h2 className="font-display text-lg font-semibold">Tour Complete!</h2>
          </div>
          <p className="mb-4 text-sm text-muted-recall">
            You\'re all set to start learning with Recall. How was the tour? Any suggestions to improve it?
          </p>
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Share your thoughts (optional)…"
            className="mb-4 min-h-[80px] w-full resize-none rounded-lg border border-hairline bg-void p-3 text-sm focus:border-accent-brand focus:outline-none"
          />
          <div className="flex justify-end gap-2">
            <Button onClick={handleFinish} variant="ghost" size="sm">
              Skip feedback
            </Button>
            <Button onClick={handleFinish} className="bg-accent-brand text-void hover:bg-accent-brand/90" size="sm">
              <MessageSquare className="mr-1 h-3.5 w-3.5" />
              Submit
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Dark overlay with spotlight cutout */}
      <div className="fixed inset-0 z-[200] pointer-events-none">
        {targetRect && (
          <svg className="absolute inset-0 w-full h-full">
            <defs>
              <mask id="tour-mask">
                <rect width="100%" height="100%" fill="white" />
                {getSpotlightStyle() && (
                  <rect
                    x={getSpotlightStyle()!.left}
                    y={getSpotlightStyle()!.top}
                    width={getSpotlightStyle()!.width}
                    height={getSpotlightStyle()!.height}
                    rx="12"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect width="100%" height="100%" fill="rgba(0,0,0,0.75)" mask="url(#tour-mask)" />
          </svg>
        )}
        {!targetRect && (
          <div className="absolute inset-0 bg-black/75" />
        )}
      </div>

      {/* Spotlight border */}
      {targetRect && getSpotlightStyle() && (
        <div
          className="fixed z-[201] pointer-events-none rounded-xl border-2 border-accent-brand shadow-glow-brand"
          style={{
            left: `${getSpotlightStyle()!.left}px`,
            top: `${getSpotlightStyle()!.top}px`,
            width: `${getSpotlightStyle()!.width}px`,
            height: `${getSpotlightStyle()!.height}px`,
            transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      )}

      {/* Tooltip card */}
      <div
        className="fixed z-[202] w-[340px] rounded-2xl border border-hairline bg-card-surface p-5 shadow-floating animate-scale-in"
        style={{
          ...getTooltipPosition(),
          transition: 'all 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Progress bar */}
        <div className="mb-4 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-void">
            <div
              className="h-full rounded-full bg-accent-brand transition-all duration-500"
              style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
            />
          </div>
          <span className="text-xs font-medium text-muted-recall tabular-nums">
            {stepIndex + 1}/{totalSteps}
          </span>
        </div>

        {/* Close button */}
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 text-muted-recall transition hover:text-primary-recall"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Step content */}
        <h3 className="mb-2 font-display text-base font-semibold text-primary-recall pr-6">
          {step.title}
        </h3>
        <p className="mb-4 text-sm leading-relaxed text-muted-recall">
          {step.description}
        </p>

        {/* Navigation buttons */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="text-xs text-muted-recall transition hover:text-primary-recall"
          >
            Skip tour
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 && (
              <Button onClick={handleBack} variant="ghost" size="sm" className="h-8 px-3">
                <ChevronLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="bg-accent-brand text-void hover:bg-accent-brand/90 h-8 px-4"
              size="sm"
            >
              {isLastStep ? (
                <>
                  <Check className="mr-1 h-3.5 w-3.5" />
                  Finish
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
