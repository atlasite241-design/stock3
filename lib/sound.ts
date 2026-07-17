'use client'

export type SoundType = 'success' | 'error' | 'delete' | 'cash' | 'click' | 'notify'

const KEY = 'dp_sound'

let ctx: AudioContext | null = null

function audioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      ctx = new AC()
    }
    if (ctx.state === 'suspended') ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== 'off'
  } catch {
    return true
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off')
  } catch {
    /* ignore */
  }
}

interface Note {
  freq: number
  start: number // seconds offset
  dur: number
  type?: OscillatorType
  gain?: number
}

function play(notes: Note[]) {
  const ac = audioCtx()
  if (!ac) return
  const now = ac.currentTime
  notes.forEach((n) => {
    const osc = ac.createOscillator()
    const g = ac.createGain()
    osc.type = n.type ?? 'sine'
    osc.frequency.setValueAtTime(n.freq, now + n.start)
    const peak = n.gain ?? 0.07
    // quick attack + smooth exponential decay envelope
    g.gain.setValueAtTime(0.0001, now + n.start)
    g.gain.exponentialRampToValueAtTime(peak, now + n.start + 0.012)
    g.gain.exponentialRampToValueAtTime(0.0001, now + n.start + n.dur)
    osc.connect(g)
    g.connect(ac.destination)
    osc.start(now + n.start)
    osc.stop(now + n.start + n.dur + 0.02)
  })
}

const RECIPES: Record<SoundType, Note[]> = {
  // Bright two-note rising chime — confirmations, ajouts, enregistrements
  success: [
    { freq: 660, start: 0, dur: 0.12, type: 'sine' },
    { freq: 990, start: 0.1, dur: 0.16, type: 'sine' },
  ],
  // Low descending buzz — erreurs / actions bloquées
  error: [
    { freq: 320, start: 0, dur: 0.16, type: 'square', gain: 0.05 },
    { freq: 200, start: 0.12, dur: 0.22, type: 'square', gain: 0.05 },
  ],
  // Short muted "thunk" — suppressions
  delete: [
    { freq: 300, start: 0, dur: 0.1, type: 'triangle', gain: 0.06 },
    { freq: 150, start: 0.07, dur: 0.16, type: 'triangle', gain: 0.06 },
  ],
  // "Cha-ching" — encaissements / paiements
  cash: [
    { freq: 988, start: 0, dur: 0.09, type: 'sine' },
    { freq: 1319, start: 0.08, dur: 0.09, type: 'sine' },
    { freq: 1568, start: 0.16, dur: 0.22, type: 'sine' },
  ],
  // Tiny blip — clic léger
  click: [{ freq: 1200, start: 0, dur: 0.05, type: 'sine', gain: 0.045 }],
  // Pleasant ding — notifications
  notify: [
    { freq: 880, start: 0, dur: 0.12, type: 'sine' },
    { freq: 1174, start: 0.09, dur: 0.2, type: 'sine' },
  ],
}

export function playSound(type: SoundType) {
  if (!soundEnabled()) return
  play(RECIPES[type])
}
