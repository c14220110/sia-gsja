'use client';
import { createContext, useContext } from 'react';

export type DarkModeContextType = {
  isDark: boolean;
  toggleDark: () => void;
};

export const DarkModeContext = createContext<DarkModeContextType>({ isDark: false, toggleDark: () => {} });

export function useAlkitabDarkMode() {
  return useContext(DarkModeContext);
}
