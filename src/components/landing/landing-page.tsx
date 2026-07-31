'use client'

import { useEffect, useRef, useState } from 'react'
import { Hero3D } from './hero-3d'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import {
  RecallLogo,
  SparklesIcon,
  NotebookIcon,
  FlashcardIcon,
  BrainIcon,
  ClockIcon,
} from '@/components/icons/recall-icons'

const FEATURES = [
  {
    icon: NotebookIcon,
    title: 'Capture without friction',
    body: 'Open the app, type. Autosave keeps your draft. Markdown is welcome — no fighting a rich-text toolbar on a phone keyboard.',
  },
  {
    icon: SparklesIcon,
    title: 'Summaries that stream in',
    body: 'Hit summarize and watch a tight bullet-point summary appear token-by-token. Your source note is never overwritten.',
  },
  {
    icon: FlashcardIcon,
    title: 'FSRS-spaced review',
    body: 'Turn notes into flashcards. The scheduler uses FSRS, the open-source algorithm that benchmarks better than the classic SM-2.',
  },
]

const STATS = [
  { value: 'FSRS-4.5', label: 'Scheduler' },
  { value: 'WCAG 2.2', label: 'AA target' },
  { value: '< 60ms', label: 'API latency' },
  { value: '100%', label: 'Offline-ready' },
]

