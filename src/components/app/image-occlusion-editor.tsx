'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Upload, X, Plus, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface Occlusion {
  id: string
  x: number
  y: number
  w: number
  h: number
  label: string
}

interface ImageOcclusionEditorProps {
  onCreate: (cards: { imageUrl: string; occlusions: Occlusion[] }) => void
  onClose: () => void
}

/**
 * ImageOcclusionEditor — lets the user upload an image and draw
 * rectangles over labels to create image-occlusion cards.
 *
 * Each rectangle becomes a separate card where the occluded area
 * is hidden during review, and the user must recall what's behind it.
 */
export function ImageOcclusionEditor({ onCreate, onClose }: ImageOcclusionEditorProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [occlusions, setOcclusions] = useState<Occlusion[]>([])
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentRect, setCurrentRect] = useState<Occlusion | null>(null)
  const [uploading, setUploading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const onUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large (max 5MB)')
      return
    }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = () => {
      setImageUrl(reader.result as string)
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const onMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setDrawing(true)
    setStartPos({ x, y })
    setCurrentRect({ id: `occ-${Date.now()}`, x, y, w: 0, h: 0, label: '' })
  }

  const onMouseMove = (e: React.MouseEvent) => {
    if (!drawing || !currentRect || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setCurrentRect({
      ...currentRect,
      x: Math.min(startPos.x, x),
      y: Math.min(startPos.y, y),
      w: Math.abs(x - startPos.x),
      h: Math.abs(y - startPos.y),
    })
  }

  const onMouseUp = () => {
    if (drawing && currentRect && currentRect.w > 2 && currentRect.h > 2) {
      setOcclusions([...occlusions, currentRect])
    }
    setDrawing(false)
    setCurrentRect(null)
  }

  const removeOcclusion = (id: string) => {
    setOcclusions(occlusions.filter((o) => o.id !== id))
  }

  const updateLabel = (id: string, label: string) => {
    setOcclusions(occlusions.map((o) => (o.id === id ? { ...o, label } : o)))
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-hairline bg-card-surface p-5 shadow-floating animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Image occlusion editor"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Image occlusion cards</h2>
          <button onClick={onClose} className="text-muted-recall hover:text-primary-recall" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!imageUrl ? (
          <div className="flex flex-1 flex-col items-center justify-center rounded-xl border-2 border-dashed border-hairline p-12">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-accent-brand" />
            ) : (
              <>
                <Upload className="mb-3 h-8 w-8 text-muted-recall" />
                <p className="text-sm font-medium">Upload an image</p>
                <p className="mt-1 text-xs text-muted-recall">
                  Diagram, anatomy chart, map — draw boxes over labels to hide them during review
                </p>
                <label className="mt-4 cursor-pointer rounded-full bg-accent-brand px-4 py-2 text-sm font-medium text-void press hover:bg-accent-brand/90">
                  Choose image
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) onUpload(f)
                      e.target.value = ''
                    }}
                  />
                </label>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-1 gap-4 overflow-hidden">
            {/* Image canvas */}
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              <div
                ref={containerRef}
                className="relative inline-block cursor-crosshair"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseUp}
              >
                <img
                  src={imageUrl}
                  alt="Occlusion source"
                  className="block max-w-full select-none rounded-lg"
                  draggable={false}
                />
                {/* Existing occlusions */}
                {occlusions.map((occ, i) => (
                  <div
                    key={occ.id}
                    className="absolute border-2 border-accent-brand bg-accent-brand/30"
                    style={{
                      left: `${occ.x}%`,
                      top: `${occ.y}%`,
                      width: `${occ.w}%`,
                      height: `${occ.h}%`,
                    }}
                  >
                    <span className="absolute -top-5 left-0 rounded bg-accent-brand px-1 text-[10px] font-bold text-void">
                      {i + 1}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeOcclusion(occ.id) }}
                      className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-grade-again text-void"
                      aria-label="Remove occlusion"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
                {/* Currently drawing */}
                {currentRect && (
                  <div
                    className="absolute border-2 border-accent-warm bg-accent-warm/20"
                    style={{
                      left: `${currentRect.x}%`,
                      top: `${currentRect.y}%`,
                      width: `${currentRect.w}%`,
                      height: `${currentRect.h}%`,
                    }}
                  />
                )}
              </div>
            </div>

            {/* Occlusion list */}
            <div className="w-56 shrink-0 space-y-2 overflow-y-auto scrollbar-thin">
              <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">
                {occlusions.length} occlusion{occlusions.length === 1 ? '' : 's'}
              </p>
              {occlusions.map((occ, i) => (
                <div key={occ.id} className="rounded-lg border border-hairline bg-void p-2">
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-accent-brand text-[10px] font-bold text-void">
                      {i + 1}
                    </span>
                    <input
                      value={occ.label}
                      onChange={(e) => updateLabel(occ.id, e.target.value)}
                      placeholder="Label (optional)"
                      className="flex-1 bg-transparent text-xs placeholder:text-muted-recall focus:outline-none"
                    />
                    <button onClick={() => removeOcclusion(occ.id)} className="text-muted-recall hover:text-grade-again">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
              {occlusions.length === 0 && (
                <p className="text-xs text-muted-recall">
                  Drag on the image to draw rectangles over the labels you want to hide.
                </p>
              )}
            </div>
          </div>
        )}

        {imageUrl && occlusions.length > 0 && (
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => onCreate({ imageUrl: imageUrl!, occlusions })}
              className="bg-accent-brand text-void hover:bg-accent-brand/90"
            >
              <Plus className="mr-1 h-4 w-4" />
              Create {occlusions.length} card{occlusions.length === 1 ? '' : 's'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
