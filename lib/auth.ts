'use client'

import { sha256 } from 'js-sha256'
import type { AppUser } from './store'

/**
 * Authentification applicative (côté navigateur). Comme le token Turso est déjà
 * exposé au navigateur, ceci est un contrôle d'accès UX + rôles, pas une barrière
 * cryptographique. Le hachage utilise js-sha256 (fonctionne aussi en http, sur
 * téléphone) — crypto.subtle n'est pas dispo hors HTTPS/localhost.
 */

const SESSION_KEY = 'dp_session'
const ITERATIONS = 6000
const DAY = 86400000

export interface Session {
  userId: string
  name: string
  role: AppUser['role']
  storeIds: string[]
  token: string
  expiresAt: number
}

// crypto.getRandomValues est disponible même en http (contrairement à crypto.subtle).
function randHex(bytes = 16): string {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

function derive(secret: string, salt: string): string {
  let h = `${salt}|${secret}`
  for (let i = 0; i < ITERATIONS; i++) h = sha256(h)
  return h
}

/** Retourne "salt:hash" à stocker dans passwordHash / pinHash. */
export function hashSecret(secret: string): string {
  const salt = randHex(16)
  return `${salt}:${derive(secret, salt)}`
}

export function verifySecret(secret: string, stored?: string): boolean {
  if (!stored) return false
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  return derive(secret, salt) === hash
}

export function makeSession(user: AppUser): Session {
  const storeIds = user.storeIds?.length ? user.storeIds : user.storeId ? [user.storeId] : []
  return { userId: user.id, name: user.name, role: user.role, storeIds, token: randHex(24), expiresAt: Date.now() + 30 * DAY }
}

export function getSession(): Session | null {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null') as Session | null
    if (s && s.expiresAt > Date.now()) return s
  } catch {}
  return null
}

export function setSession(s: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(s))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}
