'use client'

import { useState, useRef, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Volume2, Square, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TtsPlaybackProps {
  text: string
  label?: string
  compact?: boolean
}

/**
 * TtsPlayback — small button that converts `text` to speech via
 * /api/ai/tts and plays the returned audio inline.
 *
 * Used in the review session to let users hear the card content spoken aloud.
 * Includes loading state, click-to-stop, and a module-level audio cache.
 */
const audioCache = new Map<string, string>()

export function TtsPlayback({ text, label = 'Listen', compact }: TtsPlaybackProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Stop audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // When text changes, stop any currently playing audio.
  // The audio's onpause handler will setIsPlaying(false) for us.
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
  }, [text])

  const ttsMutation = useMutation({
    mutationFn: async (txt: string) => {
      if (audioCache.has(txt)) return { audio: audioCache.get(txt)! }
      return api<{ audio: string }>('/api/ai/tts', {
        method: 'POST',
        body: JSON.stringify({ text: txt }),
      })
    },
    onMutate: () => setIsLoading(true),
    onSuccess: (data) => {
      audioCache.set(text, data.audio)
      const audio = new Audio(`data:audio/mpeg;base64,${data.audio}`)
      audio.onended = () => { setIsPlaying(false); audioRef.current = null }
      audio.onerror = () => { setIsPlaying(false); setIsLoading(false); audioRef.current = null }
      audio.onpause = () => { if (!audio.ended) setIsPlaying(false) }
      audioRef.current = audio
      audio.play().catch(() => setIsPlaying(false))
      setIsPlaying(true)
      setIsLoading(false)
    },
    onError: () => { setIsLoading(false); setIsPlaying(false) },
  })

  const handleClick = () => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
      setIsPlaying(false)
      return
    }
    if (!text.trim()) return
    ttsMutation.mutate(text)
  }

  const disabled = !text.trim() || isLoading

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition',
        isPlaying
          ? 'border-accent-brand/40 bg-accent-brand/10 text-accent-brand'
          : 'border-hairline bg-card-surface text-secondary-recall hover:text-primary-recall',
        disabled && 'cursor-not-allowed opacity-50'
      )}
      aria-label={isPlaying ? 'Stop audio' : label}
      title={isPlaying ? 'Stop audio' : label}
    >
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : isPlaying ? (
        <Square className="h-3.5 w-3.5 fill-current" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" />
      )}
      {!compact && <span>{isPlaying ? 'Stop' : isLoading ? 'Loading' : label}</span>}
    </button>
  )
}
