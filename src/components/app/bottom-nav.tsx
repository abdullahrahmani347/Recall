'use client'

import { useAppStore } from '@/stores/app-store'
import { Home, Notebook, Layers, Search, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { view: 'home', label: 'Home', icon: Home },
  { view: 'notes', label: 'Notes', icon: Notebook },
  { view: 'decks', label: 'Decks', icon: Layers },
  { view: 'search', label: 'Search', icon: Search },
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
                className={cn(
                  'flex w-full flex-col items-center gap-1 px-2 py-3 text-[11px] font-medium transition-colors',
                  active
                    ? 'text-accent-brand'
                    : 'text-muted-recall hover:text-primary-recall'
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
