'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';
import { useSplash } from './SplashContext';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
const DotLottieReact = dynamic(
  () => import('@lottiefiles/dotlottie-react').then((mod) => mod.DotLottieReact),
  { ssr: false }
);
import loadingAnimation from '../../../public/assets/Sandy Loading.json';

type LoaderVariant = 'sandy' | 'minimal';

interface LoaderContextType {
  isLoading: boolean;
  showLoader: () => void;
  hideLoader: () => void;
  setLoaderVariant: (variant: LoaderVariant) => void;
}

const LoaderContext = createContext<LoaderContextType | undefined>(undefined);

export const useLoader = () => {
  const context = useContext(LoaderContext);
  if (!context) {
    throw new Error('useLoader must be used within a LoaderProvider');
  }
  return context;
};

export const LoaderProvider = ({ children }: { children: ReactNode }) => {
  const [activeRequests, setActiveRequests] = useState(0);
  const [variant, setVariant] = useState<LoaderVariant>('sandy');

  const showLoader = () => setActiveRequests(prev => prev + 1);
  const hideLoader = () => setActiveRequests(prev => Math.max(0, prev - 1));
  const setLoaderVariant = (newVariant: LoaderVariant) => setVariant(newVariant);

  const isLoading = activeRequests > 0;
  const { isAppReady } = useSplash();

  // On mobile, suppress loader while splash screen is still covering the screen
  const isMobileSplashActive = !isAppReady;

  return (
    <LoaderContext.Provider value={{ isLoading, showLoader, hideLoader, setLoaderVariant }}>
      {children}
      
      {isLoading && variant === 'sandy' && (
        <div className={`fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 animate-in fade-in duration-200 ${isMobileSplashActive ? 'hidden md:flex' : 'flex'}`}>
          <div className="w-56 h-56 flex items-center justify-center">
             <Lottie animationData={loadingAnimation} loop={true} />
          </div>
        </div>
      )}

      {isLoading && variant === 'minimal' && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            background: 'rgba(248,250,252,0.7)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            animation: 'gsja-fadein 0.15s ease-out both'
          }}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="w-32 h-32">
              <DotLottieReact src="/assets/Loader_PWA.lottie?id=global" autoplay loop  />
            </div>
          </div>

          <style>{`
            @keyframes gsja-fadein {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes gsja-bounce {
              0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
              40% { transform: scale(1.2); opacity: 1; }
            }
          `}</style>
        </div>
      )}
    </LoaderContext.Provider>
  );
};
