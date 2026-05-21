'use client';
import { createContext, useContext, useState, useEffect } from 'react';

type DarkModeContextType = {
  isDark: boolean;
  toggleDark: () => void;
};

const DarkModeContext = createContext<DarkModeContextType>({ isDark: false, toggleDark: () => {} });

export function useAlkitabDarkMode() {
  return useContext(DarkModeContext);
}

export default function AlkitabLayout({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('alkitab_dark_mode') === 'true';
    }
    return false;
  });

  useEffect(() => {
    // Only needed to ensure any side effects or storage sync if it was changed in another tab, but since we handle toggle here it's fine.
  }, []);

  const toggleDark = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('alkitab_dark_mode', String(next));
      return next;
    });
  };

  // No early return, render immediately to prevent flash during client navigation

  return (
    <DarkModeContext.Provider value={{ isDark, toggleDark }}>
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        {children}
      </div>
    </DarkModeContext.Provider>
  );
}
