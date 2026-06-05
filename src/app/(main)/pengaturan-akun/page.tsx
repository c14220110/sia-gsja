'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      <div className="px-5 py-3.5 flex items-center gap-2 border-b border-slate-100 bg-slate-50">
        <span className="material-icons-round text-slate-500 text-[18px]">{icon}</span>
        <span className="text-xs font-black text-slate-600 uppercase tracking-widest">{title}</span>
      </div>
      <div className="px-5 py-2">{children}</div>
    </div>
  );
}

export default function PengaturanAkunPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  const [username, setUsername] = useState('');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState({ type: '', text: '' });

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setProfile(data);
          setUsername(data.username || '');
        } else {
          router.replace('/');
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [router]);

  const handleUpdateUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    setUsernameMsg({ type: '', text: '' });
    setUsernameLoading(true);

    try {
      const res = await fetch('/api/pengguna/pengaturan-akun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_username', username }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Gagal memperbarui username');
      setUsernameMsg({ type: 'success', text: data.message });
      setProfile({ ...profile, username: username.trim().toLowerCase() });
    } catch (err: any) {
      setUsernameMsg({ type: 'error', text: err.message });
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg({ type: '', text: '' });

    if (newPassword !== confirmPassword) {
      setPwdMsg({ type: 'error', text: 'Konfirmasi password tidak cocok' });
      return;
    }
    if (newPassword.length < 6) {
      setPwdMsg({ type: 'error', text: 'Sandi baru minimal 6 karakter' });
      return;
    }

    setPwdLoading(true);

    try {
      const res = await fetch('/api/pengguna/pengaturan-akun', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_password', oldPassword, newPassword }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Gagal memperbarui password');
      
      setPwdMsg({ type: 'success', text: data.message });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwdMsg({ type: 'error', text: err.message });
    } finally {
      setPwdLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-500 text-sm font-semibold">Memuat data akun...</span>
        </div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col max-w-lg mx-auto">
      {/* ─── HERO HEADER ──────────────────────────────────── */}
      <div className="w-full relative overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 pb-6 rounded-b-3xl shadow-sm">
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        
        {/* Back Button */}
        <div className="relative px-5 pt-12 flex items-center">
          <button
            onClick={() => router.push('/')}
            className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-white"
          >
            <span className="material-icons-round text-[20px]">arrow_back</span>
          </button>
          <span className="text-white font-bold text-base ml-3">Pengaturan Akun</span>
        </div>

        {/* Title */}
        <div className="relative flex flex-col px-5 mt-6">
          <h1 className="text-white font-black text-2xl leading-tight">Keamanan Akun</h1>
          <p className="text-blue-100 text-sm mt-1">Kelola informasi login dan kata sandi Anda</p>
        </div>
      </div>

      <div className="flex-1 px-4 py-5 flex flex-col gap-5 pb-10 -mt-4">
        
        {/* ── IDENTIFIER AKTIF ─────────────────────────────── */}
        <SectionCard title="Identifier Login Anda" icon="fingerprint">
          <p className="text-xs text-slate-500 mt-2 mb-4">Anda dapat menggunakan salah satu dari informasi berikut untuk masuk (login) ke dalam sistem SIA.</p>
          
          <div className="flex flex-col gap-3 pb-3">
            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <span className="material-icons-round text-blue-500 text-[20px]">badge</span>
                <span className="text-sm font-semibold text-slate-700">Username</span>
              </div>
              <span className="text-sm font-bold text-slate-900">{profile.username || <span className="text-slate-400 italic font-normal">Belum diatur</span>}</span>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <span className="material-icons-round text-emerald-500 text-[20px]">phone_iphone</span>
                <span className="text-sm font-semibold text-slate-700">No. Handphone</span>
              </div>
              <span className="text-sm font-bold text-slate-900">{profile.pengguna_no_hp || <span className="text-slate-400 italic font-normal">Belum terdaftar</span>}</span>
            </div>

            <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-3">
                <span className="material-icons-round text-rose-500 text-[20px]">email</span>
                <span className="text-sm font-semibold text-slate-700">Email</span>
              </div>
              <span className="text-sm font-bold text-slate-900 break-all text-right max-w-[50%]">{profile.real_email || <span className="text-slate-400 italic font-normal">Belum terdaftar</span>}</span>
            </div>
          </div>
        </SectionCard>

        {/* ── UBAH USERNAME ─────────────────────────────── */}
        <SectionCard title="Ubah Username" icon="account_circle">
          <form onSubmit={handleUpdateUsername} className="py-2 flex flex-col gap-3">
            <p className="text-xs text-slate-500">Username minimal 6 karakter. Hanya boleh berisi huruf, angka, dan underscore (_).</p>
            
            {usernameMsg.text && (
              <div className={`p-2 rounded-lg text-xs font-semibold ${usernameMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {usernameMsg.text}
              </div>
            )}

            <div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-icons-round text-slate-400 text-[18px]">alternate_email</span>
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username baru"
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={usernameLoading || username === profile.username}
              className="w-full py-2.5 mt-1 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {usernameLoading ? 'Menyimpan...' : 'Simpan Username'}
            </button>
          </form>
        </SectionCard>

        {/* ── UBAH PASSWORD ─────────────────────────────── */}
        <SectionCard title="Ubah Kata Sandi" icon="lock_reset">
          <form onSubmit={handleUpdatePassword} className="py-2 flex flex-col gap-3">
            {pwdMsg.text && (
              <div className={`p-2 rounded-lg text-xs font-semibold ${pwdMsg.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {pwdMsg.text}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">Sandi Saat Ini</label>
              <input
                type="password"
                required
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Masukkan sandi saat ini"
                className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3 mt-1">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">Sandi Baru</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1 ml-1">Konfirmasi</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi sandi baru"
                  className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={pwdLoading}
              className="w-full py-2.5 mt-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {pwdLoading ? 'Menyimpan...' : 'Perbarui Kata Sandi'}
            </button>
          </form>
        </SectionCard>

      </div>
    </div>
  );
}
