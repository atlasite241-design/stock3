'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'

export default function CameraScanner({
  open,
  onClose,
  onDetect,
}: {
  open: boolean
  onClose: () => void
  onDetect: (code: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setTimeout> | null = null
    let stopped = false

    const start = async () => {
      const BD = (window as any).BarcodeDetector
      if (!BD) {
        setError("Le scanner caméra n'est pas supporté par ce navigateur. Utilisez Chrome ou Edge, ou votre douchette USB.")
        return
      }
      try {
        const detector = new BD({ formats: ['ean_13', 'ean_8', 'upc_a', 'code_128', 'code_39', 'qr_code'] })
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
        const scan = async () => {
          if (stopped || !videoRef.current) return
          try {
            const codes = await detector.detect(videoRef.current)
            if (codes.length > 0 && codes[0].rawValue) {
              onDetect(String(codes[0].rawValue))
              onClose()
              return
            }
          } catch {
            /* frame not ready yet */
          }
          timer = setTimeout(scan, 180)
        }
        scan()
      } catch {
        setError("Impossible d'accéder à la caméra. Vérifiez les permissions du navigateur.")
      }
    }
    start()

    return () => {
      stopped = true
      if (timer) clearTimeout(timer)
      stream?.getTracks().forEach((t) => t.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-gray-900/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
          <p className="flex items-center gap-2 text-sm font-bold text-gray-900">
            <Camera className="h-4 w-4 text-amber-500" />
            Scanner avec la caméra
          </p>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="relative aspect-video bg-gray-950">
          {error ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-gray-300">
              {error}
            </div>
          ) : (
            <>
              <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="h-24 w-64 rounded-xl border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </div>
            </>
          )}
        </div>
        <p className="px-5 py-3 text-center text-xs text-gray-500">
          Placez le code-barres dans le cadre — la détection est automatique.
        </p>
      </div>
    </div>
  )
}
