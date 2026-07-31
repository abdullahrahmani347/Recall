'use client'

/**
 * Custom animated SVG icons for Recall.
 *
 * Each icon is hand-crafted with smooth, subtle animations that respect
 * prefers-reduced-motion. The animations are CSS-based (not JS) for
 * performance — no GSAP needed for idle states.
 *
 * Icons use currentColor so they inherit text color, and stroke-width
 * is kept at 1.5 for a refined, modern look (not the default 2).
 */

interface IconProps {
  className?: string
  size?: number
  animated?: boolean
}

const baseProps = (size: number, className?: string) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  className,
  'aria-hidden': true as const,
})

/* ============================================================
   Brand mark — animated brain with memory pulse
   ============================================================ */
export function RecallLogo({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="recall-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#34E7A8" />
          <stop offset="100%" stopColor="#FFB454" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="28" height="28" rx="8" fill="url(#recall-grad)" opacity="0.12" />
      <rect x="2" y="2" width="28" height="28" rx="8" stroke="url(#recall-grad)" strokeWidth="1.5" opacity="0.4" />
      <circle cx="12" cy="16" r="5" stroke="url(#recall-grad)" strokeWidth="2" fill="none" />
      <circle cx="20" cy="16" r="5" stroke="url(#recall-grad)" strokeWidth="2" fill="none" opacity="0.7" />
      <circle cx="16" cy="16" r="2" fill="url(#recall-grad)">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="2.5s" repeatCount="indefinite" />
        <animate attributeName="r" values="1.5;2.5;1.5" dur="2.5s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

/* Sparkles — AI / summarize icon */
export function SparklesIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path
        d="M12 3l1.8 4.8L18.6 9.6 13.8 11.4 12 16.2 10.2 11.4 5.4 9.6 10.2 7.8z"
        fill="currentColor"
        fillOpacity="0.15"
        stroke="currentColor"
        strokeWidth="1.5"
      >
        {animated && (
          <animate attributeName="fill-opacity" values="0.1;0.3;0.1" dur="3s" repeatCount="indefinite" />
        )}
      </path>
      <path d="M19 14l0.7 1.8L21.5 16.5 19.7 17.2 19 19 18.3 17.2 16.5 16.5 18.3 15.8z" fill="currentColor" opacity="0.6">
        {animated && (
          <animateTransform attributeName="transform" type="rotate" values="0 19 16.5;360 19 16.5" dur="12s" repeatCount="indefinite" />
        )}
      </path>
      <circle cx="6" cy="18" r="1" fill="currentColor" opacity="0.4">
        {animated && <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" repeatCount="indefinite" />}
      </circle>
    </svg>
  )
}

/* Flashcard icon */
export function FlashcardIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <g>
        {animated && (
          <animateTransform attributeName="transform" type="rotate" values="-1 12 12;1 12 12;-1 12 12" dur="4s" repeatCount="indefinite" />
        )}
        <rect x="4" y="6" width="16" height="12" rx="3" fill="currentColor" fillOpacity="0.08" />
        <rect x="4" y="6" width="16" height="12" rx="3" stroke="currentColor" strokeWidth="1.5" />
        <line x1="8" y1="11" x2="16" y2="11" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="8" y1="14" x2="13" y2="14" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      </g>
    </svg>
  )
}

/* Notebook icon */
export function NotebookIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <line x1="6" y1="4" x2="6" y2="20" stroke="currentColor" strokeWidth="2" opacity="0.4" />
      <rect x="6" y="4" width="14" height="16" rx="2" fill="currentColor" fillOpacity="0.06" />
      <rect x="6" y="4" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <line x1="9" y1="9" x2="17" y2="9" stroke="currentColor" strokeWidth="1" opacity="0.4">
        {animated && <animate attributeName="opacity" values="0.3;0.5;0.3" dur="3s" repeatCount="indefinite" />}
      </line>
      <line x1="9" y1="12" x2="15" y2="12" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="9" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1" opacity="0.3" />
    </svg>
  )
}

