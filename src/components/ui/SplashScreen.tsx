'use client';

import { useEffect, useState } from 'react';

/**
 * SplashScreen - Full-screen welcome image shown on app launch.
 * Gambar 732×1590 (portrait mobile) di-cover ke seluruh layar.
 * Auto-dismiss setelah 2 detik dengan animasi fade-out.
 * Disimpan di sessionStorage agar hanya muncul sekali per sesi (tidak tiap navigasi halaman).
 */
export default function SplashScreen() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Hanya tampil sekali per sesi (tidak muncul lagi saat navigasi antar halaman)
    const shown = sessionStorage.getItem('splash_shown');
    if (shown) return;

    // Hanya tampil di mobile (layar kecil) atau mode standalone PWA
    const isMobile = window.innerWidth <= 768;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;

    if (!isMobile && !isStandalone) {
      // Desktop browser → langsung skip, tandai sudah tampil
      sessionStorage.setItem('splash_shown', '1');
      return;
    }

    setVisible(true);

    // Setelah 2.2 detik, mulai fade-out
    const fadeTimer = setTimeout(() => setFading(true), 2200);
    // Setelah fade-out selesai (0.5 detik), hilangkan dari DOM
    const hideTimer = setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem('splash_shown', '1');
    }, 2700);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        opacity: fading ? 0 : 1,
        transition: 'opacity 0.5s ease-in-out',
        backgroundColor: '#000',
      }}
    >
      <img
        src="/assets/welcome_PWA.jpeg"
        alt="Welcome GSJA"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center top',
          display: 'block',
        }}
      />
    </div>
  );
}
