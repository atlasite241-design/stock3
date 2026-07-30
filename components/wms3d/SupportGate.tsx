'use client'

// Garde d'entrée de l'explorateur 3D :
// 1. Détecte WebGL et le rendu LOGICIEL (SwiftShader/llvmpipe) — cause n°1 de
//    crash du renderer sur les machines sans accélération matérielle.
// 2. ErrorBoundary : une erreur three.js affiche un écran clair au lieu d'une
//    page morte.

import { Component, type ReactNode } from 'react'
import { AlertTriangle, MonitorX, RefreshCw } from 'lucide-react'

export interface GlSupport {
  ok: boolean
  /** Rendu logiciel (pas de GPU) : three.js risque de tuer l'onglet. */
  soft: boolean
  /** GPU ancien/fragile (vieux Intel HD…) : antialias et ombres désactivés. */
  lite: boolean
  renderer: string
}

/** Sonde WebGL sur un canvas jetable (aucun contexte conservé). */
export function checkWebGL(): GlSupport {
  try {
    const c = document.createElement('canvas')
    const gl = (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return { ok: false, soft: false, lite: false, renderer: 'none' }
    let renderer = ''
    const dbg = gl.getExtension('WEBGL_debug_renderer_info')
    if (dbg) renderer = String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) ?? '')
    if (!renderer) renderer = String(gl.getParameter(gl.RENDERER) ?? '')
    const soft = /swiftshader|llvmpipe|software|basic render|microsoft basic/i.test(renderer)
    // Vieilles générations Intel HD/UHD (Haswell/Broadwell/Skylake…) : les
    // drivers 2015-2020 crashent ANGLE avec MSAA/ombres → mode allégé.
    const lite = /intel[^]*?(hd|uhd)? graphics ?(4\d{2}|5\d{3}|5\d{2}|6\d{2}|515|520|530|610|620|630)\b/i.test(renderer)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return { ok: true, soft, lite, renderer }
  } catch {
    return { ok: false, soft: false, lite: false, renderer: 'error' }
  }
}

/** Écran d'information (WebGL absent / rendu logiciel). */
export function SupportScreen({ title, desc, detail, actionLabel, onAction }: {
  title: string
  desc: string
  detail?: string
  actionLabel?: string
  onAction?: () => void
}) {
  return (
    <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4 p-8 text-center">
      <MonitorX className="h-14 w-14 text-zinc-600" />
      <h2 className="text-lg font-bold text-white">{title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-zinc-400">{desc}</p>
      {detail && <p className="rounded-lg bg-white/5 px-3 py-1.5 font-mono text-[11px] text-zinc-500">{detail}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn-primary mt-2">{actionLabel}</button>
      )}
    </div>
  )
}

/** Garde-fou : toute erreur de rendu 3D devient un écran avec message. */
export class GlErrorBoundary extends Component<
  { children: ReactNode; title: string; reloadLabel: string },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-[420px] flex-col items-center justify-center gap-4 p-8 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500" />
          <h2 className="text-lg font-bold text-white">{this.props.title}</h2>
          <p className="max-w-md break-all rounded-lg bg-white/5 px-3 py-1.5 font-mono text-[11px] text-rose-300">
            {String(this.state.error?.message ?? this.state.error)}
          </p>
          <button onClick={() => window.location.reload()} className="btn-primary">
            <RefreshCw className="h-4 w-4" />{this.props.reloadLabel}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
