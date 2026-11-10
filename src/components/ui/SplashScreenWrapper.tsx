'use client';

import SplashScreen from './SplashScreen';

/**
 * Wrapper Client Component untuk SplashScreen.
 * Diperlukan karena layout.tsx adalah Server Component,
 * sehingga tidak bisa menggunakan dynamic() dengan ssr: false secara langsung.
 */
export default function SplashScreenWrapper() {
  return <SplashScreen />;
}
