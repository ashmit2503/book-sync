import './globals.css'
import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { AccessibilityProvider } from '@/components/providers/AccessibilityProvider'
import { ServiceWorkerRegistration } from '@/components/providers/ServiceWorkerRegistration'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'BookSync - Your Digital Library',
  description: 'Manage and read your ebooks in the cloud with AI-powered features',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BookSync',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'BookSync',
    title: 'BookSync - Your Digital Library',
    description: 'Manage and read your ebooks in the cloud with AI-powered features',
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#18181b' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="system" storageKey="booksync-theme">
          <AccessibilityProvider>
            {children}
            <ServiceWorkerRegistration />
          </AccessibilityProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
