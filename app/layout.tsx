import './shared/globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { LanguageProvider } from '@/lib/LanguageContext';
import { FontSizeProvider } from '@/lib/FontSizeContext';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import RouteLoader from '@/components/shared/RouteLoader';
import { Suspense } from 'react';

const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  preload: false 
});

export const metadata: Metadata = {
  title: 'Pita Express - Admin Panel',
  description: 'Sistema de administración para Pita Express',
  icons: {
    icon: '/pita_icon.svg',
    shortcut: '/pita_icon.svg',
    apple: '/pita_icon.svg',
  },
  manifest: '/manifest.json',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/pita_icon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/pita_icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/pita_icon.svg" />

      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <LanguageProvider>
            <FontSizeProvider>
            <Suspense fallback={null}>
              <RouteLoader />
            </Suspense>
            <Suspense fallback={null}>
              {children}
            </Suspense>
            <Toaster />
            </FontSizeProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
