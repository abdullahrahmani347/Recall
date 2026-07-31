'use client'

import { useEffect, useState } from 'react'
import { useAppStore } from '@/stores/app-store'
import { RecallLogo } from '@/components/icons/recall-icons'

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'FAQ', href: '#faq' },
]

/**
 * FloatingNav — pill-shaped, glass-morphism navigation bar that floats
 * 16px from the top of the viewport, centered horizontally.
 *
 * On scroll, the background becomes more opaque and the shadow deepens.
 * On mobile, the nav links are hidden and only the logo + CTA remain.
 */
export function FloatingNav() {
  const setView = useAppStore((s) => s.setView)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 transition-smooth`}
      style={{ width: 'calc(100% - 2rem)', maxWidth: '48rem' }}
    >
      <nav
        aria-label="Primary"
        className={`flex items-center justify-between rounded-full border px-4 py-2.5 transition-smooth ${
          scrolled
            ? 'glass border-hairline shadow-nav'
            : 'border-transparent bg-card-surface/60 backdrop-blur-md'
        }`}
      >
        {/* Logo */}
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="flex items-center gap-2.5 press"
          aria-label="Recall home"
        >
          <RecallLogo size={28} />
          <span className="font-display text-base font-semibold tracking-tight">
            Recall
          </span>
        </button>

        {/* Nav links — hidden on mobile */}
        <div className="hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-secondary-recall transition-smooth hover:text-primary-recall"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={() => setView('auth')}
          className="group flex items-center gap-2 rounded-full bg-accent-brand px-4 py-2 text-sm font-medium text-void press shadow-glow-brand transition-smooth hover:bg-accent-brand/90"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-void transition-smooth group-hover:scale-125" aria-hidden="true" />
          Get started
        </button>
      </nav>
    </header>
  )
}
