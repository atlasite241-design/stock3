import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import './globals.css'
import { LanguageProvider } from '@/lib/i18n'
import { AuthProvider } from '@/lib/auth-context'
import { DroguerieProvider } from '@/lib/droguerie-provider'
import PwaRegister from '@/components/PwaRegister'
import InstallPrompt from '@/components/InstallPrompt'
import BootSplash from '@/components/BootSplash'

export const metadata: Metadata = {
  title: 'Droguerie Pro — Gestion & Caisse',
  description: 'Application de gestion pour droguerie : caisse, produits, stock, ventes et clients.',
  manifest: '/manifest.json',
  applicationName: 'Droguerie Pro',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Droguerie Pro',
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#f59e0b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
}

// App 100 % client (localStorage + synchro navigateur) : pas de pré-rendu statique
// au build. Le rendu se fait à la demande, comme en mode dev.
export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{
              if(localStorage.getItem('dp_theme')==='dark')document.documentElement.classList.add('dark');
              var lang=localStorage.getItem('dp_lang');
              if(lang==='ar'){document.documentElement.setAttribute('lang','ar');document.documentElement.setAttribute('dir','rtl')}
              var P=JSON.parse(localStorage.getItem('dp_primary')||'{"id":"amber"}');
              var SH=[50,100,200,300,400,500,600,700,800,900];
              var R={
                violet:['245 243 255','237 233 254','221 214 254','196 181 253','167 139 250','139 92 246','124 58 237','109 40 217','91 33 182','76 29 149'],
                teal:['240 253 250','204 251 241','153 246 228','94 234 212','45 212 191','20 184 166','13 148 136','15 118 110','17 94 89','19 78 74'],
                rose:['255 241 242','255 228 230','254 205 211','253 164 175','251 113 133','244 63 94','225 29 72','190 18 60','159 18 57','136 19 55'],
                blue:['239 246 255','219 234 254','191 219 254','147 197 253','96 165 250','59 130 246','37 99 235','29 78 216','30 64 175','30 58 138']
              };
              function setR(a,y){var r=document.documentElement;for(var i=0;i<SH.length;i++){r.style.setProperty('--c-amber-'+SH[i],a[i]);r.style.setProperty('--c-yellow-'+SH[i],y[i]);}}
              if(P.id==='custom'&&P.hex){
                var h=P.hex.replace('#','');if(h.length===3)h=h.split('').map(function(c){return c+c}).join('');
                var n=parseInt(h,16),cr=(n>>16)&255,cg=(n>>8)&255,cb=n&255;
                var MX={50:[255,.92],100:[255,.84],200:[255,.68],300:[255,.48],400:[255,.24],500:[0,0],600:[0,.12],700:[0,.28],800:[0,.44],900:[0,.58]};
                var ramp=SH.map(function(s){var t=MX[s][0],a=MX[s][1];function m(c){return Math.round(c+(t-c)*a)}return m(cr)+' '+m(cg)+' '+m(cb)});
                setR(ramp,ramp);
              } else if(P.id&&R[P.id]){setR(R[P.id],R[P.id]);}
            }catch(e){}`,
          }}
        />
      </head>
      <body className="font-sans">
        <PwaRegister />
        <LanguageProvider>
          <DroguerieProvider>
            <AuthProvider>
              <BootSplash />
              {children}
            </AuthProvider>
          </DroguerieProvider>
          <InstallPrompt />
        </LanguageProvider>
      </body>
    </html>
  )
}
