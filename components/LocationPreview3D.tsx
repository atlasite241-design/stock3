'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Move3d, Pause, Play, RotateCcw } from 'lucide-react'

export interface Preview3DLabels {
  title: string
  empty: string
  zone: string
  allee: string
  rayon: string
  etagere: string
  niveau: string
  position: string
  spin: string
  reset: string
  drag: string
  simplified: string
}

interface Props {
  rayons: number
  etageres: number
  niveaux: number
  positions: number
  labels: Preview3DLabels
  zone?: string
  allee?: string
  code?: string
}

// Palette de teintes pour distinguer les rayons.
const HUES = ['#f59e0b', '#6366f1', '#10b981', '#ef4444', '#0ea5e9', '#a855f7', '#f43f5e', '#84cc16', '#14b8a6', '#eab308']
const hexRgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]

// Rotation d'un vecteur : lacet (Y) puis tangage (X).
function rot(x: number, y: number, z: number, cy: number, sy: number, cp: number, sp: number) {
  const x1 = x * cy + z * sy
  const z1 = -x * sy + z * cy
  const y2 = y * cp - z1 * sp
  const z2 = y * sp + z1 * cp
  return { x: x1, y: y2, z: z2 }
}

const BOX_CAP = 2600 // garde-fou : au-delà on simplifie / borne le rendu

