'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

interface AkunSayaModalProps {
  isOpen: boolean;
  onClose: () => void;
  userData: any;
  setUserData: React.Dispatch<React.SetStateAction<any>>;
}

export default function AkunSayaModal({ isOpen, onClose, userData, setUserData }: AkunSayaModalProps) {
  const router = useRouter();

  const [username, setUsername] = useState(userData?.username || '');
  const [usernameLoading, setUsernameLoading] = useState(false);
  const [usernameMsg, setUsernameMsg] = useState({ type: '', text: '' });

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdMsg, setPwdMsg] = useState({ type: '', text: '' });

  // Ganti username usernya krn profil si user kdg rubah wktu dimuat pertama tu
  React.useEffect(() => {
    if (userData && !username) {
      setUsername(userData.username || '');
    }
  }, [userData]);

  if (!isOpen) return null;

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
      setUserData({ ...userData, username: username.trim().toLowerCase() });
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

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <span className="material-icons-round text-blue-600">manage_accounts</span>
            <h2 className="text-lg font-bold text-slate-800">Akun Saya</h2>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition-colors outline-none">
            <span className="material-icons-round">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto bg-white flex flex-col gap-6">
          
          {/* IDENTIFIER INFO */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 uppercase tracking-wider">Informasi Login Anda</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">Username</span>
                <span className="text-sm font-bold text-slate-800">{userData?.username || <span className="text-slate-400 italic font-normal">Belum diatur</span>}</span>
              </div>
              <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">No. Handphone</span>
                <span className="text-sm font-bold text-slate-800">{userData?.pengguna_no_hp || <span className="text-slate-400 italic font-normal">Belum terdaftar</span>}</span>
              </div>
              <div className="bg-white p-3 rounded-md border border-slate-200 shadow-sm flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-500">Email</span>
                <span className="text-sm font-bold text-slate-800 truncate" title={userData?.real_email || ''}>{userData?.real_email || <span className="text-slate-400 italic font-normal">Belum terdaftar</span>}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Anda dapat menggunakan salah satu dari informasi di atas untuk masuk ke dalam sistem.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* UBAH USERNAME */}
            <form onSubmit={handleUpdateUsername} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-2">Ubah Username</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Username minimal 6 karakter. Hanya boleh berisi huruf, angka, dan underscore (_). Tanpa spasi.
              </p>

              {usernameMsg.text && (
                <div className={`p-2 rounded border text-xs font-medium ${usernameMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {usernameMsg.text}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Username Baru</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="material-icons-round text-slate-400 text-[18px]">alternate_email</span>
                  </div>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Masukkan username"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-auto pt-2">
                <button
                  type="submit"
                  disabled={usernameLoading || username === userData?.username}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {usernameLoading ? 'Menyimpan...' : 'Simpan Username'}
                </button>
              </div>
            </form>

            {/* UBAH PASSWORD */}
            <form onSubmit={handleUpdatePassword} className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-slate-700 border-b border-slate-200 pb-2">Ubah Kata Sandi</h3>
              
              {pwdMsg.text && (
                <div className={`p-2 rounded border text-xs font-medium ${pwdMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                  {pwdMsg.text}
                </div>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Sandi Saat Ini</label>
                <input
                  type="password"
                  required
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Masukkan sandi saat ini"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Sandi Baru</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-slate-700">Konfirmasi</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Ulangi sandi baru"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="mt-auto pt-2">
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 px-4 rounded-md text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pwdLoading ? 'Menyimpan...' : 'Perbarui Kata Sandi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
