'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'success'>('loading');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    fetch(`/api/auth/reset-password?token=${token}`)
      .then(res => res.json())
      .then(data => {
        setStatus(data.valid ? 'valid' : 'invalid');
      })
      .catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password minimal 6 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Konfirmasi password tidak cocok.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Terjadi kesalahan.');
        return;
      }

      setStatus('success');
    } catch {
      setError('Gagal terhubung ke server. Coba lagi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-slate-700 px-8 py-6 text-center">
            <img
              src="/assets/logo_gsja.png"
              alt="GSJA Logo"
              className="h-12 w-12 object-contain mx-auto mb-3"
            />
            <h1 className="text-white font-bold text-lg">SIM GSJA Eben Haezer</h1>
            <p className="text-slate-400 text-xs mt-1">Sistem Informasi Manajemen</p>
          </div>

          <div className="px-8 py-8">
            {/* LOADING */}
            {status === 'loading' && (
              <div className="text-center py-8">
                <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-600 rounded-full animate-spin mx-auto mb-4" />
                <p className="text-slate-500 text-sm">Memverifikasi link reset password...</p>
              </div>
            )}

            {/* INVALID */}
            {status === 'invalid' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-icons-round text-red-500 text-3xl">link_off</span>
                </div>
                <h2 className="text-slate-800 font-bold text-xl mb-2">Link Tidak Valid</h2>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  Link reset password ini sudah kadaluarsa atau tidak valid. Link hanya berlaku selama 30 menit.
                </p>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full py-3 bg-slate-700 hover:bg-slate-800 text-white font-semibold rounded-lg transition-colors"
                >
                  Kembali ke Halaman Login
                </button>
              </div>
            )}

            {/* SUCCESS */}
            {status === 'success' && (
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="material-icons-round text-emerald-500 text-3xl">check_circle</span>
                </div>
                <h2 className="text-slate-800 font-bold text-xl mb-2">Password Berhasil Diubah!</h2>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  Password akun Anda telah berhasil diperbarui. Silakan login menggunakan password baru Anda.
                </p>
                <button
                  onClick={() => router.push('/login')}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Login Sekarang
                </button>
              </div>
            )}

            {/* FORM */}
            {status === 'valid' && (
              <>
                <div className="mb-6">
                  <h2 className="text-slate-800 font-bold text-xl mb-1">Buat Password Baru</h2>
                  <p className="text-slate-500 text-sm">Masukkan password baru Anda di bawah ini. Minimal 6 karakter.</p>
                </div>

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-lg">
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* New Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password Baru</label>
                    <div className="relative">
                      <input
                        type={showNew ? 'text' : 'password'}
                        value={newPassword}
                        onChange={e => setNewPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="Minimal 6 karakter"
                        className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNew(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <span className="material-icons-round text-[18px]">
                          {showNew ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Konfirmasi Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        placeholder="Ulangi password baru"
                        className="w-full pl-4 pr-10 py-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 bg-white text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <span className="material-icons-round text-[18px]">
                          {showConfirm ? 'visibility_off' : 'visibility'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Password match indicator */}
                  {confirmPassword && (
                    <p className={`text-xs ${newPassword === confirmPassword ? 'text-emerald-600' : 'text-red-500'}`}>
                      {newPassword === confirmPassword ? '✓ Password cocok' : '✗ Password tidak cocok'}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-400 text-white font-semibold rounded-lg transition-colors mt-2"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan Password Baru'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-slate-400 text-xs mt-4">
          © 2026 GSJA Eben Haezer — Internal Use Only
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-700 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
