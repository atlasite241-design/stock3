'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Bell, Languages, LogOut, Menu, Moon, Search, Sun, Volume2, VolumeX, Wifi, WifiOff } from 'lucide-react'
import { useDroguerie } from '@/lib/store'
import { MENU_INDEX } from './Sidebar'
import { ROUTE_PERM, usePermissions } from '@/lib/access'
import type { Theme } from '@/lib/theme'
import { playSound, setSoundEnabled, soundEnabled } from '@/lib/sound'
import { useLanguage } from '@/lib/i18n'
import { useAuth } from '@/lib/auth-context'
import StoreSwitcher from './StoreSwitcher'

export default function Topbar({
  onMenuClick,
  theme,
  onToggleTheme,
}: {
  onMenuClick: () => void
  theme: Theme
  onToggleTheme: () => void
}) {
  const router = useRouter()
  const { lang, toggleLang, t } = useLanguage()
  const { can } = usePermissions()
  const { currentUser, session, logout } = useAuth()
  const [logoutOpen, setLogoutOpen] = useState(false)

  // État de la connexion internet. L'app fonctionne en local hors-ligne
  // (localStorage) et se resynchronise automatiquement au retour du réseau.
  const [online, setOnline] = useState(true)
  const [offlineDialog, setOfflineDialog] = useState(false)
  useEffect(() => {
    setOnline(navigator.onLine)
    const goOffline = () => {
      setOnline(false)
      setOfflineDialog(true)
    }
    const goOnline = () => setOnline(true)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])
  const [query, setQuery] = useState('')
  const [actif, setActif] = useState(0)
  const [bellOpen, setBellOpen] = useState(false)
  const [sound, setSound] = useState(true)

  /*
   * Les produits viennent du CONTEXTE (déjà en mémoire, déjà filtrés au
   * magasin actif) — plus de loadProducts() au montage : la Topbar remonte à
   * CHAQUE navigation, et ce raccourci re-parsait ~15 Mo de JSON et
   * reconstruisait 19 000 objets à chaque clic de menu. C'était le « retard
   * de dialogue entre les menus ».
   *
   * « stock <= minStock » sans seuil renseigné compterait tout article à
   * zéro : 0 <= 0 est vrai. Sans seuil, l'article n'est pas piloté — pas
   * d'alerte.
   */
  const { products } = useDroguerie()
  const lowStock = useMemo(
    () => products.filter((p) => p.minStock > 0 && p.stock <= p.minStock),
    [products]
  )

  useEffect(() => {
    setSound(soundEnabled())
  }, [])

  const toggleSound = () => {
    const next = !sound
    setSound(next)
    setSoundEnabled(next)
    if (next) playSound('success')
  }

  /*
   * RECHERCHE DE MENU. Dix-sept menus et près de deux cents écrans : déplier
   * les groupes pour retrouver une page était devenu plus long que de la
   * chercher. La barre cherche donc dans le MENU, et non plus dans les
   * produits — ceux-ci se cherchent dans leur propre écran ou au scan.
   *
   * Seules les entrées auxquelles l'utilisateur a droit remontent : la
   * recherche ne doit pas révéler l'existence d'écrans qui lui sont fermés.
   */
  const sansAccent = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

  const menuResults = useMemo(() => {
    const q = sansAccent(query.trim())
    if (q.length < 2) return []
    return MENU_INDEX
      .filter((e) => can(ROUTE_PERM[e.href.split('?')[0]]))
      .map((e) => ({
        entry: e,
        label: t(e.labelKey),
        chemin: [t(e.familyKey), t(e.groupKey), e.sectionKey ? t(e.sectionKey) : null].filter(Boolean).join(' › '),
      }))
      // Le nom de l'écran d'abord, son chemin ensuite : taper « stock » doit
      // remonter « Stock actuel » avant tout ce que contient le menu Stock.
      .map((r) => {
        const nom = sansAccent(r.label)
        const chemin = sansAccent(r.chemin)
        const score = nom.startsWith(q) ? 0 : nom.includes(q) ? 1 : chemin.includes(q) ? 2 : -1
        return { ...r, score }
      })
      .filter((r) => r.score >= 0)
      .sort((a, b) => a.score - b.score || a.label.localeCompare(b.label))
      .slice(0, 8)
  }, [query, can, t])

  // Remet la sélection en tête dès que la liste change.
  useEffect(() => { setActif(0) }, [query])

  const ouvrir = (href: string) => {
    setQuery('')
    setActif(0)
    router.push(href)
  }

  const onSearchKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActif((i) => Math.min(menuResults.length - 1, i + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActif((i) => Math.max(0, i - 1)) }
    else if (e.key === 'Escape') { setQuery('') }
    else if (e.key === 'Enter') {
      if (menuResults[actif]) ouvrir(menuResults[actif].entry.href)
      // Aucun menu ne correspond : on retombe sur la recherche produit, qui
      // était le comportement d'avant — rien n'est perdu.
      else if (query.trim()) { const q = query.trim(); setQuery(''); router.push(`/produits?q=${encodeURIComponent(q)}`) }
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-gray-200 bg-white/80 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#0a0a0f]/80 sm:px-6 lg:px-8">
      <button
        onClick={onMenuClick}
        className="rounded-xl p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Active store selector */}
      <StoreSwitcher />

      {/* Recherche de menu */}
      <div className="relative hidden max-w-md flex-1 sm:block">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-zinc-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onSearchKey}
          onBlur={() => setTimeout(() => setQuery(''), 150)}
          placeholder={t('topbar_search_placeholder')}
          className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-gray-900 placeholder-gray-400 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-2 focus:ring-amber-400/25 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-zinc-500 dark:focus:bg-white/[0.08]"
        />
        {query.trim().length >= 2 && (
          <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#12121a]">
            {menuResults.length === 0 ? (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { const q = query.trim(); setQuery(''); router.push(`/produits?q=${encodeURIComponent(q)}`) }}
                className="flex w-full items-center gap-2 px-3 py-3 text-left text-sm text-gray-500 transition hover:bg-amber-50 dark:text-zinc-400 dark:hover:bg-white/5"
              >
                <Search className="h-4 w-4 shrink-0" />
                {t('topbar_search_none')} — {t('topbar_search_products')}
              </button>
            ) : (
              menuResults.map((r, i) => (
                <button
                  key={r.entry.href}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => ouvrir(r.entry.href)}
                  onMouseEnter={() => setActif(i)}
                  /*
                   * La ligne sélectionnée passe en jaune plein — elle était
                   * signalée par un gris à peine visible. Sur cette ligne, la
                   * pastille s'inverse (fond sombre, texte ambre) : deux ambres
                   * superposés ne se distingueraient pas.
                   */
                  className={`block w-full px-3 py-2 text-left transition ${
                    i === actif ? 'bg-amber-400' : 'hover:bg-gray-50 dark:hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`inline-block max-w-full truncate rounded px-1.5 py-0.5 text-sm font-bold ${
                      i === actif ? 'bg-gray-900 text-amber-400' : 'bg-amber-400 text-gray-900'
                    }`}
                  >
                    {r.label}
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-[11px] ${
                      i === actif ? 'text-gray-900/70' : 'text-gray-400 dark:text-zinc-500'
                    }`}
                  >
                    {r.chemin}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Indicateur de connexion */}
        <span
          className={`mr-1 hidden items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide sm:flex ${
            online
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'
              : 'border-rose-500/40 bg-rose-500/10 text-rose-500'
          }`}
          title={online ? t('net_online') : t('net_offline')}
        >
          {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {online ? t('net_online') : t('net_offline')}
          <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-emerald-500' : 'animate-pulse bg-rose-500'}`} />
        </span>

        {/* Language toggle */}
        <button
          onClick={toggleLang}
          className="flex items-center gap-1.5 rounded-xl px-2.5 py-2.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
          title={t('topbar_language')}
        >
          <Languages className="h-[18px] w-[18px]" />
          <span className="text-xs font-bold uppercase">{lang === 'ar' ? 'FR' : 'AR'}</span>
        </button>

        {/* Sound toggle */}
        <button
          onClick={toggleSound}
          className="rounded-xl p-2.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
          title={sound ? t('topbar_sound_off') : t('topbar_sound_on')}
        >
          {sound ? <Volume2 className="h-[18px] w-[18px]" /> : <VolumeX className="h-[18px] w-[18px]" />}
        </button>

        {/* Theme toggle */}
        <button
          onClick={onToggleTheme}
          className="rounded-xl p-2.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
          title={theme === 'dark' ? t('topbar_light_mode') : t('topbar_dark_mode')}
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setBellOpen((o) => !o)}
            className="relative rounded-xl p-2.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-zinc-400 dark:hover:bg-white/5 dark:hover:text-white"
          >
            <Bell className="h-[18px] w-[18px]" />
            {lowStock.length > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold text-white">
                {/* Au-dela de 99 la pastille deborde et le chiffre exact
                    n'apporte plus rien : le detail est dans le panneau. */}
                {lowStock.length > 99 ? '99+' : lowStock.length}
              </span>
            )}
          </button>

          {bellOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setBellOpen(false)} />
              <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl dark:border-white/10 dark:bg-[#12121a]">
                <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
                  {t('topbar_stock_alerts')} ({lowStock.length})
                </p>
                {lowStock.length === 0 ? (
                  <p className="px-3 pb-3 text-sm text-gray-500 dark:text-zinc-400">{t('topbar_no_alerts')}</p>
                ) : (
                  <div className="max-h-72 overflow-y-auto">
                    {lowStock.slice(0, 6).map((p) => (
                      <Link
                        key={p.id}
                        href="/stock"
                        onClick={() => setBellOpen(false)}
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-amber-50 dark:hover:bg-amber-500/10"
                      >
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${p.stock === 0 ? 'bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'bg-amber-50 text-amber-500 dark:bg-amber-500/10'}`}>
                          <AlertTriangle className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-900 dark:text-white">{p.name}</span>
                          <span className="block text-xs text-gray-500 dark:text-zinc-400">
                            {p.stock === 0 ? t('topbar_out_of_stock') : `${p.stock} restants (min. ${p.minStock})`}
                          </span>
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
                <Link
                  href="/stock"
                  onClick={() => setBellOpen(false)}
                  className="mt-1 block rounded-xl bg-gray-50 px-3 py-2.5 text-center text-xs font-bold text-gray-700 transition hover:bg-amber-50 hover:text-amber-700 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-amber-500/10 dark:hover:text-amber-400"
                >
                  {t('topbar_manage_stock')}
                </Link>
              </div>
            </>
          )}
        </div>

        <div className="mx-2 h-6 w-px bg-gray-200 dark:bg-white/10" />

        <Link
          href="/parametres/societe"
          className="flex items-center gap-3 rounded-xl p-1.5 transition hover:bg-gray-100 dark:hover:bg-white/5 sm:pr-3"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-yellow-500 text-xs font-bold text-gray-900">
            {(currentUser?.name ?? session?.name ?? 'DP').slice(0, 2).toUpperCase()}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-[13px] font-semibold leading-tight text-gray-900 dark:text-white">{currentUser?.name ?? session?.name ?? '—'}</p>
            <p className="text-[11px] leading-tight text-gray-500 dark:text-zinc-400">{currentUser?.role ?? session?.role ?? t('topbar_role')}</p>
          </div>
        </Link>

        <button
          onClick={() => setLogoutOpen(true)}
          title={t('auth_logout')}
          className="rounded-xl p-2.5 text-gray-500 transition hover:bg-rose-50 hover:text-rose-600 dark:text-zinc-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>

      {/* Confirmation de déconnexion — rendue dans <body> via portail : le
          backdrop-filter du header piégerait sinon le position:fixed. */}
      {logoutOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm" onClick={() => setLogoutOpen(false)}>
          <div
            className="w-full max-w-xs rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-2xl dark:border-white/10 dark:bg-[#12121a]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-500">
              <LogOut className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-base font-black uppercase tracking-widest text-gray-900 dark:text-white">{t('logout_confirm_title')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-zinc-400">{t('logout_confirm_msg')}</p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button
                onClick={() => setLogoutOpen(false)}
                className="rounded-xl border border-gray-200 bg-gray-50 py-2.5 text-xs font-black uppercase tracking-widest text-gray-600 transition hover:bg-gray-100 active:scale-[0.98] dark:border-white/15 dark:bg-white/5 dark:text-zinc-300 dark:hover:bg-white/10"
              >
                {t('rst_cancel')}
              </button>
              <button
                onClick={() => { setLogoutOpen(false); logout() }}
                className="rounded-xl border border-rose-500/50 bg-rose-500/10 py-2.5 text-xs font-black uppercase tracking-widest text-rose-500 transition hover:bg-rose-500/20 active:scale-[0.98]"
              >
                {t('logout_confirm_btn')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Passage en mode déconnecté — information (portail : centré écran) */}
      {offlineDialog && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-5 backdrop-blur-sm" onClick={() => setOfflineDialog(false)}>
          <div
            className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-7 text-center shadow-2xl dark:border-white/10 dark:bg-[#12121a]"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-rose-500/40 bg-rose-500/10 text-rose-500">
              <WifiOff className="h-5 w-5" />
            </span>
            <h2 className="mt-4 text-base font-black uppercase tracking-widest text-gray-900 dark:text-white">{t('net_offline')}</h2>
            <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-zinc-300">{t('net_offline_msg')}</p>
            <button
              onClick={() => setOfflineDialog(false)}
              className="mt-6 w-full rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 py-2.5 text-xs font-black uppercase tracking-widest text-gray-900 transition hover:brightness-110 active:scale-[0.98]"
            >
              {t('auth_reset_ok')}
            </button>
          </div>
        </div>,
        document.body
      )}
    </header>
  )
}