export function LandingPage() {
  const setView = useAppStore((s) => s.setView)
  const heroRef = useRef<HTMLDivElement>(null)
  const featureRefs = useRef<(HTMLDivElement | null)[]>([])
  const statsRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const [heroVisible, setHeroVisible] = useState(false)

  // Reveal hero only when it's intersecting — defer 3D load until after LCP
  useEffect(() => {
    if (!heroRef.current) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            requestAnimationFrame(() => setHeroVisible(true))
            io.disconnect()
          }
        }
      },
      { threshold: 0.1 }
    )
    io.observe(heroRef.current)
    return () => io.disconnect()
  }, [])

  // GSAP entrance + scroll reveals
  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) return

    let ctx: { revert: () => void } | undefined
    import('gsap')
      .then(({ gsap }) => {
        import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
          gsap.registerPlugin(ScrollTrigger)

          ctx = gsap.context(() => {
            // Hero entrance: headline word-by-word rise + CTA fade
            const words = heroRef.current?.querySelectorAll('[data-hero-word]')
            if (words && words.length) {
              gsap.from(words, {
                y: 28,
                opacity: 0,
                duration: 0.8,
                stagger: 0.05,
                ease: 'power3.out',
                delay: 0.2,
              })
              gsap.from('[data-hero-sub]', {
                opacity: 0,
                y: 12,
                duration: 0.6,
                delay: 0.5,
                ease: 'power2.out',
              })
              gsap.from('[data-hero-cta]', {
                opacity: 0,
                y: 16,
                duration: 0.6,
                delay: 0.7,
                ease: 'power2.out',
              })
              gsap.from('[data-hero-badge]', {
                opacity: 0,
                y: 10,
                duration: 0.5,
                delay: 0.1,
                ease: 'power2.out',
              })
            }

            // Feature cards: scroll-triggered fade + 12px rise, once only
            featureRefs.current.forEach((el, i) => {
              if (!el) return
              gsap.from(el, {
                opacity: 0,
                y: 20,
                duration: 0.6,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: el,
                  start: 'top 85%',
                  once: true,
                },
                delay: i * 0.08,
              })
            })

            // Stats counter
            if (statsRef.current) {
              gsap.from(statsRef.current.querySelectorAll('[data-stat]'), {
                opacity: 0,
                y: 16,
                duration: 0.5,
                stagger: 0.1,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: statsRef.current,
                  start: 'top 80%',
                  once: true,
                },
              })
            }

            // CTA section
            if (ctaRef.current) {
              gsap.from(ctaRef.current.querySelectorAll('[data-cta]'), {
                opacity: 0,
                y: 24,
                duration: 0.7,
                stagger: 0.12,
                ease: 'power2.out',
                scrollTrigger: {
                  trigger: ctaRef.current,
                  start: 'top 80%',
                  once: true,
                },
              })
            }
          }, heroRef)
        })
      })
      .catch(() => {})

    return () => {
      ctx?.revert()
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-canvas text-foreground">
      <a href="#main" className="skip-link">Skip to content</a>

      {/* NAV */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5 sm:py-6">
        <div className="flex items-center gap-2.5">
          <RecallLogo size={36} />
          <span className="font-display text-lg font-semibold tracking-tight">
            Recall
          </span>
        </div>
        <nav className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('auth')}
            className="text-secondary-recall hover:text-primary-recall press"
          >
            Log in
          </Button>
          <Button
            size="sm"
            onClick={() => setView('auth')}
            className="bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand"
          >
            Get started
          </Button>
        </nav>
      </header>

      {/* HERO */}
      <section
        ref={heroRef}
        className="relative isolate overflow-hidden"
        aria-labelledby="hero-heading"
      >
        <Hero3D visible={heroVisible} />

        <div className="mx-auto max-w-4xl px-6 pb-24 pt-12 sm:pt-20 lg:pt-24">
          {/* Badge */}
          <div
            data-hero-badge
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-hairline glass px-3 py-1.5 text-xs text-secondary-recall"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent-brand opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-brand" />
            </span>
            Spaced repetition · AI summaries · Mobile-first
          </div>

          <h1
            id="hero-heading"
            className="font-display text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
          >
            {'Remember what you learn.'.split(' ').map((w, i) => (
              <span key={i} data-hero-word className="inline-block">
                {w}&nbsp;
              </span>
            ))}
          </h1>

          <p
            data-hero-sub
            className="mt-6 max-w-2xl text-pretty text-base text-secondary-recall sm:text-lg lg:text-xl"
          >
            Capture notes, get a streaming AI summary in seconds, turn the highlights into
            flashcards, and review them on the schedule that actually sticks. FSRS-spaced,
            offline-ready, dark by default.
          </p>

          <div
            data-hero-cta
            className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button
              size="lg"
              onClick={() => setView('auth')}
              className="bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand"
            >
              Start studying free
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => setView('auth')}
              className="border border-hairline glass press"
            >
              I already have an account
            </Button>
          </div>

          <p data-hero-sub className="mt-5 text-xs text-muted-recall">
            No card required. Email + password or Google (Phase 2).
          </p>
        </div>
      </section>

      {/* STATS BAR */}
      <div ref={statsRef} className="border-y border-hairline bg-card-surface/30">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-px px-6 sm:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              data-stat
              className="flex flex-col items-center py-6 text-center"
            >
              <p className="font-display text-xl font-semibold text-accent-brand sm:text-2xl">
                {stat.value}
              </p>
              <p className="mt-1 text-xs text-muted-recall">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <main
        id="main"
        className="mx-auto max-w-6xl px-6 pb-24 pt-16 sm:pt-24"
      >
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            Built for the way you actually study.
          </h2>
          <p className="mt-3 text-secondary-recall">
            Three things that make Recall different from your notes app.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                ref={(el) => { featureRefs.current[i] = el }}
                className="group rounded-2xl border border-hairline bg-card-surface p-6 card-lift"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-brand-dim text-accent-brand transition-smooth group-hover:scale-110">
                  <Icon size={28} animated />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-secondary-recall">{f.body}</p>
              </div>
            )
          })}
        </div>

        {/* SECONDARY CTA */}
        <section ref={ctaRef} className="mt-24 overflow-hidden rounded-3xl border border-hairline bg-void p-8 sm:p-12 lg:p-16">
          <div className="grid items-center gap-8 sm:grid-cols-2">
            <div data-cta>
              <h2 className="font-display text-2xl font-semibold sm:text-3xl lg:text-4xl">
                A memory tool that gets out of your way.
              </h2>
              <p className="mt-4 text-secondary-recall">
                Recall is mobile-first, dark by default, and works offline after the first
                load. Designed for one-handed study sessions on the bus, in the queue, or
                at 2am before an exam.
              </p>
            </div>
            <div data-cta className="flex flex-col gap-3 sm:items-end">
              <Button
                size="lg"
                onClick={() => setView('auth')}
                className="bg-accent-brand text-void hover:bg-accent-brand/90 press shadow-glow-brand"
              >
                Create your first note
              </Button>
              <span className="text-xs text-muted-recall">
                Free during MVP. Your notes never leave your account.
              </span>
            </div>
          </div>
        </section>

        {/* FEATURE HIGHLIGHTS with icons */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BrainIcon, title: 'AI-powered', body: 'Streaming summaries + flashcard generation' },
            { icon: ClockIcon, title: 'FSRS-spaced', body: 'Scientific scheduling, not random intervals' },
            { icon: NotebookIcon, title: 'Offline-first', body: 'Works without a connection after first load' },
            { icon: FlashcardIcon, title: 'Export-ready', body: 'Markdown, JSON, or Anki (.apkg) format' },
          ].map((item, i) => {
            const Icon = item.icon
            return (
              <div
                key={item.title}
                ref={(el) => { featureRefs.current[i + 3] = el }}
                className="flex items-start gap-3 rounded-xl border border-hairline bg-card-surface p-4 card-lift"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-brand-dim text-accent-brand">
                  <Icon size={20} />
                </div>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-recall">{item.body}</p>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-recall">
            <RecallLogo size={24} />
            <span>Recall</span>
          </div>
          <p className="text-xs text-muted-recall">
            FSRS-spaced repetition · SSE streaming · TF-IDF semantic search · .apkg export
          </p>
        </div>
      </footer>
    </div>
  )
}
