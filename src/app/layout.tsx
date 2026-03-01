import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-display' });

export const metadata: Metadata = {
  title: 'SIA GSJA Login - Accounting Information System',
  description: 'Gereja Sidang Jemaat Allah - Sistem Informasi Akuntansi',
};

import { LoaderProvider } from '@/components/ui/GlobalLoader';

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
        <LoaderProvider>
          {children}
        </LoaderProvider>
      </body>
    </html>
  );
}
