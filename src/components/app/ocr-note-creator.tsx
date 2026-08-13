'use client'

import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { Button } from '@/components/ui/button'
import { X, Upload, Image as ImageIcon, Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/stores/app-store'

interface OcrResponse {
  note: { id: string; title: string; contentMarkdown: string }
}

/**
 * OcrNoteCreator — lets the user upload or paste an image, then uses
 * the VLM (Vision Language Model) to extract text and create a note.
 *
 * Supports:
 * - File upload (click to browse)
 * - Paste from clipboard (Ctrl+V while focused on this dialog)
 * - Drag and drop
 */
export function OcrNoteCreator({ onClose }: { onClose: () => void }) {
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const qc = useQueryClient()
  const openNote = useAppStore((s) => s.openNote)
  const setView = useAppStore((s) => s.setView)

  const ocrMutation = useMutation({
    mutationFn: (image: string) =>
      api<OcrResponse>('/api/ai/ocr', {
        method: 'POST',
        body: JSON.stringify({ image }),
      }),
    onSuccess: (data) => {
      toast.success('Note created from image!')
      qc.invalidateQueries({ queryKey: ['notes'] })
      onClose()
      setView('notes')
      setTimeout(() => openNote(data.note.id), 200)
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : 'OCR failed'),
  })

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large (max 10MB)')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      setImagePreview(result)
      // Extract base64 without the data URL prefix
      const base64 = result.split(',')[1]
      setImageBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) handleFile(file)
        e.preventDefault()
        break
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const handleExtract = () => {
    if (!imageBase64) return
    ocrMutation.mutate(imageBase64)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
      onPaste={handlePaste}
      tabIndex={0}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-hairline bg-card-surface p-6 shadow-floating animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Create note from image"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-accent-brand" />
            Note from Image
          </h2>
          <button onClick={onClose} className="text-muted-recall hover:text-primary-recall" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!imagePreview ? (
          <div
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition ${
              isDragging ? 'border-accent-brand bg-accent-brand-dim' : 'border-hairline'
            }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <Upload className="mb-3 h-8 w-8 text-muted-recall" />
            <p className="text-sm font-medium">Drop an image or click to upload</p>
            <p className="mt-1 text-xs text-muted-recall">
              Paste from clipboard (Ctrl+V), drag &amp; drop, or browse
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              variant="ghost"
              size="sm"
              className="mt-4 border border-hairline"
            >
              Choose image
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
                e.target.value = ''
              }}
            />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative rounded-xl border border-hairline overflow-hidden">
              <img src={imagePreview} alt="Preview" className="max-h-[40vh] w-full object-contain bg-void" />
              <button
                onClick={() => { setImagePreview(null); setImageBase64(null) }}
                className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-void/80 text-secondary-recall hover:text-grade-again"
                aria-label="Remove image"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex justify-end gap-2">
              <Button onClick={() => { setImagePreview(null); setImageBase64(null) }} variant="ghost" size="sm">
                Change
              </Button>
              <Button
                onClick={handleExtract}
                disabled={ocrMutation.isPending}
                className="bg-accent-brand text-void hover:bg-accent-brand/90"
                size="sm"
              >
                {ocrMutation.isPending ? (
                  <><Loader2 className="mr-1 h-4 w-4 animate-spin" />Extracting…</>
                ) : (
                  <><Sparkles className="mr-1 h-4 w-4" />Extract &amp; Create Note</>
                )}
              </Button>
            </div>
          </div>
        )}

        <p className="mt-3 text-center text-[11px] text-muted-recall">
          The AI will extract text from your image and create a new note
        </p>
      </div>
    </div>
  )
}
