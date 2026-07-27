'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Hero3D — lazy-loaded, ambient Three.js scene.
 *
 * Per §3 of the product brief:
 * - Loaded AFTER LCP via dynamic import + IntersectionObserver
 * - Cap to 30fps on devicePixelRatio > 1 devices
 * - Skip entirely on low-memory devices (navigator.deviceMemory < 4)
 * - Pause render loop when tab is hidden (Page Visibility API)
 * - Mandatory fallbacks: no WebGL → CSS gradient; prefers-reduced-motion → static;
 *   saveData / slow connection → skip bundle download
 *
 * The scene itself is a slow drifting particle field — an ambient
 * "memory forming" abstraction. No orbit controls, no interaction.
 */

type Quality = 'full' | 'reduced' | 'static'

function pickQuality(): Quality {
  if (typeof window === 'undefined') return 'static'
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduceMotion) return 'static'

  const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (conn?.saveData) return 'static'
  if (conn?.effectiveType && ['slow-2g', '2g'].includes(conn.effectiveType)) return 'static'

  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory
  if (typeof memory === 'number' && memory < 4) return 'static'

  // Check WebGL availability
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    if (!gl) return 'static'
  } catch {
    return 'static'
  }

  // Cap to 30fps on high-DPR devices
  if (window.devicePixelRatio > 1) return 'reduced'
  return 'full'
}

export function Hero3D({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [quality, setQuality] = useState<Quality>('static')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!visible) return
    setQuality(pickQuality())
  }, [visible])

  useEffect(() => {
    if (quality === 'static' || !canvasRef.current) return
    if (!visible) return

    let renderer: import('three').WebGLRenderer | null = null
    let scene: import('three').Scene | null = null
    let camera: import('three').PerspectiveCamera | null = null
    let raf = 0
    let mounted = true

    // Dynamic import — never block first paint on the Three.js bundle
    import('three')
      .then((THREE) => {
        if (!mounted || !canvasRef.current) return

        const canvas = canvasRef.current
        scene = new THREE.Scene()
        camera = new THREE.PerspectiveCamera(
          60,
          canvas.clientWidth / canvas.clientHeight || 1,
          0.1,
          1000
        )
        camera.position.z = 60

        renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: quality === 'full',
          alpha: true,
          powerPreference: 'low-power',
        })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'reduced' ? 1 : 2))
        renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || 400, false)

        // Particle field — "memory forming" abstraction
        const PARTICLE_COUNT = quality === 'reduced' ? 600 : 1200
        const positions = new Float32Array(PARTICLE_COUNT * 3)
        const colors = new Float32Array(PARTICLE_COUNT * 3)
        const sizes = new Float32Array(PARTICLE_COUNT)

        const c1 = new THREE.Color('#34E7A8') // accent-brand
        const c2 = new THREE.Color('#FFB454') // accent-warm
        const c3 = new THREE.Color('#4C8CFF') // easy-grade (subtle blue accent)

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const i3 = i * 3
          // Distribute in a loose sphere shell
          const r = 20 + Math.random() * 40
          const theta = Math.random() * Math.PI * 2
          const phi = Math.acos(2 * Math.random() - 1)
          positions[i3] = r * Math.sin(phi) * Math.cos(theta)
          positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta)
          positions[i3 + 2] = r * Math.cos(phi)

          const mix = Math.random()
          const c = mix < 0.7 ? c1 : mix < 0.9 ? c2 : c3
          colors[i3] = c.r
          colors[i3 + 1] = c.g
          colors[i3 + 2] = c.b

          sizes[i] = 0.4 + Math.random() * 1.2
        }

        const geometry = new THREE.BufferGeometry()
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1))

        const material = new THREE.PointsMaterial({
          size: 0.6,
          vertexColors: true,
          transparent: true,
          opacity: 0.85,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          sizeAttenuation: true,
        })

        const points = new THREE.Points(geometry, material)
        scene.add(points)

        // Slow ambient drift
        const targetFps = quality === 'reduced' ? 30 : 60
        const frameInterval = 1000 / targetFps
        let lastFrame = 0

        const render = (now: number) => {
          if (!mounted) return
          raf = requestAnimationFrame(render)
          if (now - lastFrame < frameInterval) return
          lastFrame = now

          points.rotation.y += 0.0009
          points.rotation.x += 0.0003
          // Gentle parallax based on time
          camera.position.x = Math.sin(now * 0.00008) * 5
          camera.position.y = Math.cos(now * 0.00006) * 3
          camera.lookAt(0, 0, 0)

          if (renderer && scene && camera) {
            renderer.render(scene, camera)
          }
        }
        raf = requestAnimationFrame(render)

        // Pause on tab hide
        const onVisibility = () => {
          if (document.hidden) {
            cancelAnimationFrame(raf)
          } else {
            raf = requestAnimationFrame(render)
          }
        }
        document.addEventListener('visibilitychange', onVisibility)

        const onResize = () => {
          if (!canvas || !renderer) return
          renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || 400, false)
        }
        window.addEventListener('resize', onResize)

        setLoaded(true)

        return () => {
          mounted = false
          cancelAnimationFrame(raf)
          document.removeEventListener('visibilitychange', onVisibility)
          window.removeEventListener('resize', onResize)
          geometry.dispose()
          material.dispose()
          renderer?.dispose()
        }
      })
      .catch(() => {
        // If three fails to load, fall back to gradient (already showing underneath)
        setQuality('static')
      })

    return () => {
      mounted = false
      cancelAnimationFrame(raf)
      renderer?.dispose()
    }
  }, [quality, visible])

  return (
    <div
      className="absolute inset-0 -z-10 overflow-hidden"
      aria-hidden="true"
    >
      {/* Always-present CSS gradient fallback underneath the canvas */}
      <div className="absolute inset-0 hero-gradient-fallback" />

      {/* WebGL canvas — only rendered when quality allows */}
      {quality !== 'static' && (
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full transition-opacity duration-700 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}
    </div>
  )
}
