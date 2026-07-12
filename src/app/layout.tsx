import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { SessionProvider } from '@/components/providers/SessionProvider'
import { ToastProvider } from '@/components/providers/Toaster'
import { createClient } from '@/lib/supabase/server'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: {
    default: 'Recall — PDF Spaced Repetition',
    template: '%s · Recall',
  },
  description:
    'Upload your PDFs and review them on a spaced repetition schedule so what you read actually sticks.',
  icons: {
    icon: '/favicon.ico',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#4f46e5',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <SessionProvider initialUser={user}>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  )
}