export default function LocationPreview3D({ rayons, etageres, niveaux, positions, labels, zone, allee, code }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const view = useRef({ yaw: -0.62, pitch: -0.5, zoom: 1 })
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const raf = useRef<number | null>(null)
  const dims = useRef({ w: 0, h: 0 })

  const [spin, setSpin] = useState(true)
  const spinRef = useRef(true)
  const [simplified, setSimplified] = useState(false)
  const props = useRef({ rayons, etageres, niveaux, positions })
  props.current = { rayons, etageres, niveaux, positions }

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const { w, h } = dims.current
    if (w === 0 || h === 0) return
    ctx.clearRect(0, 0, w, h)

    const R = Math.max(0, Math.floor(props.current.rayons))
    const E = Math.max(0, Math.floor(props.current.etageres))
    const N = Math.max(0, Math.floor(props.current.niveaux))
    const P = Math.max(0, Math.floor(props.current.positions))
    if (R === 0 || E === 0 || N === 0 || P === 0) return

    // Géométrie : une boîte par (rayon, étagère, niveau). Si trop d'unités,
    // on regroupe les niveaux (boîte pleine hauteur) pour rester fluide.
    const colW = 1, boxW = 0.84, levelH = 0.72, boxH = 0.6, D = 2.2, rayonGap = 1.1
    let geomN = R * E * N > 1600 ? 1 : N
    if (R * E > BOX_CAP) geomN = 1
    const boxHfull = geomN === 1 ? Math.max(0.4, N * levelH - 0.12) : boxH
    const isSimplified = geomN !== N
    if (isSimplified !== simplified) setSimplified(isSimplified)

    type BoxG = { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; hue: string }
    const boxes: BoxG[] = []
    let maxX = 0, maxY = 0
    outer: for (let r = 0; r < R; r++) {
      const hue = HUES[r % HUES.length]
      for (let e = 0; e < E; e++) {
        const x0 = r * (E * colW + rayonGap) + e * colW
        for (let n = 0; n < geomN; n++) {
          const y0 = n * levelH
          const b = { x0, y0, z0: 0, x1: x0 + boxW, y1: y0 + boxHfull, z1: D, hue }
          boxes.push(b)
          if (b.x1 > maxX) maxX = b.x1
          if (b.y1 > maxY) maxY = b.y1
          if (boxes.length >= BOX_CAP) break outer
        }
      }
    }
    if (boxes.length === 0) return

    // Caméra : orthographique, lacet + tangage, échelle auto pour remplir.
    const { yaw, pitch, zoom } = view.current
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
    const cxo = maxX / 2, cyo = maxY / 2, czo = D / 2
    const radius = 0.5 * Math.hypot(maxX, maxY, D) || 1
    const scale = (Math.min(w, h) * 0.44 / radius) * zoom
    const ox = w / 2, oy = h / 2 + h * 0.04
    const pr = (x: number, y: number, z: number) => {
      const p = rot(x - cxo, y - cyo, z - czo, cy, sy, cp, sp)
      return { sx: ox + p.x * scale, sy: oy - p.y * scale, z: p.z }
    }

    // Lumière directionnelle.
    const L = (() => { const l = Math.hypot(0.4, 0.85, 0.35); return { x: 0.4 / l, y: 0.85 / l, z: 0.35 / l } })()

    // Faces : 6 par boîte, back-face culling via normale tournée (z>0 = visible).
    const FACES: { c: [number, number, number][]; nx: number; ny: number; nz: number; top?: boolean }[] = [
      { c: [[0, 1, 0], [1, 1, 0], [1, 1, 1], [0, 1, 1]], nx: 0, ny: 1, nz: 0, top: true }, // top
      { c: [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]], nx: 0, ny: 0, nz: -1 }, // front
      { c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], nx: 0, ny: 0, nz: 1 },  // back
      { c: [[1, 0, 0], [1, 0, 1], [1, 1, 1], [1, 1, 0]], nx: 1, ny: 0, nz: 0 },  // right
      { c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], nx: -1, ny: 0, nz: 0 }, // left
    ]

    interface Quad { pts: { sx: number; sy: number }[]; depth: number; fill: string; stroke: string; slots?: number[][]; }
    const quads: Quad[] = []
    const slotCap = Math.min(P, 22)

    for (const b of boxes) {
      const [br, bg, bb] = hexRgb(b.hue)
      const cx = (i: number) => (i === 0 ? b.x0 : b.x1)
      const cyf = (i: number) => (i === 0 ? b.y0 : b.y1)
      const cz = (i: number) => (i === 0 ? b.z0 : b.z1)
      for (const f of FACES) {
        const rn = rot(f.nx, f.ny, f.nz, cy, sy, cp, sp)
        if (rn.z <= 0.02) continue // face cachée
        const proj = f.c.map(([i, j, k]) => pr(cx(i), cyf(j), cz(k)))
        const depth = (proj[0].z + proj[1].z + proj[2].z + proj[3].z) / 4
        const lf = 0.5 + 0.5 * Math.max(0, rn.x * L.x + rn.y * L.y + rn.z * L.z)
        const fill = `rgba(${Math.round(br * lf)},${Math.round(bg * lf)},${Math.round(bb * lf)},0.96)`
        const stroke = `rgba(${Math.round(br * lf * 0.45)},${Math.round(bg * lf * 0.45)},${Math.round(bb * lf * 0.45)},0.9)`
        const q: Quad = { pts: proj.map((p) => ({ sx: p.sx, sy: p.sy })), depth, fill, stroke }
        // Positions : divisions en profondeur sur la face du dessus.
        if (f.top && P > 1) {
          const c3 = [b.x0, b.y1, b.z0], c7 = [b.x0, b.y1, b.z1]
          const c2 = [b.x1, b.y1, b.z0], c6 = [b.x1, b.y1, b.z1]
          const seg: number[][] = []
          for (let s = 1; s < slotCap; s++) {
            const t = s / slotCap
            const a = pr(c3[0] + (c7[0] - c3[0]) * t, b.y1, c3[2] + (c7[2] - c3[2]) * t)
            const d = pr(c2[0] + (c6[0] - c2[0]) * t, b.y1, c2[2] + (c6[2] - c2[2]) * t)
            seg.push([a.sx, a.sy, d.sx, d.sy])
          }
          q.slots = seg
        }
        quads.push(q)
      }
    }

    // Sol + cadre de l'allée (dessiné en premier, il sert de base).
    const pad = 0.7, fy = -0.03
    const floor = [pr(-pad, fy, -pad), pr(maxX + pad, fy, -pad), pr(maxX + pad, fy, D + pad), pr(-pad, fy, D + pad)]
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(floor[0].sx, floor[0].sy)
    for (let i = 1; i < floor.length; i++) ctx.lineTo(floor[i].sx, floor[i].sy)
    ctx.closePath()
    ctx.fillStyle = 'rgba(148,163,184,0.15)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(245,158,11,0.55)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    // Séparateurs de rayons sur le sol.
    ctx.strokeStyle = 'rgba(148,163,184,0.32)'
    ctx.lineWidth = 1
    for (let r = 1; r < R; r++) {
      const xl = r * (E * colW + rayonGap) - rayonGap / 2
      const a = pr(xl, fy, -pad), b = pr(xl, fy, D + pad)
      ctx.beginPath(); ctx.moveTo(a.sx, a.sy); ctx.lineTo(b.sx, b.sy); ctx.stroke()
    }

    // Peintre : du plus loin au plus proche.
    quads.sort((a, b) => a.depth - b.depth)
    for (const q of quads) {
      ctx.beginPath()
      ctx.moveTo(q.pts[0].sx, q.pts[0].sy)
      for (let i = 1; i < q.pts.length; i++) ctx.lineTo(q.pts[i].sx, q.pts[i].sy)
      ctx.closePath()
      ctx.fillStyle = q.fill
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = q.stroke
      ctx.stroke()
      if (q.slots) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'
        ctx.lineWidth = 0.7
        for (const s of q.slots) { ctx.beginPath(); ctx.moveTo(s[0], s[1]); ctx.lineTo(s[2], s[3]); ctx.stroke() }
      }
    }
  }, [simplified])

  // Boucle d'animation (rotation auto).
  useEffect(() => {
    const loop = () => {
      if (spinRef.current && !drag.current) { view.current.yaw += 0.006; draw() }
      raf.current = requestAnimationFrame(loop)
    }
    raf.current = requestAnimationFrame(loop)
    return () => { if (raf.current) cancelAnimationFrame(raf.current) }
  }, [draw])

  // Redessine sur changement de quantités.
  useEffect(() => { draw() }, [rayons, etageres, niveaux, positions, draw])

  // Dimensionnement (DPI + resize).
  useEffect(() => {
    const canvas = canvasRef.current, wrap = wrapRef.current
    if (!canvas || !wrap) return
    const resize = () => {
      const rect = wrap.getBoundingClientRect()
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      dims.current = { w: rect.width, h: rect.height }
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      draw()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    // Respecte prefers-reduced-motion.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { spinRef.current = false; setSpin(false) }
    return () => ro.disconnect()
  }, [draw])

  const onDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, moved: false }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y
    drag.current.x = e.clientX; drag.current.y = e.clientY; drag.current.moved = true
    view.current.yaw += dx * 0.01
    view.current.pitch = Math.max(-1.35, Math.min(-0.05, view.current.pitch + dy * 0.01))
    draw()
  }
  const onUp = () => { drag.current = null }
  const onWheel = (e: React.WheelEvent) => {
    view.current.zoom = Math.max(0.4, Math.min(3, view.current.zoom * (e.deltaY > 0 ? 0.92 : 1.08)))
    draw()
  }
  const toggleSpin = () => { const v = !spin; setSpin(v); spinRef.current = v }
  const reset = () => { view.current = { yaw: -0.62, pitch: -0.5, zoom: 1 }; draw() }

  const empty = !(rayons > 0 && etageres > 0 && niveaux > 0 && positions > 0)

  return (
    <div className="rounded-2xl border border-white/40 bg-white/70 p-4 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-white/5 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold text-gray-800 dark:text-zinc-100">
          <Box className="h-4 w-4 text-amber-500" />{labels.title}
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="mr-1 hidden items-center gap-1 text-[11px] text-gray-400 dark:text-zinc-500 sm:flex"><Move3d className="h-3.5 w-3.5" />{labels.drag}</span>
          <button onClick={toggleSpin} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/10" title={labels.spin}>
            {spin ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
          <button onClick={reset} className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition hover:bg-gray-50 dark:border-white/10 dark:hover:bg-white/10" title={labels.reset}>
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={wrapRef}
        className="relative h-[320px] w-full cursor-grab overflow-hidden rounded-xl bg-gradient-to-b from-gray-50 to-gray-100 active:cursor-grabbing dark:from-[#0d0d14] dark:to-[#15151f] sm:h-[380px]"
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp} onWheel={onWheel}
      >
        <canvas ref={canvasRef} className="touch-none select-none" />
        {!empty && (code || zone || allee) && (
          <div className="pointer-events-none absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {code && <span className="rounded-md bg-amber-500/90 px-2 py-0.5 font-mono text-[11px] font-bold text-white shadow-sm">{code}</span>}
            {zone && <span className="rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">{labels.zone}: {zone}</span>}
            {allee && <span className="rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur-sm">{labels.allee}: {allee}</span>}
          </div>
        )}
        {empty && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-sm text-gray-400 dark:text-zinc-500">
            <Box className="h-8 w-8 text-gray-300 dark:text-zinc-700" />{labels.empty}
          </div>
        )}
      </div>

      {!empty && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
          {[
            { c: '#f59e0b', l: labels.rayon, v: rayons },
            { c: '#6366f1', l: labels.etagere, v: etageres },
            { c: '#10b981', l: labels.niveau, v: niveaux },
            { c: '#ef4444', l: labels.position, v: positions },
          ].map((s) => (
            <span key={s.l} className="flex items-center gap-1.5 text-gray-500 dark:text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.c }} />
              <span className="font-semibold text-gray-700 dark:text-zinc-200">{s.v}</span> {s.l}
            </span>
          ))}
          {simplified && <span className="ml-auto text-amber-500">{labels.simplified}</span>}
        </div>
      )}
    </div>
  )
}
