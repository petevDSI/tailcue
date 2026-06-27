import type { Metadata, Viewport } from 'next'
import { CareAuthProvider } from '@/components/care/CareAuthProvider'

export const metadata: Metadata = {
  title: 'Tailcue Care',
  description: "Track your pet's chronic condition at home",
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tailcue Care',
  },
}

export const viewport: Viewport = {
  themeColor: '#F59E0B',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
}

export default function CareLayout({ children }: { children: React.ReactNode }) {
  return <CareAuthProvider>{children}</CareAuthProvider>
}
