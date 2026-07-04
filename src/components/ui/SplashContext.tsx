'use client';

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const SPLASH_SHOWN_KEY = 'gsja_splash_shown';

interface SplashContextType {
  isAppReady: boolean;
  signalAppReady: () => void;
}

const SplashContext = createContext<SplashContextType>({
  isAppReady: false,
  signalAppReady: () => {},
});

export const useSplash = () => useContext(SplashContext);

export function SplashProvider({ children }: { children: ReactNode }) {
  // Inisialisasi langsung dari sessionStorage supaya tidak flicker
  // pada navigasi internal / PWA foreground / tab resize
  const [isAppReady, setIsAppReady] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return sessionStorage.getItem(SPLASH_SHOWN_KEY) === '1';
  });

  const signalAppReady = useCallback(() => {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem(SPLASH_SHOWN_KEY, '1');
    }
    setIsAppReady(true);
  }, []);

  return (
    <SplashContext.Provider value={{ isAppReady, signalAppReady }}>
      {children}
    </SplashContext.Provider>
  );
}
