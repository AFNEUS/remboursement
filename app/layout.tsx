import './globals.css'
import type { Metadata, Viewport } from 'next'
import Navigation from '@/components/Navigation';

export const metadata: Metadata = {
  title: 'AFNEUS - Remboursements',
  description: 'Système de gestion des demandes de remboursement',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AFNEUS Remb.',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#2563eb',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-gray-50">
        <Navigation />
        {children}
      </body>
    </html>
  );
}
