'use client'

import React, { createContext, useCallback, useContext, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, XCircle } from 'lucide-react'
import { playSound, type SoundType } from '@/lib/sound'

type ToastType = 'success' | 'error'

const ToastContext = createContext<(message: string, type?: ToastType) => void>(() => {})

export const useToast = () => useContext(ToastContext)

// Pick a distinct sound from the toast content so every operation is audible
// without touching hundreds of call sites.
const DELETE_RE = /supprim|deleted|حذف|réinitialis/i
const CASH_RE = /paiement|règlement|reglement|encaiss|versé|verse|payé|paid|دفع|تحصيل|سُدّد|سدد/i

function soundFor(message: string, type: ToastType): SoundType {
  if (type === 'error') return 'error'
  if (DELETE_RE.test(message)) return 'delete'
  if (CASH_RE.test(message)) return 'cash'
  return 'success'
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: ToastType }[]>([])
  const counter = useRef(0)

  const push = useCallback((message: string, type: ToastType = 'success') => {
    const id = ++counter.current
    playSound(soundFor(message, type))
    setToasts((t) => [...t, { id, message, type }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2800)
  }, [])

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed right-4 top-20 z-[100] flex w-[320px] max-w-[calc(100vw-2rem)] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 48 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 48 }}
              className={`flex items-center gap-2.5 rounded-xl border bg-white dark:bg-[#12121a] px-4 py-3 shadow-xl ${
                t.type === 'success' ? 'border-emerald-200 dark:border-emerald-500/20' : 'border-rose-200 dark:border-rose-500/20'
              }`}
            >
              {t.type === 'success' ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500 dark:text-emerald-400" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-rose-500 dark:text-rose-400" />
              )}
              <p className="text-sm font-medium text-gray-800 dark:text-zinc-100">{t.message}</p>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}
