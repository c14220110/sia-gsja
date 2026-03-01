'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, usePathname } from 'next/navigation';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import loadingAnimation from '../../../public/assets/Sandy Loading.json';

interface LoaderContextType {
  isLoading: boolean;
  showLoader: () => void;
  hideLoader: () => void;
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

  const router = useRouter();
  const pathname = usePathname();

  const showLoader = () => setActiveRequests(prev => prev + 1);
  const hideLoader = () => setActiveRequests(prev => Math.max(0, prev - 1));

  const isLoading = activeRequests > 0;

  return (
    <LoaderContext.Provider value={{ isLoading, showLoader, hideLoader }}>
      {children}
      
      {/* Global Fullscreen Overlay */}
      {isLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
          <div className="w-56 h-56 flex items-center justify-center">
             <Lottie animationData={loadingAnimation} loop={true} />
          </div>
        </div>
      )}
    </LoaderContext.Provider>
  );
};
