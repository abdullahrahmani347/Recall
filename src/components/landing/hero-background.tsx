'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * HeroBackground - custom WebGL shader animation.
 *
 * Replaces the generic Three.js particle field with a bespoke shader
 * that renders a "neural drift" - flowing noise fields with the Recall
 * brand gradient (green to amber), creating an organic, ambient backdrop
 * that evokes memory formation without being literal.
 *
 * No Three.js dependency - raw WebGL2 with a custom fragment shader.
 * ~4KB of JS vs ~150KB for Three.js. Renders at 30fps cap, pauses on
 * tab hide, and falls back to a CSS gradient on any WebGL error.
 *
 * The shader paints a domain-warped simplex noise field with two color
 * stops (accent-brand and accent-warm) that drift slowly over time.
 * The result reads as "flowing thought" - organic, not mechanical.
 */

type Quality = 'shader' | 'static'

function canRunShader(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false

  const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection
  if (conn?.saveData) return false
  if (conn?.effectiveType && ['slow-2g', '2g'].includes(conn.effectiveType)) return false

  const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory
  if (typeof memory === 'number' && memory < 4) return false

  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
    return !!gl
  } catch {
    return false
  }
}

const VERTEX_SHADER = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_color1; // accent-brand (green)
uniform vec3 u_color2; // accent-warm (amber)
uniform vec3 u_color3; // deep void

// Simplex noise - classic Ashima implementation
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                     -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
        + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m;
  m = m*m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Domain-warped fractal Brownian motion - creates organic flow
float fbm(vec2 p, float t) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(t * 0.03, t * 0.02);
  for (int i = 0; i < 5; i++) {
    v += a * snoise(p + shift);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv * 3.0;
  p.x *= u_resolution.x / u_resolution.y;

  float t = u_time * 0.08;

  // Domain warping - creates the "flowing thought" look
  vec2 q = vec2(
    fbm(p + vec2(0.0, 0.0), t),
    fbm(p + vec2(5.2, 1.3), t)
  );

  vec2 r = vec2(
    fbm(p + 4.0 * q + vec2(1.7, 9.2), t),
    fbm(p + 4.0 * q + vec2(8.3, 2.8), t)
  );

  float f = fbm(p + 4.0 * r, t);

  // Color mixing - green dominant, amber accents in the "peaks"
  vec3 col = mix(u_color3, u_color1, smoothstep(-0.2, 0.6, f));
  col = mix(col, u_color2, smoothstep(0.3, 0.8, length(r)) * 0.5);

  // Subtle vignette - darker edges, draws eye to center
  float vignette = smoothstep(1.2, 0.3, length(uv - 0.5) * 1.5);
  col *= vignette;

  // Very subtle grain - prevents banding on dark gradients
  float grain = fract(sin(dot(uv, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * 0.015;

  // Overall brightness - keep it dark and ambient
  col *= 0.45;

  gl_FragColor = vec4(col, 1.0);
}
`

export function HeroBackground({ visible }: { visible: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [useShader, setUseShader] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!visible) return
    setUseShader(canRunShader())
  }, [visible])

  useEffect(() => {
    if (!useShader || !canvasRef.current || !visible) return

    const canvas = canvasRef.current
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
    }) as WebGL2RenderingContext | null

    if (!gl) {
      setUseShader(false)
      return
    }

    let mounted = true
    let raf = 0

    // Compile shaders
    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type)
      if (!shader) return null
      gl.shaderSource(shader, source)
      gl.compileShader(shader)
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader)
        return null
      }
      return shader
    }

    const vs = compileShader(gl.VERTEX_SHADER, VERTEX_SHADER)
    const fs = compileShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vs || !fs) {
      setUseShader(false)
      return
    }

    const program = gl.createProgram()
    if (!program) return
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setUseShader(false)
      return
    }
    gl.useProgram(program)

    // Full-screen quad
    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1, 1,   1, -1,   1, 1,
    ]), gl.STATIC_DRAW)

    const posLoc = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)

    // Uniforms
    const resLoc = gl.getUniformLocation(program, 'u_resolution')
    const timeLoc = gl.getUniformLocation(program, 'u_time')
    const c1Loc = gl.getUniformLocation(program, 'u_color1')
    const c2Loc = gl.getUniformLocation(program, 'u_color2')
    const c3Loc = gl.getUniformLocation(program, 'u_color3')

    // Brand colors (normalized 0–1)
    // accent-brand: #34E7A8 to 0.204, 0.906, 0.659
    // accent-warm:  #FFB454 to 1.0, 0.706, 0.329
    // void:         #07080A to 0.027, 0.031, 0.039
    gl.useProgram(program)
    gl.uniform3f(c1Loc, 0.204, 0.906, 0.659)
    gl.uniform3f(c2Loc, 1.0, 0.706, 0.329)
    gl.uniform3f(c3Loc, 0.027, 0.031, 0.039)

    // Resize handler - cap DPR at 1.5 for perf
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 1.5)
      const w = canvas.clientWidth * dpr
      const h = canvas.clientHeight * dpr
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
        gl.viewport(0, 0, w, h)
      }
    }
    resize()
    window.addEventListener('resize', resize)

    // Render loop - capped at 30fps
    const frameInterval = 1000 / 30
    let lastFrame = 0
    const startTime = performance.now()

    const render = (now: number) => {
      if (!mounted) return
      raf = requestAnimationFrame(render)
      if (now - lastFrame < frameInterval) return
      lastFrame = now

      const time = (now - startTime) / 1000
      gl.uniform2f(resLoc, canvas.width, canvas.height)
      gl.uniform1f(timeLoc, time)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
    raf = requestAnimationFrame(render)
    setLoaded(true)

    // Pause on tab hide
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf)
      } else {
        raf = requestAnimationFrame(render)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      mounted = false
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      gl.deleteBuffer(positionBuffer)
    }
  }, [useShader, visible])

  return (
    <div className="absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* CSS gradient fallback - always present underneath */}
      <div className="absolute inset-0 hero-gradient-fallback" />

      {/* WebGL shader canvas */}
      {useShader && (
        <canvas
          ref={canvasRef}
          className={`absolute inset-0 h-full w-full transition-opacity duration-1000 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
        />
      )}

      {/* Subtle grid overlay - adds structure without dominating */}
      <div
        className="absolute inset-0 opacity-[0.015]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #F2F3F5 1px, transparent 1px), linear-gradient(to bottom, #F2F3F5 1px, transparent 1px)',
          backgroundSize: '64px 64px',
        }}
      />

      {/* Top gradient fade - blends hero into nav */}
      <div className="absolute inset-x-0 top-0 h-32 hero-fade-top" />
      {/* Bottom fade - blends hero into next section */}
      <div className="absolute inset-x-0 bottom-0 h-32 hero-fade-bottom" />
    </div>
  )
}
