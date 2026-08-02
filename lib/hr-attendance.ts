'use client'

/**
 * Règles de pointage.
 *
 * Un enregistrement par personne et par jour, d'identifiant `employeeId_date` :
 * pointer deux fois complète la même ligne au lieu d'en créer une seconde. Sans
 * cette clé déterministe, deux appareils qui pointent le même employé le même
 * jour créeraient deux enregistrements que rien ne pourrait fusionner.
 */

import { minutesBetween, type Attendance, type Shift } from './hr'

export const attendanceId = (employeeId: string, date: string) => `${employeeId}_${date}`

export interface ClockResult {
  record: Attendance
  /** Ce que le pointage vient de faire — sert au message de confirmation. */
  action: 'in' | 'out' | 'already'
}

/**
 * Applique un pointage à l'instant `time` (HH:MM).
 * Premier pointage du jour = arrivée ; les suivants déplacent le départ, ce qui
 * permet de corriger une sortie sans repartir de zéro.
 */
export function clock(
  existing: Attendance | undefined,
  employeeId: string,
  date: string,
  time: string,
  shift?: Shift
): ClockResult {
  const base: Attendance = existing ?? {
    id: attendanceId(employeeId, date),
    employeeId,
    date,
    status: 'present',
    lateMin: 0,
    earlyMin: 0,
    minutes: 0,
    shiftId: shift?.id,
  }

  if (!base.in) {
    const grace = shift?.graceMin ?? 0
    const late = shift ? Math.max(0, minutesBetween(shift.start, time) - grace) : 0
    return {
      record: { ...base, in: time, status: 'present', lateMin: late, shiftId: shift?.id ?? base.shiftId },
      action: 'in',
    }
  }

  const worked = Math.max(0, minutesBetween(base.in, time) - (shift?.breakMin ?? 0))
  const early = shift ? Math.max(0, minutesBetween(time, shift.end)) : 0
  return {
    record: { ...base, out: time, minutes: worked, earlyMin: early, status: 'present' },
    action: base.out ? 'already' : 'out',
  }
}

/** Horaire applicable à une date : celui de l'équipe, s'il couvre ce jour de la semaine. */
export function shiftForDate(shifts: Shift[], shiftId: string | undefined, date: string): Shift | undefined {
  const s = shifts.find((x) => x.id === shiftId)
  if (!s) return undefined
  const day = new Date(date).getDay()
  return s.days.includes(day) ? s : undefined
}

export const nowHHMM = () => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
