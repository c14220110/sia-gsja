'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLoader } from '@/components/ui/GlobalLoader';

export default function LoginPage() {
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    showLoader();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.requires_role_selection) {
        sessionStorage.setItem('temp_auth_data', JSON.stringify(data.data));
        hideLoader();
        router.push('/select-role');
      } else {
        hideLoader();
        router.push('/dashboard');
      }
      
    } catch (err: any) {
      setError(err.message);
      hideLoader(); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-light dark:bg-background-dark font-sans antialiased h-screen w-full flex items-center justify-center p-4 transition-colors duration-300">
      <div className="bg-surface-light dark:bg-surface-dark w-full max-w-6xl h-[85vh] min-h-[600px] shadow-2xl rounded-2xl overflow-hidden flex flex-col md:flex-row transition-colors duration-300">
        <div className="hidden md:block md:w-1/2 relative h-full">
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent z-10 mix-blend-multiply pointer-events-none"></div>
          <img
            alt="Beautiful sunset view of GSJA Church building"
            className="absolute inset-0 w-full h-full object-cover"
            src="/assets/gedung_gsja.jpg"
          />
          <div className="absolute bottom-10 left-10 z-20 text-white max-w-md">
            <h2 className="font-display text-4xl font-semibold mb-2 drop-shadow-lg">
              Gereja Sidang Jemaat Allah
            </h2>
            <p className="text-secondary/90 text-lg font-light drop-shadow-md border-l-4 border-secondary pl-4">
              Sistem Informasi Akuntansi (SIA)
            </p>
            <div className="mt-6 flex items-center space-x-2 text-sm text-white/80">
              <span className="material-icons-round text-base">verified_user</span>
              <span>Secure &amp; Reliable Accounting</span>
            </div>
          </div>
        </div>
        <div className="w-full md:w-1/2 flex flex-col justify-center items-center p-8 md:p-12 lg:p-16 relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/10 dark:bg-secondary/5 rounded-bl-full -mr-8 -mt-8 pointer-events-none"></div>
          <div className="w-full max-w-md space-y-8">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-24 h-24 mb-4">
                <img src="/assets/logo_gsja.png" alt="GSJA Logo" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
                Welcome Back
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                Please enter your credentials to access the SIA dashboard.
              </p>
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="relative group">
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 pl-1"
                  htmlFor="email"
                >
                  Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-icons-round text-gray-400 dark:text-gray-500 group-focus-within:text-primary transition-colors">
                      person
                    </span>
                  </div>
                  <input
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-all shadow-sm"
                    id="email"
                    name="email"
                    placeholder="Enter your email"
                    required
                    type="text"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="relative group">
                <div className="flex items-center justify-between mb-1 pl-1">
                  <label
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    htmlFor="password"
                  >
                    Password
                  </label>
                  <div className="text-sm">
                    <a
                      className="font-medium text-primary hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                      href="#"
                    >
                      Forgot password?
                    </a>
                  </div>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-icons-round text-gray-400 dark:text-gray-500 group-focus-within:text-primary transition-colors">
                      lock
                    </span>
                  </div>
                  <input
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary sm:text-sm transition-all shadow-sm"
                    id="password"
                    name="password"
                    placeholder="••••••••"
                    required
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
              <div className="pt-2">
                <button
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-md text-sm font-semibold text-white bg-primary hover:bg-[#253350] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all duration-200 transform hover:-translate-y-0.5 disabled:opacity-70 disabled:cursor-not-allowed"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Sign In to SIA'}
                </button>
              </div>
              <div className="mt-6 text-center">
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  © 2026 GSJA. Internal Use Only. <br />
                  Protected by reCAPTCHA and subject to the Privacy Policy and Terms of Service.
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="fixed bottom-4 right-4 z-50">
        <button
          className="bg-white dark:bg-gray-800 text-gray-800 dark:text-white p-3 rounded-full shadow-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          onClick={toggleDarkMode}
        >
          <span className="material-icons-round dark:hidden">dark_mode</span>
          <span className="material-icons-round hidden dark:block">light_mode</span>
        </button>
      </div>
    </div>
  );
}
