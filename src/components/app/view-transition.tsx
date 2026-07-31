'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * ViewTransition — wraps app views with a GSAP fade-in-up animation
 * on mount. This gives every view change a smooth entrance without
 * the overhead of a full page-transition library.
 *
 * Respects prefers-reduced-motion (jumps to visible immediately).
 * If GSAP fails to load or the animation is interrupted, the content
 * is made visible via a CSS fallback (opacity: 1).
 */
export function ViewTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) {
      setVisible(true)
      return
    }

    // Fallback: if GSAP doesn't complete within 800ms, force visible.
    // This prevents content from being stuck at opacity: 0 if the
    // animation is interrupted by a re-render.
    const fallbackTimer = setTimeout(() => setVisible(true), 800)

    let ctx: { revert: () => void } | undefined
    let cancelled = false

    import('gsap')
      .then(({ gsap }) => {
        if (cancelled || !el) return
        ctx = gsap.context(() => {
          gsap.fromTo(
            el,
            { opacity: 0, y: 12 },
            {
              opacity: 1,
              y: 0,
              duration: 0.4,
              ease: 'power2.out',
              onComplete: () => setVisible(true),
            }
          )
        }, el)
      })
      .catch(() => {
        // GSAP failed to load — make content visible immediately
        setVisible(true)
      })

    return () => {
      cancelled = true
      clearTimeout(fallbackTimer)
      ctx?.revert()
    }
  }, [])

  return (
    <div ref={ref} style={{ opacity: visible ? undefined : 0 }}>
      {children}
    </div>
  )
}
