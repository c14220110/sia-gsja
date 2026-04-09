'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

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

  const showLoader = () => setActiveRequests(prev => prev + 1);
  const hideLoader = () => setActiveRequests(prev => Math.max(0, prev - 1));

  const isLoading = activeRequests > 0;

  return (
    <LoaderContext.Provider value={{ isLoading, showLoader, hideLoader }}>
      {children}

      {/* Minimal Premium Loader — tidak heboh, tidak ganggu */}
      {isLoading && (
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
            {/* Triple dot pulse */}
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" style={{ animation: 'gsja-bounce 1.2s ease-in-out infinite 0s' }} />
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-400" style={{ animation: 'gsja-bounce 1.2s ease-in-out infinite 0.2s' }} />
              <div className="w-2.5 h-2.5 rounded-full bg-indigo-300" style={{ animation: 'gsja-bounce 1.2s ease-in-out infinite 0.4s' }} />
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
