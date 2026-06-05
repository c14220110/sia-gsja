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
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Force Change Password states
  const [showForceChange, setShowForceChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Forgot Password states
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotError, setForgotError] = useState('');

  const toggleDarkMode = () => {
    document.documentElement.classList.toggle('dark');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setSuccessMsg('');
    setLoading(true); showLoader();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Login failed');

      if (data.requires_password_change) {
        setShowForceChange(true);
        hideLoader();
        return;
      }

      if (data.requires_role_selection) {
        try {
          sessionStorage.setItem('temp_auth_data', JSON.stringify(data.data));
        } catch (e) {
          (window as any).__TEMP_AUTH_DATA = JSON.stringify(data.data);
        }
        hideLoader();
        router.push('/select-role');
      } else {
        hideLoader();
        router.push('/');
      }
    } catch (err: any) { setError(err.message); hideLoader(); } 
    finally { setLoading(false); }
  };

  const handleForceChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setError('Konfirmasi password tidak cocok.'); return; }
    if (newPassword.length < 6) { setError('Password minimal 6 karakter.'); return; }
    
    setError(''); setSuccessMsg(''); setLoading(true); showLoader();
    try {
      const res = await fetch('/api/auth/force-change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, old_password: password, new_password: newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Gagal mengubah password');
      
      setSuccessMsg(data.message || 'Berhasil. Silakan login dengan password baru.');
      setShowForceChange(false);
      setPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch(err: any) { setError(err.message); }
    finally { setLoading(false); hideLoader(); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(''); setForgotMsg('');
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      setForgotMsg(data.message || 'Link reset telah dikirim.');
    } catch {
      setForgotError('Gagal mengirim. Coba lagi.');
    } finally {
      setForgotLoading(false);
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
              Sistem Informasi Manajemen (SIM)
            </p>
            <div className="mt-6 flex items-center space-x-2 text-sm text-white/80">
              <span className="material-icons-round text-base">verified_user</span>
              <span>Secure &amp; Reliable System</span>
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
                {showForceChange ? 'Ubah Password Default' : 'Welcome Back'}
              </h1>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {showForceChange ? 'Demi keamanan, Anda diwajibkan mengganti password lahir default Anda sekarang.' : 'Please enter your credentials to access the SIA dashboard.'}
              </p>
            </div>
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 p-3 rounded-lg text-sm text-center">
                {error}
              </div>
            )}
            {successMsg && (
              <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 p-3 rounded-lg text-sm text-center">
                {successMsg}
              </div>
            )}
            {!showForceChange ? (
              <form onSubmit={handleLogin} className="space-y-6">
              <div className="relative group">
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 pl-1"
                  htmlFor="email"
                >
                  Email / No. HP / Username
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
                    placeholder="Email / No. HP / Username"
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
                      className="font-medium text-primary hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
                      onClick={() => { setShowForgotPassword(true); setForgotMsg(''); setForgotError(''); setForgotEmail(''); }}
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
            ) : (
              <form onSubmit={handleForceChange} className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="relative group">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 pl-1">Password Baru</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-icons-round text-gray-400 dark:text-gray-500 group-focus-within:text-emerald-500 transition-colors">lock_outline</span>
                    </div>
                    <input className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Minimal 6 karakter" minLength={6} />
                  </div>
                </div>
                <div className="relative group">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 pl-1">Konfirmasi Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="material-icons-round text-gray-400 dark:text-gray-500 group-focus-within:text-emerald-500 transition-colors">check_circle_outline</span>
                    </div>
                    <input className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      required type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Ulangi password baru" minLength={6} />
                  </div>
                </div>
                <div className="pt-2 flex gap-3">
                  <button type="button" onClick={() => { setShowForceChange(false); setPassword(''); setError(''); }} className="w-1/3 py-3 px-4 border border-gray-300 text-gray-700 bg-white rounded-lg font-semibold hover:bg-gray-50">Batal</button>
                  <button type="submit" disabled={loading} className="w-2/3 py-3 px-4 border border-transparent rounded-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-70">
                    {loading ? 'Menyimpan...' : 'Simpan Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
      {/* ── FORGOT PASSWORD MODAL ────────────────────────── */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Reset Password</h2>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Masukkan email akun SIA Anda</p>
              </div>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="material-icons-round text-xl">close</span>
              </button>
            </div>

            <div className="px-6 py-6">
              {forgotMsg ? (
                /* Success state */
                <div className="text-center py-2">
                  <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="material-icons-round text-emerald-500 text-3xl">mark_email_read</span>
                  </div>
                  <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed mb-6">{forgotMsg}</p>
                  <button
                    onClick={() => setShowForgotPassword(false)}
                    className="w-full py-2.5 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg transition-colors"
                  >
                    Tutup
                  </button>
                </div>
              ) : (
                /* Form state */
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Akun SIM
                    </label>
                    <input
                      type="email"
                      required
                      value={forgotEmail}
                      onChange={e => setForgotEmail(e.target.value)}
                      placeholder="Masukkan email Anda"
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>

                  {forgotError && (
                    <p className="text-red-500 text-xs">{forgotError}</p>
                  )}

                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg px-4 py-3">
                    <p className="text-amber-700 dark:text-amber-400 text-xs leading-relaxed">
                      Link reset password akan dikirim ke email Anda dan hanya berlaku <strong>30 menit</strong>.
                    </p>
                  </div>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      className="w-1/3 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-2/3 py-2.5 bg-primary hover:bg-[#253350] disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      {forgotLoading ? 'Mengirim...' : 'Kirim Link Reset'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
      {/* ── END FORGOT PASSWORD MODAL ────────────────────── */}


    </div>
  );
}
