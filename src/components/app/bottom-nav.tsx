'use client'

import { useAppStore } from '@/stores/app-store'
import {
  HomeIcon,
  NotebookIcon,
  LayersIcon,
  SearchIcon,
  ChartIcon,
  SettingsIcon,
  GraphIcon,
} from '@/components/icons/recall-icons'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { view: 'home', label: 'Home', icon: HomeIcon },
  { view: 'notes', label: 'Notes', icon: NotebookIcon },
  { view: 'graph', label: 'Graph', icon: GraphIcon },
  { view: 'decks', label: 'Decks', icon: LayersIcon },
  { view: 'search', label: 'Search', icon: SearchIcon },
  { view: 'social', label: 'Social', icon: Users },
  { view: 'analytics', label: 'Stats', icon: ChartIcon },
  { view: 'settings', label: 'Settings', icon: SettingsIcon },
] as const

export function BottomNav() {
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)

  return (
    <nav
      aria-label="Primary"
      data-tour="bottom-nav"
      className="sticky bottom-0 z-30 border-t border-hairline glass"
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
                aria-keyshortcuts={item.view === 'home' ? 'g h' : item.view === 'notes' ? 'g n' : item.view === 'search' ? 'g s' : undefined}
                className={cn(
                  'relative flex w-full flex-col items-center gap-0.5 px-1 py-2.5 text-[10px] font-medium transition-smooth focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand sm:gap-1 sm:px-2 sm:py-3 sm:text-[11px]',
                  active
                    ? 'text-accent-brand'
                    : 'text-muted-recall hover:text-primary-recall'
                )}
              >
                {/* Active indicator dot */}
                {active && (
                  <span
                    className="absolute top-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-accent-brand"
                    aria-hidden="true"
                  />
                )}
                <Icon
                  size={22}
                  animated={active ? true : undefined}
                  className={cn('transition-smooth', active && 'scale-110')}
                />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
