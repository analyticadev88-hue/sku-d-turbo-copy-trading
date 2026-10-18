import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { PwaProvider } from '@/components/pwa/pwa-provider'
import './globals.css'

const jakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-jakarta',
})

export const metadata: Metadata = {
  title: 'SkuD Turbo Admin',
  description: 'Admin platform for managing SkuD Turbo clients, mentors and MT5 accounts.',
  generator: 'v0.app',
  applicationName: 'SkuD Turbo',
  appleWebApp: {
    capable: true,
    title: 'SkuD Turbo',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: [
      { url: '/icon-light-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'dark',
  themeColor: '#0b0b0d',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`${jakarta.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}
        <PwaProvider />
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
