'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import type { ApiUser } from '@/lib/types'

export function useAuth() {
  const qc = useQueryClient()
  // Use selectors so the hook only re-renders when these specific values
  // change — not on every store update (e.g. activeNoteId, activeDeckId).
  // Without selectors, useAppStore() subscribes to the entire store and
  // re-renders on every state change, which cascades with the autosave
  // invalidation loop and makes the app appear stuck/loading.
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)
  const view = useAppStore((s) => s.view)
  const setView = useAppStore((s) => s.setView)

  const { data, isLoading } = useQuery<{ user: ApiUser | null }>({
    queryKey: ['auth'],
    queryFn: () => api<{ user: ApiUser | null }>('/api/auth'),
    staleTime: 60_000,
    retry: 1,
  })

  // Sync server-side auth state → client store.
  // Only call setUser when the value actually changed, to avoid loops.
  useEffect(() => {
    if (data?.user && data.user.id !== user?.id) {
      setUser(data.user)
    } else if (data && data.user === null && user) {
      setUser(null)
    }
  }, [data, user, setUser])

  const loginMutation = useMutation({
    mutationFn: (body: { mode: 'login'; email: string; password: string }) =>
      api<{ user: ApiUser }>('/api/auth', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (res) => {
      setUser(res.user)
      qc.invalidateQueries({ queryKey: ['auth'] })
    },
  })

  const registerMutation = useMutation({
    mutationFn: (body: { mode: 'register'; email: string; password: string; name?: string }) =>
      api<{ user: ApiUser }>('/api/auth', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (res) => {
      setUser(res.user)
      qc.invalidateQueries({ queryKey: ['auth'] })
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      setUser(null)
      qc.clear()
    },
  })

  return {
    user,
    isLoading,
    view,
    setView,
    login: loginMutation.mutateAsync,
    register: registerMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
    isLoginPending: loginMutation.isPending,
    isRegisterPending: registerMutation.isPending,
  }
}
