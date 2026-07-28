'use client'

import { useEffect, useRef, useState } from 'react'
import { Hero3D } from './hero-3d'
import { useAppStore } from '@/stores/app-store'
import { Button } from '@/components/ui/button'
import { Brain, Layers, Notebook, Search, Sparkles } from 'lucide-react'

/**
 * Landing page — marketing surface only.
 *
 * Hero: real DOM headline + CTA (so screen readers and SEO get the text
 * regardless of WebGL state), with the 3D particle field as a decorative
 * backdrop (aria-hidden). Lazy-loads the canvas only when the hero is
 * intersecting the viewport, so first paint is never blocked.
 *
 * Below the fold: three feature cards revealed on scroll via GSAP
 * ScrollTrigger (with prefers-reduced-motion path that just shows them).
 */

const FEATURES = [
  {
    icon: Notebook,
    title: 'Capture without friction',
    body: 'Open the app, type. Autosave keeps your draft. Markdown is welcome — no fighting a rich-text toolbar on a phone keyboard.',
  },
  {
    icon: Sparkles,
    title: 'Summaries that stream in',
    body: 'Hit summarize and watch a tight bullet-point summary appear token-by-token. Your source note is never overwritten.',
  },
  {
    icon: Layers,
    title: 'FSRS-spaced review',
    body: 'Turn notes into flashcards. The scheduler uses FSRS, the open-source algorithm that benchmarks better than the classic SM-2.',
  },
]

export function LandingPage() {
  const setView = useAppStore((s) => s.setView)
  const heroRef = useRef<HTMLDivElement>(null)
  const [heroVisible, setHeroVisible] = useState(false)
  const featureRefs = useRef<(HTMLDivElement | null)[]>([])

  // Reveal hero only when it's intersecting — defer 3D load until after LCP
  useEffect(() => {
    if (!heroRef.current) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            // Defer by one animation frame so LCP element paints first
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

  // GSAP entrance + scroll reveals (lazy-loaded, reduced-motion aware)
  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) {
      // Static path — just show everything
      return
    }

    let ctx: { revert: () => void } | undefined
    import('gsap')
      .then(({ gsap }) => {
        import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
          gsap.registerPlugin(ScrollTrigger)

          // Hero entrance: headline word-by-word rise + CTA fade
          const words = heroRef.current?.querySelectorAll('[data-hero-word]')
          if (words && words.length) {
            ctx = gsap.context(() => {
              gsap.from(words, {
                y: 24,
                opacity: 0,
                duration: 0.7,
                stagger: 0.04,
                ease: 'power3.out',
                delay: 0.15,
              })
              gsap.from('[data-hero-cta]', {
                opacity: 0,
                y: 12,
                duration: 0.5,
                delay: 0.6,
                ease: 'power2.out',
              })
              gsap.from('[data-hero-sub]', {
                opacity: 0,
                y: 8,
                duration: 0.5,
                delay: 0.4,
                ease: 'power2.out',
              })

              // Feature cards: scroll-triggered fade + 8px rise, once only
              featureRefs.current.forEach((el, i) => {
                if (!el) return
                gsap.from(el, {
                  opacity: 0,
                  y: 12,
                  duration: 0.5,
                  ease: 'power2.out',
                  scrollTrigger: {
                    trigger: el,
                    start: 'top 85%',
                    once: true,
                  },
                  delay: i * 0.05,
                })
              })
            }, heroRef)
          }
        })
      })
      .catch(() => {
        // If GSAP fails to load, content is just visible — no animation, no harm
      })

    return () => {
      ctx?.revert()
    }
  }, [])

  return (
    <div className="relative min-h-screen bg-canvas text-foreground">
      <a href="#main" className="skip-link">Skip to content</a>

      {/* NAV */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-brand text-void">
            <Brain className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight">
            Recall
          </span>
        </div>
        <nav className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setView('auth')}
            className="text-secondary-recall hover:text-primary-recall"
          >
            Log in
          </Button>
          <Button
            size="sm"
            onClick={() => setView('auth')}
            className="bg-accent-brand text-void hover:bg-accent-brand/90"
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

        <div className="mx-auto max-w-4xl px-6 pb-24 pt-16 sm:pt-24">
          <p
            data-hero-sub
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-hairline bg-card-surface/60 px-3 py-1 text-xs text-secondary-recall backdrop-blur"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent-warm" aria-hidden="true" />
            Spaced repetition · AI summaries · Mobile-first
          </p>

          <h1
            id="hero-heading"
            className="font-display text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl"
          >
            {'Remember what you learn.'.split(' ').map((w, i) => (
              <span key={i} data-hero-word className="inline-block">
                {w}&nbsp;
              </span>
            ))}
          </h1>

          <p
            data-hero-sub
            className="mt-6 max-w-2xl text-pretty text-base text-secondary-recall sm:text-lg"
          >
            Capture notes, get a streaming AI summary in seconds, turn the highlights into
            flashcards, and review them on the schedule that actually sticks. FSRS-spaced,
            offline-ready, dark by default.
          </p>

          <div
            data-hero-cta
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Button
              size="lg"
              onClick={() => setView('auth')}
              className="bg-accent-brand text-void hover:bg-accent-brand/90"
            >
              Start studying free
            </Button>
            <Button
              size="lg"
              variant="ghost"
              onClick={() => setView('auth')}
              className="border border-hairline bg-card-surface/40 backdrop-blur"
            >
              I already have an account
            </Button>
          </div>

          <p data-hero-sub className="mt-4 text-xs text-muted-recall">
            No card required. Email + password or Google (Phase 2).
          </p>
        </div>
      </section>

      {/* FEATURES */}
      <main
        id="main"
        className="mx-auto max-w-6xl px-6 pb-24 pt-12 sm:pt-20"
      >
        <div className="grid gap-6 sm:grid-cols-3">
          {FEATURES.map((f, i) => {
            const Icon = f.icon
            return (
              <div
                key={f.title}
                ref={(el) => { featureRefs.current[i] = el }}
                className="rounded-2xl border border-hairline bg-card-surface p-6"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-accent-brand/10 text-accent-brand">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <h3 className="mb-2 font-display text-lg font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-secondary-recall">{f.body}</p>
              </div>
            )
          })}
        </div>

        {/* SECONDARY CTA */}
        <section className="mt-20 rounded-3xl border border-hairline bg-void p-8 sm:p-12">
          <div className="grid items-center gap-8 sm:grid-cols-2">
            <div>
              <h2 className="font-display text-2xl font-semibold sm:text-3xl">
                A memory tool that gets out of your way.
              </h2>
              <p className="mt-3 text-secondary-recall">
                Recall is mobile-first, dark by default, and works offline after the first
                load. Designed for one-handed study sessions on the bus, in the queue, or
                at 2am before an exam.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:items-end">
              <Button
                size="lg"
                onClick={() => setView('auth')}
                className="bg-accent-brand text-void hover:bg-accent-brand/90"
              >
                Create your first note
              </Button>
              <span className="text-xs text-muted-recall">
                Free during MVP. Your notes never leave your account.
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-recall">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-brand/20 text-accent-brand">
              <Brain className="h-3 w-3" aria-hidden="true" />
            </div>
            <span>Recall — MVP</span>
          </div>
          <p className="text-xs text-muted-recall">
            FSRS-spaced repetition · SSE streaming · SQLite-backed · WCAG 2.2 AA target
          </p>
        </div>
      </footer>
    </div>
  )
}
