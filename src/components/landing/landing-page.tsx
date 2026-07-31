'use client'

import { useEffect, useRef, useState } from 'react'
import { HeroBackground } from './hero-background'
import { FloatingNav } from './floating-nav'
import { ProductDemoPanel } from './product-demo-panel'
import { CTADotButton } from './cta-dot-button'
import { useAppStore } from '@/stores/app-store'
import { ArrowRight, ArrowDown } from 'lucide-react'

/**
 * LandingPage — editorial, asymmetric, typographic.
 *
 * Design principles:
 * - Asymmetric composition (7/5 grid, not 50/50)
 * - Typography as the primary design element (mixed sizes, weights, italics)
 * - One large product demo, not simplified mocks
 * - Storytelling sections (capture → summarize → review) as a visual flow
 * - Opinionated, specific copy — no generic SaaS language
 * - Density variation: tight hero, airy features, dense stat moment
 * - Green used surgically as emphasis, not everywhere
 */
export function LandingPage() {
  const setView = useAppStore((s) => s.setView)
  const heroRef = useRef<HTMLDivElement>(null)
  const flowRef = useRef<HTMLDivElement>(null)
  const [heroVisible, setHeroVisible] = useState(false)

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
      { threshold: 0.05 }
    )
    io.observe(heroRef.current)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) return

    let ctx: { revert: () => void } | undefined
    import('gsap').then(({ gsap }) => {
      import('gsap/ScrollTrigger').then(({ ScrollTrigger }) => {
        gsap.registerPlugin(ScrollTrigger)
        ctx = gsap.context(() => {
          // Hero entrance
          gsap.from('[data-hero-eyebrow]', { opacity: 0, y: 8, duration: 0.5, delay: 0.2, ease: 'power2.out' })
          gsap.from('[data-hero-line-1]', { opacity: 0, y: 24, duration: 0.7, delay: 0.3, ease: 'power3.out' })
          gsap.from('[data-hero-line-2]', { opacity: 0, y: 24, duration: 0.7, delay: 0.45, ease: 'power3.out' })
          gsap.from('[data-hero-sub]', { opacity: 0, y: 12, duration: 0.6, delay: 0.6, ease: 'power2.out' })
          gsap.from('[data-hero-cta]', { opacity: 0, y: 16, duration: 0.6, delay: 0.8, ease: 'power2.out' })
          gsap.from('[data-hero-demo]', { opacity: 0, y: 30, duration: 0.9, delay: 0.4, ease: 'power3.out' })

          // Flow section
          if (flowRef.current) {
            gsap.from(flowRef.current.querySelectorAll('[data-flow-step]'), {
              opacity: 0,
              y: 30,
              duration: 0.7,
              stagger: 0.15,
              ease: 'power2.out',
              scrollTrigger: { trigger: flowRef.current, start: 'top 75%', once: true },
            })
          }

          // Stat moment
          gsap.from('[data-big-stat]', {
            opacity: 0,
            scale: 0.95,
            duration: 0.8,
            ease: 'power2.out',
            scrollTrigger: { trigger: '[data-big-stat]', start: 'top 80%', once: true },
          })
        }, heroRef)
      })
    }).catch(() => {})
    return () => { ctx?.revert() }
  }, [])

  return (
    <div className="relative min-h-screen bg-canvas text-foreground">
      <a href="#main" className="skip-link">Skip to content</a>
      <FloatingNav />

      {/* ============================================================
          HERO — asymmetric 7/5 split, editorial typography
          ============================================================ */}
      <section
        ref={heroRef}
        className="relative isolate overflow-hidden pt-32 sm:pt-36 lg:pt-40"
        aria-labelledby="hero-heading"
      >
        <HeroBackground visible={heroVisible} />

        <div className="mx-auto max-w-6xl px-6 pb-20 lg:pb-32">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* LEFT — 7 columns */}
            <div className="lg:col-span-7">
              {/* Eyebrow */}
              <p
                data-hero-eyebrow
                className="mb-6 text-xs font-medium uppercase tracking-widest text-muted-recall"
              >
                For readers who want to remember
              </p>

              {/* Editorial headline — mixed sizes, italic accent, green highlight */}
              <h1
                id="hero-heading"
                className="font-display text-[2.75rem] font-bold leading-[1.02] tracking-tight sm:text-6xl lg:text-[5rem]"
              >
                <span data-hero-line-1 className="block">
                  Read it once.
                </span>
                <span data-hero-line-2 className="block">
                 {' '}
                  <span className="italic font-medium text-accent-brand">
                    Remember
                  </span>{' '}
                  it forever.
                </span>
              </h1>

              {/* Subheadline */}
              <p
                data-hero-sub
                className="mt-8 max-w-md text-pretty text-lg leading-relaxed text-secondary-recall"
              >
                Recall turns your notes into AI summaries and FSRS-spaced
                flashcards — so the things you read today are still in your head
                next month.
              </p>

              {/* CTA */}
              <div data-hero-cta className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <CTADotButton size="lg" onClick={() => setView('auth')}>
                  Start studying free
                </CTADotButton>
                <button
                  onClick={() => setView('auth')}
                  className="group inline-flex items-center gap-1 text-sm font-medium text-secondary-recall transition-smooth hover:text-primary-recall"
                >
                  I already have an account
                  <ArrowRight className="h-3.5 w-3.5 transition-smooth group-hover:translate-x-0.5" />
                </button>
              </div>

              {/* Social proof — minimal, specific */}
              <div data-hero-sub className="mt-10 flex items-center gap-4 text-xs text-muted-recall">
                <span>No card required</span>
                <span className="h-3 w-px bg-border-hairline" />
                <span>Works offline</span>
                <span className="h-3 w-px bg-border-hairline" />
                <span>Open-source scheduler</span>
              </div>
            </div>

            {/* RIGHT — 5 columns, demo panel */}
            <div data-hero-demo className="lg:col-span-5">
              <ProductDemoPanel />
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          THE LOOP — visual flow: capture → summarize → review
          ============================================================ */}
      <section ref={flowRef} className="border-t border-hairline bg-void py-20 sm:py-28">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-16 max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">
              The loop
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
              Three steps. One habit.
            </h2>
            <p className="mt-3 text-secondary-recall">
              Most study apps are just flashcard decks. Recall is the full loop —
              from the moment you read something to the moment it&apos;s locked in.
            </p>
          </div>

          {/* Flow steps — horizontal on desktop, vertical on mobile */}
          <div className="grid gap-6 sm:grid-cols-3 sm:gap-4">
            {/* Step 1 */}
            <div data-flow-step className="relative">
              <div className="rounded-2xl border border-hairline bg-card-surface p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="font-mono text-xs text-accent-brand">01</span>
                  <span className="h-px flex-1 bg-border-hairline" />
                </div>
                <h3 className="font-display text-lg font-semibold">Capture</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-recall">
                  Write a note in markdown. Autosave keeps your draft. No toolbar
                  fighting for thumb space.
                </p>
              </div>
              {/* Arrow connector */}
              <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 sm:block">
                <ArrowRight className="h-4 w-4 text-border-hairline" />
              </div>
            </div>

            {/* Step 2 */}
            <div data-flow-step className="relative">
              <div className="rounded-2xl border border-hairline bg-card-surface p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="font-mono text-xs text-accent-brand">02</span>
                  <span className="h-px flex-1 bg-border-hairline" />
                </div>
                <h3 className="font-display text-lg font-semibold">Summarize</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-recall">
                  One tap. A tight summary streams in via SSE — token by token,
                  not after a 10-second spinner.
                </p>
              </div>
              <div className="absolute -right-2 top-1/2 hidden -translate-y-1/2 sm:block">
                <ArrowRight className="h-4 w-4 text-border-hairline" />
              </div>
            </div>

            {/* Step 3 */}
            <div data-flow-step>
              <div className="rounded-2xl border border-hairline bg-card-surface p-6">
                <div className="mb-4 flex items-center gap-2">
                  <span className="font-mono text-xs text-accent-brand">03</span>
                  <span className="h-px flex-1 bg-border-hairline" />
                </div>
                <h3 className="font-display text-lg font-semibold">Review</h3>
                <p className="mt-2 text-sm leading-relaxed text-secondary-recall">
                  Turn highlights into cards. FSRS-4.5 schedules each one for the
                  exact moment you&apos;re about to forget.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          BIG STAT MOMENT — one number, no fluff
          ============================================================ */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <p
            data-big-stat
            className="font-display text-6xl font-bold tracking-tight text-accent-brand sm:text-8xl lg:text-9xl"
          >
            2.3×
          </p>
          <p className="mt-6 max-w-md mx-auto text-lg text-secondary-recall">
            better retention than cramming, according to the spacing effect
            research that FSRS is built on.
          </p>
          <p className="mt-3 text-xs text-muted-recall">
            Ebbinghaus, 1885 — still right.
          </p>
        </div>
      </section>

      {/* ============================================================
          CLOSING CTA — quiet, confident
          ============================================================ */}
      <section className="border-t border-hairline py-20 sm:py-24">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Stop re-reading. Start remembering.
          </h2>
          <p className="mt-4 text-secondary-recall">
            It takes 30 seconds to create an account and write your first note.
            The summary and flashcards come free.
          </p>
          <div className="mt-8 flex justify-center">
            <CTADotButton size="lg" onClick={() => setView('auth')}>
              Get started
            </CTADotButton>
          </div>
          <p className="mt-4 text-xs text-muted-recall">
            Free during MVP. Your notes never leave your account.
          </p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-hairline">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 py-8 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm text-muted-recall">
            <span className="font-display font-semibold text-primary-recall">Recall</span>
          </div>
          <p className="text-xs text-muted-recall">
            FSRS-4.5 · SSE streaming · TF-IDF search · .apkg export
          </p>
        </div>
      </footer>
    </div>
  )
}
