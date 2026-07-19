import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Envoie les identifiants du nouveau compte par email (API Resend).
 * Nécessite RESEND_API_KEY (et optionnellement EMAIL_FROM) dans les variables
 * d'environnement Vercel. Sans clé → { ok:false, error:'no_email_service' }.
 */
export async function POST(req: NextRequest) {
  let email = ''
  let name = ''
  let password = ''
  try {
    const body = await req.json()
    email = String(body?.email ?? '').trim()
    name = String(body?.name ?? '').trim()
    password = String(body?.password ?? '')
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })
  }
  if (!email || !password) return NextResponse.json({ ok: false, error: 'invalid' }, { status: 400 })

  const key = process.env.RESEND_API_KEY
  if (!key) return NextResponse.json({ ok: false, error: 'no_email_service' })

  const from = process.env.EMAIL_FROM || 'DrogueriePro <onboarding@resend.dev>'
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
  const html = `
  <div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:12px">
    <h2 style="color:#4f46e5;margin:0 0 4px">DrogueriePro</h2>
    <p style="color:#666;font-size:13px;margin:0 0 20px">Édition Entreprise</p>
    <p>Bonjour <b>${esc(name || email)}</b>,</p>
    <p>Votre compte a été créé avec succès. Voici vos identifiants&nbsp;:</p>
    <table style="border-collapse:collapse;margin:14px 0">
      <tr><td style="padding:6px 14px 6px 0;color:#666">Identifiant</td><td style="padding:6px 0"><b>${esc(name || email)}</b></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#666">Email</td><td style="padding:6px 0"><b>${esc(email)}</b></td></tr>
      <tr><td style="padding:6px 14px 6px 0;color:#666">Mot de passe</td><td style="padding:6px 0"><b style="font-family:monospace">${esc(password)}</b></td></tr>
    </table>
    <p style="color:#b45309;font-size:12px">Conservez ce message en lieu sûr et changez votre mot de passe si nécessaire.</p>
  </div>`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [email], subject: 'Vos identifiants DrogueriePro', html }),
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return NextResponse.json({ ok: false, error: 'send_failed', detail: detail.slice(0, 200) }, { status: 502 })
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false, error: 'network' }, { status: 502 })
  }
}
