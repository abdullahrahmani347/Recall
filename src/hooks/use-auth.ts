'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import type { ApiUser } from '@/lib/types'

export function useAuth() {
  const qc = useQueryClient()
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
  // NOTE: we do NOT call qc.clear() here — that would clear the auth query
  // mid-fetch, causing a loading state that interrupts GSAP animations.
  // Cache clearing happens only in the login/register/logout mutations
  // where the user explicitly changes identity.
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
      // Clear ALL cached data from any previous session before setting
      // the new user. This prevents user B from seeing user A's notes.
      qc.clear()
      setUser(res.user)
      setView('home')
    },
  })

  const registerMutation = useMutation({
    mutationFn: (body: { mode: 'register'; email: string; password: string; name?: string }) =>
      api<{ user: ApiUser }>('/api/auth', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: (res) => {
      qc.clear()
      setUser(res.user)
      setView('home')
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => api('/api/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.clear()
      setUser(null)
      setView('landing')
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
