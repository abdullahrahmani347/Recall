'use client'

/**
 * CTADotButton — primary call-to-action button with a dot indicator,
 * matching the reference design's aesthetic but in Recall's green.
 *
 * The dot is a small dark circle on the green button (inverted from
 * the reference's white dot on coral) that scales on hover.
 */
export function CTADotButton({
  children,
  onClick,
  size = 'md',
  className = '',
}: {
  children: React.ReactNode
  onClick?: () => void
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const sizeClasses = {
    sm: 'px-4 py-2 text-sm gap-2',
    md: 'px-5 py-2.5 text-sm gap-2.5',
    lg: 'px-6 py-3.5 text-base gap-2.5',
  }

  const dotSize = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-2 w-2',
  }

  return (
    <button
      onClick={onClick}
      className={`group inline-flex items-center rounded-full bg-accent-brand font-medium text-void press shadow-glow-brand transition-smooth hover:bg-accent-brand/90 ${sizeClasses[size]} ${className}`}
    >
      <span
        className={`rounded-full bg-void transition-smooth group-hover:scale-125 ${dotSize[size]}`}
        aria-hidden="true"
      />
      {children}
    </button>
  )
}
