'use client'

import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useAppStore } from '@/stores/app-store'
import { ArrowRight } from 'lucide-react'
import { useRef, useEffect, useState } from 'react'

interface GraphNode {
  id: string
  label: string
  updatedAt: string
  x: number
  y: number
  vx: number
  vy: number
}

interface GraphEdge {
  source: string
  target: string
}

interface GraphData {
  nodes: { id: string; label: string; updatedAt: string }[]
  edges: GraphEdge[]
}

/**
 * GraphView — force-directed knowledge graph visualization.
 *
 * Shows all notes as nodes and NoteLink relationships as edges.
 * Uses a simple force simulation (repulsion + spring attraction)
 * computed on canvas for performance. Click a node to open the note.
 */
export function GraphView() {
  const openNote = useAppStore((s) => s.openNote)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const nodesRef = useRef<GraphNode[]>([])
  const edgesRef = useRef<GraphEdge[]>([])
  const rafRef = useRef<number>(0)

  const { data, isLoading } = useQuery<GraphData>({
    queryKey: ['graph'],
    queryFn: () => api<GraphData>('/api/graph'),
  })

  // Initialize node positions in a circle
  useEffect(() => {
    if (!data) return
    const nodes: GraphNode[] = data.nodes.map((n, i) => {
      const angle = (i / data.nodes.length) * Math.PI * 2
      const r = 200
      return {
        ...n,
        x: Math.cos(angle) * r + 400,
        y: Math.sin(angle) * r + 300,
        vx: 0,
        vy: 0,
      }
    })
    nodesRef.current = nodes
    edgesRef.current = data.edges
  }, [data])

  // Force simulation + render loop
  useEffect(() => {
    if (!data || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (rect) {
        canvas.width = rect.width * window.devicePixelRatio
        canvas.height = rect.height * window.devicePixelRatio
        canvas.style.width = `${rect.width}px`
        canvas.style.height = `${rect.height}px`
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
      }
    }
    resize()
    window.addEventListener('resize', resize)

    const simulate = () => {
      const nodes = nodesRef.current
      const edges = edgesRef.current
      if (nodes.length === 0) {
        rafRef.current = requestAnimationFrame(simulate)
        return
      }

      // Repulsion between all nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x
          const dy = nodes[j].y - nodes[i].y
          const dist = Math.sqrt(dx * dx + dy * dy) || 1
          const force = 2000 / (dist * dist)
          const fx = (dx / dist) * force
          const fy = (dy / dist) * force
          nodes[i].vx -= fx
          nodes[i].vy -= fy
          nodes[j].vx += fx
          nodes[j].vy += fy
        }
      }

      // Spring attraction for edges
      const nodeMap = new Map(nodes.map((n) => [n.id, n]))
      for (const edge of edges) {
        const source = nodeMap.get(edge.source)
        const target = nodeMap.get(edge.target)
        if (!source || !target) continue
        const dx = target.x - source.x
        const dy = target.y - source.y
        const dist = Math.sqrt(dx * dx + dy * dy) || 1
        const force = (dist - 150) * 0.01
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force
        source.vx += fx
        source.vy += fy
        target.vx -= fx
        target.vy -= fy
      }

      // Center gravity
      const cx = canvas.width / (2 * window.devicePixelRatio)
      const cy = canvas.height / (2 * window.devicePixelRatio)
      for (const node of nodes) {
        node.vx += (cx - node.x) * 0.001
        node.vy += (cy - node.y) * 0.001
      }

      // Apply velocity with damping
      for (const node of nodes) {
        node.vx *= 0.85
        node.vy *= 0.85
        node.x += node.vx
        node.y += node.vy
      }

      // Render
      const w = canvas.width / window.devicePixelRatio
      const h = canvas.height / window.devicePixelRatio
      ctx.clearRect(0, 0, w, h)

      // Draw edges
      ctx.strokeStyle = 'rgba(124, 125, 133, 0.15)'
      ctx.lineWidth = 1
      for (const edge of edges) {
        const source = nodeMap.get(edge.source)
        const target = nodeMap.get(edge.target)
        if (!source || !target) continue
        ctx.beginPath()
        ctx.moveTo(source.x, source.y)
        ctx.lineTo(target.x, target.y)
        ctx.stroke()
      }

      // Draw nodes
      for (const node of nodes) {
        const isHovered = node.id === hoveredNode
        const hasLinks = edges.some((e) => e.source === node.id || e.target === node.id)

        // Node circle
        ctx.beginPath()
        ctx.arc(node.x, node.y, isHovered ? 6 : 4, 0, Math.PI * 2)
        ctx.fillStyle = isHovered
          ? '#34E7A8'
          : hasLinks
            ? '#34E7A8'
            : '#7A7D85'
        ctx.fill()

        // Label on hover
        if (isHovered) {
          ctx.font = '12px Inter, sans-serif'
          ctx.fillStyle = '#F2F3F5'
          ctx.textAlign = 'center'
          ctx.fillText(node.label.slice(0, 30), node.x, node.y - 12)
        }
      }

      rafRef.current = requestAnimationFrame(simulate)
    }

    rafRef.current = requestAnimationFrame(simulate)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', resize)
    }
  }, [data, hoveredNode])

  // Mouse interaction
  const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    let hovered: string | null = null
    for (const node of nodesRef.current) {
      const dx = node.x - x
      const dy = node.y - y
      if (Math.sqrt(dx * dx + dy * dy) < 10) {
        hovered = node.id
        break
      }
    }
    setHoveredNode(hovered)
    canvas.style.cursor = hovered ? 'pointer' : 'default'
  }

  const onClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (hoveredNode) {
      openNote(hoveredNode)
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-muted-recall">Loading graph...</p>
      </div>
    )
  }

  const nodeCount = data?.nodes.length ?? 0
  const edgeCount = data?.edges.length ?? 0

  return (
    <div className="mx-auto max-w-5xl px-4 pb-8 pt-6 sm:px-6">
      <header className="mb-6 flex items-center justify-between animate-fade-in-up">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-muted-recall">
            Knowledge graph
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight sm:text-3xl">
            Graph
          </h1>
        </div>
        <div className="flex gap-4 text-xs text-muted-recall">
          <span><span className="font-semibold text-primary-recall">{nodeCount}</span> notes</span>
          <span><span className="font-semibold text-primary-recall">{edgeCount}</span> links</span>
        </div>
      </header>

      {nodeCount === 0 ? (
        <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
          <p className="font-medium">No notes yet</p>
          <p className="mt-1 text-sm text-secondary-recall">
            Create notes and use <code className="rounded bg-card-surface px-1.5 py-0.5 text-accent-brand">[[links]]</code> to connect them.
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          className="relative h-[60vh] overflow-hidden rounded-2xl border border-hairline bg-card-surface"
        >
          <canvas
            ref={canvasRef}
            onMouseMove={onMouseMove}
            onClick={onClick}
            className="absolute inset-0 h-full w-full"
          />
          {/* Hint */}
          <div className="absolute bottom-3 left-3 rounded-md bg-void/80 px-2.5 py-1.5 text-[10px] text-muted-recall backdrop-blur">
            Click a node to open · Use <code className="text-accent-brand">[[links]]</code> in notes to connect
          </div>
        </div>
      )}
    </div>
  )
}
