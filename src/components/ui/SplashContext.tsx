'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

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
  const [isAppReady, setIsAppReady] = useState(false);

  const signalAppReady = useCallback(() => {
    setIsAppReady(true);
  }, []);

  return (
    <SplashContext.Provider value={{ isAppReady, signalAppReady }}>
      {children}
    </SplashContext.Provider>
  );
}
