import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'SIA GSJA - Accounting Information System',
  description: 'Gereja Sidang Jemaat Allah - Sistem Informasi Akuntansi',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'SIA GSJA',
  },
  icons: {
    icon: '/icon-192.jpg',
    apple: '/icon-192.jpg',
  },
};

import { LoaderProvider } from '@/components/ui/GlobalLoader';
import dynamic from 'next/dynamic';

const SplashScreen = dynamic(() => import('@/components/ui/SplashScreen'), { ssr: false });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link href="https://fonts.googleapis.com/icon?family=Material+Icons+Round" rel="stylesheet" />
      </head>
      <body className={`${inter.variable} ${playfair.variable} antialiased font-sans`}>
        <SplashScreen />
        <LoaderProvider>
          {children}
        </LoaderProvider>
      </body>
    </html>
  );
}
