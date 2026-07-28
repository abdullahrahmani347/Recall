'use client'

import { useAppStore } from '@/stores/app-store'
import { Home, Notebook, Layers, Search, Settings, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'notes', label: 'Notes', icon: Notebook },
  { view: 'decks', label: 'Decks', icon: Layers },
  { view: 'search', label: 'Search', icon: Search },
  { view: 'analytics', label: 'Stats', icon: BarChart3 },
  { view: 'settings', label: 'Settings', icon: Settings },
] as const

export function BottomNav() {
  const { view, setView } = useAppStore()

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-30 border-t border-hairline bg-canvas/95 backdrop-blur supports-[backdrop-filter]:bg-canvas/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="mx-auto flex max-w-2xl items-stretch justify-around">
        {NAV.map((item) => {
          const Icon = item.icon
          const active = view === item.view
          return (
            <li key={item.view} className="flex-1">
              <button
                onClick={() => setView(item.view)}
                aria-current={active ? 'page' : undefined}
                aria-label={item.label}
                className={cn(
                  'flex w-full flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-colors sm:gap-1 sm:px-2 sm:py-3 sm:text-[11px]',
                  active
                    ? 'text-accent-brand'
                    : 'text-muted-recall hover:text-primary-recall'
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