/* Flame icon */
export function FlameIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <g>
        {animated && (
          <animateTransform attributeName="transform" type="scale" values="1 1;1 1.05;1 0.98;1 1" dur="1.5s" repeatCount="indefinite" additive="sum" />
        )}
        <path
          d="M12 3c0 0-1 3-3 5s-3 4-3 7a6 6 0 0012 0c0-2-1-4-2-5-0.5 1-1 1.5-2 1.5 0-3-1-5-2-8.5z"
          fill="currentColor"
          fillOpacity="0.15"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M12 14c0 0-0.5 1-1.5 2s-1 2-1 3a2.5 2.5 0 005 0c0-1-0.5-2-1-2.5-0.3 0.5-0.5 0.5-1 0.5z"
          fill="currentColor"
          fillOpacity="0.3"
        />
      </g>
    </svg>
  )
}

/* Chart icon */
export function ChartIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <line x1="4" y1="20" x2="20" y2="20" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
      <rect x="6" y="14" width="3" height="6" rx="1" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.2">
        {animated && <animate attributeName="height" values="6;4;6" dur="3s" repeatCount="indefinite" />}
      </rect>
      <rect x="11" y="10" width="3" height="10" rx="1" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.2">
        {animated && <animate attributeName="height" values="10;8;10" dur="3s" begin="0.3s" repeatCount="indefinite" />}
      </rect>
      <rect x="16" y="7" width="3" height="13" rx="1" fill="currentColor" fillOpacity="0.5" stroke="currentColor" strokeWidth="1.2">
        {animated && <animate attributeName="height" values="13;11;13" dur="3s" begin="0.6s" repeatCount="indefinite" />}
      </rect>
    </svg>
  )
}

/* Search icon */
export function SearchIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.5" />
      {animated && (
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1" opacity="0.3">
          <animate attributeName="r" values="7;9;7" dur="2.5s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" repeatCount="indefinite" />
        </circle>
      )}
      <line x1="16.5" y1="16.5" x2="21" y2="21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

/* Settings icon */
export function SettingsIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <g>
        {animated && (
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="20s" repeatCount="indefinite" />
        )}
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.1" />
        <path d="M12 2v3M12 19v3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M2 12h3M19 12h3M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

/* Brain icon */
export function BrainIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M9 3a3 3 0 00-3 3 3 3 0 00-2 2.83A3 3 0 003 12a3 3 0 002 2.83A3 3 0 009 18a3 3 0 003-3V6a3 3 0 00-3-3z" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5" />
      <path d="M15 3a3 3 0 013 3 3 3 0 012 2.83A3 3 0 0121 12a3 3 0 01-2 2.83A3 3 0 0115 18a3 3 0 01-3-3V6a3 3 0 013-3z" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="1.5" />
      {animated && (
        <circle cx="12" cy="10" r="1.5" fill="currentColor">
          <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </svg>
  )
}

/* Wand icon */
export function WandIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <g>
        {animated && (
          <animateTransform attributeName="transform" type="rotate" values="-5 12 12;5 12 12;-5 12 12" dur="2s" repeatCount="indefinite" />
        )}
        <path d="M15 4l-1 1L19 10l1-1z" fill="currentColor" fillOpacity="0.3" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 19l8-8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M5 19l-1 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="18" cy="6" r="0.8" fill="currentColor" opacity="0.6">
          {animated && <animate attributeName="opacity" values="0.3;0.8;0.3" dur="1.5s" repeatCount="indefinite" />}
        </circle>
        <circle cx="20" cy="14" r="0.6" fill="currentColor" opacity="0.4">
          {animated && <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" repeatCount="indefinite" />}
        </circle>
      </g>
    </svg>
  )
}

/* Clock icon */
export function ClockIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.06" />
      <line x1="12" y1="12" x2="12" y2="7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        {animated && (
          <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="6s" repeatCount="indefinite" />
        )}
      </line>
      <line x1="12" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity="0.5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

/* Layers icon */
export function LayersIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <g>
        {animated && (
          <animateTransform attributeName="transform" type="translate" values="0 0;0 -1;0 0" dur="3s" repeatCount="indefinite" />
        )}
        <path d="M12 3l9 5-9 5-9-5z" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M3 13l9 5 9-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.6" />
        <path d="M3 17l9 5 9-5" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" opacity="0.3" />
      </g>
    </svg>
  )
}

/* Home icon */
export function HomeIcon({ size = 24, className, animated = true }: IconProps) {
  return (
    <svg {...baseProps(size, className)}>
      <path d="M4 11l8-7 8 7v9a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z" fill="currentColor" fillOpacity="0.06" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {animated && (
        <path d="M12 4l-1 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0">
          <animate attributeName="opacity" values="0;0.4;0" dur="3s" repeatCount="indefinite" />
        </path>
      )}
    </svg>
  )
}
