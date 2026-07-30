'use client'

// Étape 1 — Importation des photos / du plan.
// Zone de dépôt (glisser-déposer ou sélection), vignettes, suppression unitaire.

import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { FileText, ImagePlus, Trash2, Upload } from 'lucide-react'
import { useLanguage } from '@/lib/i18n'
import { ACCEPTED, loadSourceImages } from '@/lib/storevision/files'
import type { SourceImage } from '@/lib/storevision/types'

export default function StepImport({ images, onChange }: {
  images: SourceImage[]
  onChange: (next: SourceImage[]) => void
}) {
  const { t } = useLanguage()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])

  const ingest = async (files: FileList | File[]) => {
    setBusy(true)
    try {
      const res = await loadSourceImages(files)
      setRejected(res.rejected)
      onChange([...images, ...res.images])
    } finally {
      setBusy(false)
    }
  }

  const kb = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} Mo` : `${Math.round(n / 1024)} Ko`)

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files?.length) void ingest(e.dataTransfer.files) }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition ${
          over ? 'border-amber-400 bg-amber-50/60 dark:bg-amber-500/10' : 'border-gray-200 hover:border-amber-300 dark:border-white/15 dark:hover:border-amber-500/40'
        }`}
      >
        <Upload className={`h-10 w-10 ${over ? 'text-amber-500' : 'text-gray-300 dark:text-zinc-600'}`} />
        <div>
          <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">{t('sv_drop_title')}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">{t('sv_drop_hint')}</p>
        </div>
        <span className="btn-secondary pointer-events-none"><ImagePlus className="h-4 w-4" />{t('sv_choose_files')}</span>
        <input ref={inputRef} type="file" multiple accept={ACCEPTED} className="hidden"
          onChange={(e) => { if (e.target.files?.length) void ingest(e.target.files); e.target.value = '' }} />
      </div>

      {busy && <p className="text-center text-xs font-semibold text-amber-600 dark:text-amber-400">{t('sv_reading')}</p>}

      {rejected.length > 0 && (
        <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-500/10 dark:text-rose-300">
          {t('sv_rejected')} : {rejected.join(', ')}
        </p>
      )}

      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, i) => (
            <motion.div key={img.id} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              className="group relative overflow-hidden rounded-xl border border-gray-100 bg-gray-50 dark:border-white/10 dark:bg-white/5">
              <div className="flex h-28 items-center justify-center overflow-hidden">
                {img.dataUrl
                  ? <img src={img.dataUrl} alt={img.name} className="h-full w-full object-cover" />
                  : <FileText className="h-10 w-10 text-gray-300 dark:text-zinc-600" />}
              </div>
              <div className="p-2">
                <p className="truncate text-[11px] font-semibold text-gray-700 dark:text-zinc-200">{img.name}</p>
                <p className="text-[10px] text-gray-400 dark:text-zinc-500">
                  {img.kind === 'plan' ? t('sv_kind_plan') : t('sv_kind_photo')} · {img.width}×{img.height} · {kb(img.bytes)}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onChange(images.filter((x) => x.id !== img.id)) }}
                title={t('mag_delete')}
                className="absolute right-1.5 top-1.5 rounded-lg bg-black/60 p-1.5 text-white opacity-0 transition hover:bg-rose-500 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <span className="absolute left-1.5 top-1.5 rounded-md bg-black/60 px-1.5 text-[10px] font-bold text-white">{i + 1}</span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
