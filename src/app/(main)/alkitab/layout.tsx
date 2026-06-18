'use client';
import { useState, useEffect } from 'react';
import { DarkModeContext } from './AlkitabContext';

export default function AlkitabLayout({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('alkitab_dark_mode') === 'true';
    }
    return false;
  });

  useEffect(() => {
    // Buat jaga-jaga kalau disinkron di tab lain, tapi karena kita handle toggle di sini, ya aman aja.
  }, []);

  const toggleDark = () => {
    setIsDark(prev => {
      const next = !prev;
      localStorage.setItem('alkitab_dark_mode', String(next));
      return next;
    });
  };

  // Jangan buru-buru return, langsung render aja biar layarnya gak kedip pas pindah halaman

  return (
    <DarkModeContext.Provider value={{ isDark, toggleDark }}>
      <div className={`min-h-screen transition-colors duration-300 ${isDark ? 'bg-slate-900 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
        {children}
      </div>
    </DarkModeContext.Provider>
  );
}
