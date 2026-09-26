'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSplash } from './SplashContext';

const SPLASH_SHOWN_KEY = 'gsja_splash_shown';

const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((mod) => mod.DotLottieReact),
  { ssr: false }
);

export default function MobileSplashScreen() {
  // SEMENTARA DI-HIDE: Langsung masuk ke halaman tanpa loader/splash awal agar tidak lemot
  return null;

  const { isAppReady } = useSplash();

  // Nilai awal: langsung false jika sudah pernah tampil di sesi ini
  // → tidak ada flash/splash saat navigasi internal, tab resize, PWA foreground
  const [isVisible, setIsVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    // Jika sessionStorage sudah mencatat splash pernah tampil, skip
    if (sessionStorage.getItem(SPLASH_SHOWN_KEY) === '1') return false;
    // Juga skip kalau desktop (md ke atas)
    if (window.innerWidth >= 768) return false;
    return true;
  });

  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!isVisible) return;

    // Jika app sudah siap (API selesai), langsung mulai fade out
    if (isAppReady) {
      setIsFadingOut(true);
      const t = setTimeout(() => setIsVisible(false), 600);
      return () => clearTimeout(t);
    }

    // Timeout maksimal 8 detik — supaya splash tidak stuck selamanya
    const maxTimer = setTimeout(() => {
      setIsFadingOut(true);
      setTimeout(() => setIsVisible(false), 600);
    }, 8000);

    return () => clearTimeout(maxTimer);
  }, [isAppReady, isVisible]);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-slate-50 md:hidden transition-all duration-700 ease-in-out ${
        isFadingOut ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes gsja-splash-logo {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes gsja-splash-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.03); }
        }
        @keyframes gsja-splash-text {
          0% { transform: translateY(10px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .gsja-splash-logo-anim {
          animation: gsja-splash-logo 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                     gsja-splash-pulse 3s ease-in-out infinite 0.8s;
        }
        .gsja-splash-text-anim {
          animation: gsja-splash-text 1s cubic-bezier(0.2, 0.8, 0.2, 1) 0.4s forwards;
          opacity: 0;
        }
      `}} />

      <div className="relative flex flex-col items-center">
        <img
          src="/assets/logo_gsja.png"
          alt="GSJA Logo"
          className="w-56 h-56 object-contain gsja-splash-logo-anim"
        />
        <div className="mt-8 flex flex-col items-center gsja-splash-text-anim">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">GSJA Mobile</h1>
          <p className="text-sm font-semibold text-slate-500 tracking-widest uppercase mt-1">Eben Haezer</p>
        </div>
      </div>

      <div className="absolute bottom-12 flex flex-col items-center gsja-splash-text-anim" style={{ animationDelay: '0.8s' }}>
        <div className="w-28 h-28">
          <DotLottieReact id="splash-loader" src="/assets/Loader_PWA.lottie?id=splash" autoplay loop  />
        </div>
      </div>
    </div>
  );
}
