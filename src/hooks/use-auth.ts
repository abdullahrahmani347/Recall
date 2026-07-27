'use client'

import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import type { ApiUser } from '@/lib/types'

export function useAuth() {
  const qc = useQueryClient()
  const { user, setUser, view, setView } = useAppStore()

  const { data, isLoading } = useQuery<{ user: ApiUser | null }>({
    queryKey: ['auth'],
    queryFn: () => api<{ user: ApiUser | null }>('/api/auth'),
    staleTime: 60_000,
  })

  // Sync server-side auth state → client store
  useEffect(() => {
    if (data?.user && !user) {
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
