import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SIA GSJA - Sistem Informasi Gereja',
    short_name: 'SIA GSJA',
    description: 'Aplikasi Terpadu Jemaat dan Pengurus Gereja Sidang Jemaat Allah',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#2563eb',
    icons: [
      {
        src: '/icon-192.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
      },
      {
        src: '/icon-512.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
      {
        src: '/assets/logo_gsja.png',
        sizes: 'any',
        type: 'image/png',
      },
    ],
  };
}
