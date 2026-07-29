'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ApiUser } from '@/lib/types'

/**
 * Client-side app state.
 *
 * View routing is intentionally client-side because the brief mentions only
 * a mobile-first SPA — we don't need URL-based routing for the MVP surface
 * (landing / auth / app), and staying on a single route keeps the navigation
 * snappy on mobile and avoids full page reloads.
 *
 * The server still owns all auth via httpOnly cookies; `user` here is just
 * a mirror of `/api/auth`'s response so the UI can render without a re-fetch
 * on every view change.
 */
type View =
  | 'landing'
  | 'auth'
  | 'home'
  | 'notes'
  | 'note-editor'
  | 'decks'
  | 'card-editor'
  | 'review'
  | 'search'
  | 'settings'
  | 'analytics'

interface AppState {
  user: ApiUser | null
  view: View
  activeNoteId: string | null
  activeDeckId: string | null
  reviewDeckId: string | null // null = "all decks"
  hydrated: boolean

  setUser: (user: ApiUser | null) => void
  setView: (view: View) => void
  openNote: (id: string | null) => void
  openDeck: (id: string | null) => void
  startReview: (deckId: string | null) => void
  setHydrated: (h: boolean) => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      user: null,
      view: 'landing',
      activeNoteId: null,
      activeDeckId: null,
      reviewDeckId: null,
      hydrated: false,

      setUser: (user) => set({ user, view: user ? 'home' : 'landing' }),
      setView: (view) => set({ view }),
      openNote: (id) => set({ activeNoteId: id, view: 'note-editor' }),
      openDeck: (id) => set({ activeDeckId: id, view: 'card-editor' }),
      startReview: (deckId) => set({ reviewDeckId: deckId, view: 'review' }),
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: 'recall-app-state',
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true)
      },
      // Only persist activeNoteId and activeDeckId — NOT view.
      // Persisting `view` causes a hydration mismatch: the server renders
      // with view='landing' but the client restores view='home' from
      // localStorage, which breaks React hydration in the production build.
      // The auth check in page.tsx sets the correct view after mount.
      partialize: (s) => ({
        activeNoteId: s.activeNoteId,
        activeDeckId: s.activeDeckId,
      }),
    }
  )
)
