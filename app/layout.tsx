import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Rubik } from 'next/font/google'
import Script from 'next/script'
import './globals.css'

const _rubik = Rubik({ subsets: ['latin', 'cyrillic'] })

export const metadata: Metadata = {
  title: 'FitFlow — дневник КБЖУ',
  description: 'Подсчёт калорий, белков, жиров и углеводов с помощью нейросети прямо в Telegram',
  generator: 'v0.app',
}

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: '#1a2620',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

// Применяем тему до первой отрисовки, чтобы не было мигания
const themeInitScript = `(function(){try{var t=localStorage.getItem("theme")||"dark";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){document.documentElement.classList.add("dark")}})()`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="dark bg-background" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased font-sans">
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
