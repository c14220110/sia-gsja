'use client';

/**
 * ChunkErrorHandler
 * =================
 * Menangani ChunkLoadError yang terjadi saat Service Worker (Serwist) update
 * di tengah sesi aktif. Ketika SW baru mengambil alih tab lama (skipWaiting+clientsClaim),
 * chunk JS lama sudah tidak ada di cache SW baru → ChunkLoadError.
 *
 * Fix: auto-reload halaman saat terdeteksi chunk gagal dimuat.
 * Ini aman karena reload akan memuat ulang semua chunk dari SW baru.
 */
import { useEffect } from 'react';

export default function ChunkErrorHandler() {
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      const msg = event.message || '';
      const isChunkError =
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Failed to fetch dynamically imported module') ||
        msg.includes('error loading dynamically imported module');

      if (isChunkError) {
        console.warn('[ChunkErrorHandler] Chunk load gagal (kemungkinan SW update). Reload otomatis...');
        // Reload sekali saja — gunakan flag sessionStorage agar tidak loop tak terbatas
        const reloadKey = 'chunk_error_reloaded';
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
        }
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      const msg = String(event?.reason?.message || event?.reason || '');
      const isChunkError =
        msg.includes('Loading chunk') ||
        msg.includes('ChunkLoadError') ||
        msg.includes('Failed to fetch dynamically imported module');

      if (isChunkError) {
        console.warn('[ChunkErrorHandler] Chunk promise rejection (SW update). Reload otomatis...');
        const reloadKey = 'chunk_error_reloaded';
        if (!sessionStorage.getItem(reloadKey)) {
          sessionStorage.setItem(reloadKey, '1');
          window.location.reload();
        }
      }
    };

    // Reset flag setelah 10 detik (sehingga reload kedua tetap bisa terjadi jika diperlukan)
    const timer = setTimeout(() => sessionStorage.removeItem('chunk_error_reloaded'), 10_000);

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      clearTimeout(timer);
    };
  }, []);

  return null; // Tidak render apapun
}
