// Layout 3D déterministe de l'entrepôt : chaque nœud de l'arbre reçoit des
// coordonnées MONDE absolues (zones en grille, allées parallèles, rayons en
// enfilade, étagères = travées, niveaux = planches, positions = cellules).
// Tout est pur et mémoïsable ; les vues ne font que dessiner ces boîtes,
// et la caméra « plonge » d'un niveau à l'autre sans changer de repère.

import type { Sel, WmsTree } from './types'
import { levelOf } from './types'

export interface Rect { x: number; z: number; w: number; d: number }
export interface Box3D extends Rect { h: number }
export interface PlankLay { x: number; y: number; z: number; w: number; d: number; cols: number; rows: number; cell: number }
export interface CellLay { x: number; y: number; z: number; s: number }

export interface Layout {
  zones: Map<string, Rect>
  allees: Map<string, Box3D>
  rayons: Map<string, Box3D>
  etageres: Map<string, Box3D>
  niveaux: Map<string, PlankLay>
  cells: Map<string, CellLay>
  world: Rect
}

// Constantes physiques (unités de scène ≈ mètres).
export const NH = 0.52        // pas vertical d'un niveau
export const PLANK_T = 0.05   // épaisseur de planche
export const BAY_D = 0.66     // profondeur d'une travée (étagère)
export const BASE_Y = 0.14    // hauteur de la première planche
const CELL = 0.2              // taille max d'une cellule (position)
const CELL_PITCH = 0.235
const BAY_GAP = 0.12, POST = 0.05, RAY_GAP = 0.6, AISLE = 2.1
const ZONE_PAD = 1.0, ZONE_GAP = 3.2

/** Répartition des P positions d'un niveau en grille (comme sur une planche). */
export function gridOf(p: number): { cols: number; rows: number } {
  const rows = p <= 8 ? 1 : p <= 24 ? 2 : 3
  return { cols: Math.max(1, Math.ceil(p / rows)), rows }
}

export function computeLayout(tree: WmsTree): Layout {
  const L: Layout = { zones: new Map(), allees: new Map(), rayons: new Map(), etageres: new Map(), niveaux: new Map(), cells: new Map(), world: { x: 0, z: 0, w: 0, d: 0 } }

  // --- Passe 1 : dimensions intrinsèques (largeur travée, rayon, allée ; zone) ---
  const bayW = new Map<string, number>()
  const rayW = new Map<string, number>(), rayH = new Map<string, number>()
  const alW = new Map<string, number>(), alH = new Map<string, number>()
  const znW = new Map<string, number>(), znD = new Map<string, number>()

  for (const z of tree.zones) {
    let zw = 0
    for (const a of z.allees) {
      let aw = 0, ah = 0
      for (const r of a.rayons) {
        let rw = POST
        let rh = 0
        for (const e of r.etageres) {
          let cols = 1
          for (const n of e.niveaux) cols = Math.max(cols, gridOf(n.positions.length).cols)
          const w = Math.min(9, Math.max(1.25, cols * CELL_PITCH + 0.2))
          bayW.set(e.id, w)
          rw += w + BAY_GAP
          rh = Math.max(rh, e.niveaux.length * NH + 0.2)
        }
        rw = r.etageres.length ? rw - BAY_GAP + POST : 1.4
        rayW.set(r.id, rw); rayH.set(r.id, Math.max(rh, NH + 0.2))
        aw += rw + RAY_GAP
        ah = Math.max(ah, rayH.get(r.id) ?? 1)
      }
      aw = a.rayons.length ? aw - RAY_GAP : 2.4
      alW.set(a.id, aw); alH.set(a.id, Math.max(ah, 1))
      zw = Math.max(zw, aw)
    }
    znW.set(z.id, zw + ZONE_PAD * 2)
    znD.set(z.id, z.allees.length * BAY_D + Math.max(0, z.allees.length - 1) * AISLE + ZONE_PAD * 2)
  }

  // --- Passe 2 : placement des zones en lignes ---
  // Les zones ont des tailles très inégales (une zone de 15 allées est bien plus
  // profonde qu'une zone de 2). Un simple « n par ligne » produisait une longue
  // traînée illisible en perspective : on remplit donc chaque ligne jusqu'à une
  // largeur cible dérivée de la surface totale, pour une empreinte ~carrée.
  const rowTarget = (() => {
    let area = 0, sumW = 0
    for (const z of tree.zones) {
      const w = znW.get(z.id) ?? 4, d = znD.get(z.id) ?? 4
      area += (w + ZONE_GAP) * (d + ZONE_GAP)
      sumW = Math.max(sumW, w)
    }
    return Math.max(sumW, Math.sqrt(area) * 1.15)
  })()
  let zx = 0, zz = 0, rowD = 0, minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
  tree.zones.forEach((z, i) => {
    const w = znW.get(z.id) ?? 4, d = znD.get(z.id) ?? 4
    if (i > 0 && zx + w > rowTarget) { zx = 0; zz += rowD + ZONE_GAP; rowD = 0 }
    L.zones.set(z.id, { x: zx, z: zz, w, d })
    rowD = Math.max(rowD, d)
    minX = Math.min(minX, zx); minZ = Math.min(minZ, zz)
    maxX = Math.max(maxX, zx + w); maxZ = Math.max(maxZ, zz + d)
    zx += w + ZONE_GAP

    // --- Passe 3 : contenu de la zone (allées → cellules), coordonnées monde ---
    const zr = L.zones.get(z.id)!
    z.allees.forEach((a, ai) => {
      const ax = zr.x + ZONE_PAD
      const az = zr.z + ZONE_PAD + ai * (BAY_D + AISLE)
      L.allees.set(a.id, { x: ax, z: az, w: alW.get(a.id) ?? 2.4, d: BAY_D, h: alH.get(a.id) ?? 1 })
      let rx = ax
      for (const r of a.rayons) {
        const rw = rayW.get(r.id) ?? 1.4, rh = rayH.get(r.id) ?? 1
        L.rayons.set(r.id, { x: rx, z: az, w: rw, d: BAY_D, h: rh })
        let ex = rx + POST
        for (const e of r.etageres) {
          const ew = bayW.get(e.id) ?? 1.25
          const eh = e.niveaux.length * NH + 0.2
          L.etageres.set(e.id, { x: ex, z: az, w: ew, d: BAY_D, h: eh })
          e.niveaux.forEach((n, ni) => {
            const py = BASE_Y + ni * NH
            const { cols, rows } = gridOf(n.positions.length)
            const cell = Math.min(CELL, (ew - 0.2) / cols - 0.03)
            L.niveaux.set(n.id, { x: ex + 0.1, y: py, z: az + 0.04, w: ew - 0.2, d: BAY_D - 0.08, cols, rows, cell })
            const rowPitch = (BAY_D - 0.14) / rows
            const colPitch = (ew - 0.2) / cols
            n.positions.forEach((p, pi) => {
              const ci = pi % cols, ri = Math.floor(pi / cols)
              L.cells.set(p.id, {
                x: ex + 0.1 + ci * colPitch + colPitch / 2,
                y: py + cell / 2 + 0.004,
                z: az + 0.07 + ri * rowPitch + rowPitch / 2,
                s: Math.max(0.06, cell),
              })
            })
          })
          ex += ew + BAY_GAP
        }
        rx += rw + RAY_GAP
      }
    })
  })
  // Aucune zone : les bornes restent infinies — trois.js ne doit jamais recevoir
  // de géométrie non finie (fog/ombres/caméra deviennent NaN).
  L.world = tree.zones.length === 0
    ? { x: 0, z: 0, w: 10, d: 10 }
    : { x: minX, z: minZ, w: maxX - minX, d: maxZ - minZ }
  return L
}

