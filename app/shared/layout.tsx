import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from '@/components/ui/toaster';
import { ThemeProvider } from '@/components/theme-provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Pita Express',
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
    <html lang="en">
      <head>
        <link rel="icon" href="/pita_icon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/pita_icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/pita_icon.svg" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
