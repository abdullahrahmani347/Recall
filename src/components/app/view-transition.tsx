'use client'

import { useEffect, useRef } from 'react'

/**
 * ViewTransition — wraps app views with a GSAP fade-in-up animation
 * on mount. This gives every view change a smooth entrance without
 * the overhead of a full page-transition library.
 *
 * Respects prefers-reduced-motion (jumps to visible immediately).
 */
export function ViewTransition({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (reduceMotion) return

    let ctx: { revert: () => void } | undefined
    import('gsap')
      .then(({ gsap }) => {
        ctx = gsap.context(() => {
          gsap.fromTo(
            el,
            { opacity: 0, y: 12 },
            { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' }
          )
        }, el)
      })
      .catch(() => {})

    return () => {
      ctx?.revert()
    }
  }, [])

  return <div ref={ref}>{children}</div>
}