export interface Focus { cx: number; cy: number; cz: number; size: number }

/** Boîte de focus caméra selon la sélection. */
export function focusFor(sel: Sel, L: Layout): Focus {
  const lvl = levelOf(sel)
  if (lvl === 'zones' || !sel.zone) {
    const w = L.world
    return { cx: w.x + w.w / 2, cy: 0.6, cz: w.z + w.d / 2, size: Math.max(w.w, w.d, 6) }
  }
  if (lvl === 'allees') {
    const r = L.zones.get(sel.zone)!
    return { cx: r.x + r.w / 2, cy: 0.8, cz: r.z + r.d / 2, size: Math.max(r.w, r.d, 5) }
  }
  if (lvl === 'rayons') {
    const b = L.allees.get(sel.allee!)!
    return { cx: b.x + b.w / 2, cy: b.h / 2, cz: b.z + b.d / 2, size: Math.max(b.w, b.h * 2.2, 4) }
  }
  if (lvl === 'etageres') {
    const b = L.rayons.get(sel.rayon!)!
    return { cx: b.x + b.w / 2, cy: b.h / 2, cz: b.z + b.d / 2, size: Math.max(b.w, b.h * 2, 3) }
  }
  // niveaux (étagère ciblée, éventuellement planche précise)
  if (sel.niveau && L.niveaux.has(sel.niveau)) {
    const p = L.niveaux.get(sel.niveau)!
    return { cx: p.x + p.w / 2, cy: p.y + 0.12, cz: p.z + p.d / 2, size: Math.max(p.w, 1.6) }
  }
  const b = L.etageres.get(sel.etagere!)!
  return { cx: b.x + b.w / 2, cy: b.h / 2, cz: b.z + b.d / 2, size: Math.max(b.w * 1.4, b.h * 1.5, 2.4) }
}

/** Position caméra idéale pour un focus donné (angle qui s'abaisse en profondeur). */
export function cameraFor(sel: Sel, f: Focus): { pos: [number, number, number]; tgt: [number, number, number] } {
  const lvl = levelOf(sel)
  // Vue d'ensemble presque à la verticale (lecture de plan) puis inclinaison
  // progressive en descendant : à 21 zones, un angle rasant écrasait tout.
  const pitch = lvl === 'zones' ? 1.15 : lvl === 'allees' ? 0.82 : lvl === 'rayons' ? 0.5 : lvl === 'etageres' ? 0.34 : 0.22
  const yaw = -0.62
  const dist = f.size * (lvl === 'zones' ? 0.95 : lvl === 'allees' ? 0.92 : lvl === 'rayons' ? 0.85 : lvl === 'etageres' ? 0.9 : 1.0) + 1.6
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
  return {
    pos: [f.cx + dist * cp * sy, f.cy + dist * sp, f.cz + dist * cp * cy],
    tgt: [f.cx, f.cy, f.cz],
  }
}
