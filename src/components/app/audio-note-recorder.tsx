'use client'

import { useState, useRef } from 'react'
import { api } from '@/lib/api-client'
import { Mic, Square, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface AudioNoteRecorderProps {
  onTranscribed: (text: string) => void
}

/**
 * AudioNoteRecorder — records audio from the microphone, sends it to
 * the server for ASR (Automatic Speech Recognition) transcription,
 * and appends the transcribed text to the note.
 *
 * Uses the MediaRecorder API for recording. The audio is sent as
 * base64 to /api/ai/transcribe which calls z-ai-web-dev-sdk's ASR.
 */
export function AudioNoteRecorder({ onTranscribed }: AudioNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' })
        stream.getTracks().forEach((t) => t.stop())

        if (audioBlob.size < 1000) return // too small, probably empty

        setIsTranscribing(true)
        try {
          const reader = new FileReader()
          reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1]
            try {
              const res = await api<{ text: string }>('/api/ai/transcribe', {
                method: 'POST',
                body: JSON.stringify({ audio: base64Audio }),
              })
              if (res.text) {
                onTranscribed(res.text)
                toast.success('Transcribed — added to note')
              }
            } catch (err) {
              toast.error(err instanceof Error ? err.message : 'Transcription failed')
            } finally {
              setIsTranscribing(false)
            }
          }
          reader.readAsDataURL(audioBlob)
        } catch {
          setIsTranscribing(false)
          toast.error('Failed to process audio')
        }
      }

      recorder.start()
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      toast.info('Recording… click stop when done')
    } catch {
      toast.error('Microphone access denied')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }

  if (isTranscribing) {
    return (
      <div className="inline-flex items-center gap-2 rounded-full border border-accent-brand/30 bg-accent-brand/5 px-3 py-1.5 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-brand" />
        <span className="text-accent-brand">Transcribing…</span>
      </div>
    )
  }

  if (isRecording) {
    return (
      <button
        onClick={stopRecording}
        className="inline-flex items-center gap-2 rounded-full border border-grade-again/40 bg-grade-again/10 px-3 py-1.5 text-xs font-medium text-grade-again press"
      >
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-grade-again opacity-60" />
          <span className="relative inline-flex h-3 w-3 items-center justify-center">
            <Square className="h-2.5 w-2.5 fill-current" />
          </span>
        </span>
        Stop recording
      </button>
    )
  }

  return (
    <button
      onClick={startRecording}
      className="inline-flex items-center gap-1.5 text-xs text-muted-recall hover:text-accent-brand"
    >
      <Mic className="h-3.5 w-3.5" />
      Record
    </button>
  )
}
