'use client'

import { useCallback, useEffect, useState } from 'react'

const KEY = 'dp_primary'
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const

// Each palette is 10 "r g b" channel strings, ordered 50 → 900.
type Ramp = string[]

const AMBER: Ramp = ['255 251 235', '254 243 199', '253 230 138', '252 211 77', '251 191 36', '245 158 11', '217 119 6', '180 83 9', '146 64 14', '120 53 15']
const YELLOW: Ramp = ['254 252 232', '254 249 195', '254 240 138', '253 224 71', '250 204 21', '234 179 8', '202 138 4', '161 98 7', '133 77 14', '113 63 18']
const VIOLET: Ramp = ['245 243 255', '237 233 254', '221 214 254', '196 181 253', '167 139 250', '139 92 246', '124 58 237', '109 40 217', '91 33 182', '76 29 149']
const TEAL: Ramp = ['240 253 250', '204 251 241', '153 246 228', '94 234 212', '45 212 191', '20 184 166', '13 148 136', '15 118 110', '17 94 89', '19 78 74']
const ROSE: Ramp = ['255 241 242', '255 228 230', '254 205 211', '253 164 175', '251 113 133', '244 63 94', '225 29 72', '190 18 60', '159 18 57', '136 19 55']
const BLUE: Ramp = ['239 246 255', '219 234 254', '191 219 254', '147 197 253', '96 165 250', '59 130 246', '37 99 235', '29 78 216', '30 64 175', '30 58 138']

export interface Preset {
  id: string
  /** Swatch hex shown in the picker (the 500 shade). */
  swatch: string
  amber: Ramp
  yellow: Ramp
}

export const PRESETS: Preset[] = [
  { id: 'amber', swatch: '#f59e0b', amber: AMBER, yellow: YELLOW },
  { id: 'violet', swatch: '#8b5cf6', amber: VIOLET, yellow: VIOLET },
  { id: 'teal', swatch: '#14b8a6', amber: TEAL, yellow: TEAL },
  { id: 'rose', swatch: '#f43f5e', amber: ROSE, yellow: ROSE },
  { id: 'blue', swatch: '#3b82f6', amber: BLUE, yellow: BLUE },
]

export interface PrimarySelection {
  id: string // preset id or 'custom'
  hex?: string // for custom
}

// --- custom-color ramp -------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

const mix = (c: number, target: number, amt: number) => Math.round(c + (target - c) * amt)

// mix-toward-white for light shades, mix-toward-black for dark shades, keyed by shade
const RAMP_MIX: Record<number, { target: number; amt: number }> = {
  50: { target: 255, amt: 0.92 },
  100: { target: 255, amt: 0.84 },
  200: { target: 255, amt: 0.68 },
  300: { target: 255, amt: 0.48 },
  400: { target: 255, amt: 0.24 },
  500: { target: 0, amt: 0 },
  600: { target: 0, amt: 0.12 },
  700: { target: 0, amt: 0.28 },
  800: { target: 0, amt: 0.44 },
  900: { target: 0, amt: 0.58 },
}

export function rampFromHex(hex: string): Ramp {
  const [r, g, b] = hexToRgb(hex)
  return SHADES.map((s) => {
    const { target, amt } = RAMP_MIX[s]
    return `${mix(r, target, amt)} ${mix(g, target, amt)} ${mix(b, target, amt)}`
  })
}

// --- apply / persist ---------------------------------------------------------

function applyRamps(amber: Ramp, yellow: Ramp) {
  const root = document.documentElement
  SHADES.forEach((s, i) => {
    root.style.setProperty(`--c-amber-${s}`, amber[i])
    root.style.setProperty(`--c-yellow-${s}`, yellow[i])
  })
}

export function applyPrimary(sel: PrimarySelection) {
  if (sel.id === 'custom' && sel.hex) {
    const ramp = rampFromHex(sel.hex)
    applyRamps(ramp, ramp)
    return
  }
  const preset = PRESETS.find((p) => p.id === sel.id) ?? PRESETS[0]
  applyRamps(preset.amber, preset.yellow)
}

export function loadPrimary(): PrimarySelection {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as PrimarySelection
  } catch {
    /* ignore */
  }
  return { id: 'amber' }
}

export function usePrimary() {
  const [primary, setPrimaryState] = useState<PrimarySelection>({ id: 'amber' })

  useEffect(() => {
    const initial = loadPrimary()
    setPrimaryState(initial)
    applyPrimary(initial)
  }, [])

  const setPrimary = useCallback((sel: PrimarySelection) => {
    setPrimaryState(sel)
    localStorage.setItem(KEY, JSON.stringify(sel))
    applyPrimary(sel)
  }, [])

  return { primary, setPrimary }
}
