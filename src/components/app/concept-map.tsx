'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { X, Loader2, Network, Sparkles } from 'lucide-react'
import { useAppStore } from '@/stores/app-store'

interface ConceptNode {
  id: string
  label: string
  noteIds: string[]
}

interface ConceptEdge {
  id: string
  source: string
  target: string
  label: string
}

interface ConceptMapResponse {
  nodes: ConceptNode[]
  edges: ConceptEdge[]
  noteCount?: number
  message?: string
}

export function ConceptMap({ onClose }: { onClose: () => void }) {
  const { data, isLoading, error } = useQuery<ConceptMapResponse>({
    queryKey: ['concept-map'],
    queryFn: () => api<ConceptMapResponse>('/api/ai/concept-map'),
  })
  const openNote = useAppStore((s) => s.openNote)
  const setView = useAppStore((s) => s.setView)

  // Build SVG layout — simple circular layout
  const nodeCount = data?.nodes?.length || 0
  const radius = Math.min(180, 40 + nodeCount * 12)
  const centerX = 250
  const centerY = 250

  const nodePositions = new Map<string, { x: number; y: number }>()
  data?.nodes?.forEach((node, i) => {
    const angle = (i / Math.max(nodeCount, 1)) * 2 * Math.PI - Math.PI / 2
    nodePositions.set(node.id, {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    })
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-hairline bg-card-surface p-6 shadow-floating animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="AI concept map"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold flex items-center gap-2">
            <Network className="h-5 w-5 text-accent-brand" />
            AI Concept Map
          </h2>
          <button onClick={onClose} className="text-muted-recall hover:text-primary-recall" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-recall">
          AI-extracted key concepts and their relationships from your notes
        </p>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-accent-brand" />
            <p className="mt-3 text-sm text-muted-recall">Analyzing your notes and extracting concepts…</p>
          </div>
        )}

        {error && (
          <div className="py-12 text-center">
            <p className="text-sm text-grade-again">Failed to generate concept map</p>
            <p className="mt-1 text-xs text-muted-recall">{error instanceof Error ? error.message : 'Unknown error'}</p>
          </div>
        )}

        {data && data.nodes.length === 0 && !isLoading && (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-recall">{data.message || 'No concepts found. Create more notes first.'}</p>
          </div>
        )}

        {data && data.nodes.length > 0 && !isLoading && (
          <>
            <div className="overflow-auto rounded-xl border border-hairline bg-void">
              <svg viewBox="0 0 500 500" className="w-full h-auto min-h-[400px]">
                {/* Edges */}
                {data.edges.map((edge) => {
                  const source = nodePositions.get(edge.source)
                  const target = nodePositions.get(edge.target)
                  if (!source || !target) return null
                  return (
                    <g key={edge.id}>
                      <line
                        x1={source.x}
                        y1={source.y}
                        x2={target.x}
                        y2={target.y}
                        stroke="var(--border-hairline)"
                        strokeWidth="1.5"
                      />
                      <text
                        x={(source.x + target.x) / 2}
                        y={(source.y + target.y) / 2}
                        fill="var(--text-muted)"
                        fontSize="9"
                        textAnchor="middle"
                        dy="-2"
                      >
                        {edge.label}
                      </text>
                    </g>
                  )
                })}
                {/* Nodes */}
                {data.nodes.map((node) => {
                  const pos = nodePositions.get(node.id)
                  if (!pos) return null
                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer"
                      onClick={() => {
                        if (node.noteIds.length > 0) {
                          setView('notes')
                          setTimeout(() => openNote(node.noteIds[0]), 200)
                          onClose()
                        }
                      }}
                    >
                      <circle
                        cx={pos.x}
                        cy={pos.y}
                        r={Math.max(22, Math.min(36, 20 + node.noteIds.length * 3))}
                        fill="var(--accent-brand-dim)"
                        stroke="var(--accent-brand)"
                        strokeWidth="2"
                      />
                      <text
                        x={pos.x}
                        y={pos.y}
                        fill="var(--text-primary)"
                        fontSize="10"
                        fontWeight="600"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        {node.label.length > 14 ? node.label.slice(0, 12) + '…' : node.label}
                      </text>
                      {node.noteIds.length > 1 && (
                        <text
                          x={pos.x}
                          y={pos.y + 14}
                          fill="var(--text-muted)"
                          fontSize="8"
                          textAnchor="middle"
                        >
                          {node.noteIds.length} notes
                        </text>
                      )}
                    </g>
                  )
                })}
              </svg>
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-recall">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-full border-2 border-accent-brand bg-accent-brand-dim" />
                Concept (click to open related note)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-5 bg-hairline" />
                Relationship
              </span>
              <span>Generated from {data.noteCount || 0} notes</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
