'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Brain, ArrowLeft, Loader2 } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'
import { toast } from 'sonner'

export function AuthScreen() {
  const { login, register, setView } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [pending, setPending] = useState(false)

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPending(true)
    try {
      if (mode === 'login') {
        await login({ mode: 'login', email, password })
        toast.success('Welcome back')
      } else {
        await register({ mode: 'register', email, password, name: name || undefined })
        toast.success('Account created')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-canvas text-foreground">
      <div className="absolute inset-0 -z-10 hero-gradient-fallback" aria-hidden="true" />

      <header className="mx-auto flex w-full max-w-md items-center px-6 py-6">
        <button
          onClick={() => useAppStore.getState().setView('landing')}
          className="inline-flex items-center gap-2 text-sm text-secondary-recall transition hover:text-primary-recall"
          aria-label="Back to landing page"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-12">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-brand text-void">
            <Brain className="h-6 w-6" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="mt-2 text-sm text-secondary-recall">
            {mode === 'login'
              ? 'Log in to continue your study streak.'
              : 'Start capturing notes and reviewing in under a minute.'}
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          {mode === 'register' && (
            <div className="space-y-2">
              <Label htmlFor="name">Display name (optional)</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="bg-card-surface"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="bg-card-surface"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="bg-card-surface"
            />
          </div>

          <Button
            type="submit"
            disabled={pending}
            className="w-full bg-accent-brand text-void hover:bg-accent-brand/90"
          >
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {mode === 'login' ? 'Log in' : 'Create account'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-secondary-recall">
          {mode === 'login' ? "Don't have an account?" : 'Already registered?'}{' '}
          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            className="font-medium text-accent-brand underline-offset-4 hover:underline"
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </main>
    </div>
  )
}
