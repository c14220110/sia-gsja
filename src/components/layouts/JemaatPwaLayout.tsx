'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLoader } from '@/components/ui/GlobalLoader';
import QRCode from 'react-qr-code';

export default function JemaatPwaLayout({
  children,
  userData
}: {
  children: React.ReactNode;
  userData: any;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const handleLogout = async () => {
    showLoader();
    try {
      await fetch('/api/auth/me', { method: 'POST' });
      hideLoader();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed', err);
      hideLoader();
    }
  };

  const handleSwitchRole = () => {
    if (userData) {
      sessionStorage.setItem('temp_auth_data', JSON.stringify({
        user_id: userData.user_id,
        available_roles: userData.available_roles || []
      }));
      router.push('/select-role');
    }
  };

  const navItems = [
    {
      label: 'Beranda',
      icon: 'home',
      href: '/dashboard',
      active: pathname === '/dashboard'
    },
    {
      label: 'Warta',
      icon: 'newspaper',
      href: '/warta',
      active: pathname.includes('/warta')
    }
  ];

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col font-['Inter'] relative selection:bg-blue-100 selection:text-blue-900 overflow-hidden">
      
      {/* AREA KONTEN UTAMA */}
      <main className="flex-1 w-full pb-24 overflow-y-auto">
        {children}
      </main>

      {/* DRAWER PENGATURAN BAWAH */}
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end animate-in fade-in"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div 
            className="w-full bg-white rounded-t-3xl pt-2 pb-8 px-6 flex flex-col animate-in slide-in-from-bottom"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grabber indicator */}
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
            
            <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Pengaturan Akun</h3>
            <div className="text-slate-500 text-sm mb-6 flex items-center gap-2">
              <span className="material-icons-round text-lg">account_circle</span>
              {userData?.email || 'Jemaat'}
            </div>

            <div className="w-full border-t border-slate-100 pt-4 mb-4 flex flex-col gap-2">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Manajemen Profil</h4>
               
               {/* Data Diri Link */}
               <Link href={`/profil`} onClick={() => setIsSettingsOpen(false)} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
                        <span className="material-icons-round text-[20px]">badge</span>
                     </div>
                     <div>
                        <div className="font-bold text-slate-800 text-sm">Data Diri & NIK</div>
                        <div className="text-xs text-slate-500">Lihat identitas kependudukan</div>
                     </div>
                  </div>
                  <span className="material-icons-round text-slate-300">chevron_right</span>
               </Link>

               {/* Relasi Keluarga Link */}
               <Link href="/profil?tab=keluarga" onClick={() => setIsSettingsOpen(false)} className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center">
                        <span className="material-icons-round text-[20px]">family_restroom</span>
                     </div>
                     <div>
                        <div className="font-bold text-slate-800 text-sm">Kartu Keluarga</div>
                        <div className="text-xs text-slate-500">Anggota dan relasi famili</div>
                     </div>
                  </div>
                  <span className="material-icons-round text-slate-300">chevron_right</span>
               </Link>
            </div>

            <div className="w-full border-t border-slate-100 pt-4 flex flex-col gap-2">
               <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Keamanan Sistem</h4>
              {(userData?.available_roles?.length > 1) && (
                <button 
                  onClick={handleSwitchRole}
                  className="w-full flex items-center justify-between p-3 hover:bg-slate-50 rounded-2xl transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                      <span className="material-icons-round text-[20px]">swap_horiz</span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-sm">Ganti Peran</div>
                      <div className="text-xs text-slate-500">Akses Pengurus atau Pelayan</div>
                    </div>
                  </div>
                  <span className="material-icons-round text-slate-300">chevron_right</span>
                </button>
              )}

              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-3 bg-rose-50 hover:bg-rose-100 rounded-2xl transition-colors text-left mt-2"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-white/50 text-rose-600 rounded-full flex items-center justify-center shadow-sm">
                    <span className="material-icons-round text-[20px]">logout</span>
                  </div>
                  <div>
                    <div className="font-bold text-rose-700 text-sm">Tutup Sesi</div>
                    <div className="text-xs text-rose-500/80">Keluar dari aplikasi GSJA</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-slate-200/60 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50">
        <div className="flex justify-between items-center px-4 md:px-8 py-2 max-w-lg mx-auto relative">
          
          {/* Menu Kiri */}
          <div className="flex w-2/5 justify-between">
            <Link href={navItems[0].href} className={`flex flex-col items-center justify-center w-full h-12 gap-1 rounded-xl transition-all ${navItems[0].active ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
              <span className={`material-icons-round text-2xl transition-transform ${navItems[0].active ? 'scale-110' : ''}`}>{navItems[0].icon}</span>
              <span className="text-[10px] tracking-wide">{navItems[0].label}</span>
            </Link>
            <Link href={navItems[1].href} className={`flex flex-col items-center justify-center w-full h-12 gap-1 rounded-xl transition-all ${navItems[1].active ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
              <span className={`material-icons-round text-2xl transition-transform ${navItems[1].active ? 'scale-110' : ''}`}>{navItems[1].icon}</span>
              <span className="text-[10px] tracking-wide">{navItems[1].label}</span>
            </Link>
          </div>

          {/* Floating Action Button Tengah (QR Code) */}
          <div className="w-1/5 flex justify-center relative">
            <button 
              onClick={() => setShowQrModal(true)}
              className="absolute -top-9 w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-full flex flex-col items-center justify-center text-white shadow-xl shadow-blue-500/30 border-4 border-white active:scale-95 transition-transform"
            >
              <span className="material-icons-round text-[32px]">qr_code_scanner</span>
            </button>
            <span className="text-[10px] font-bold text-slate-800 tracking-wide mt-8">QR Saya</span>
          </div>

          {/* Menu Kanan */}
          <div className="flex w-2/5 justify-between">
            <Link href="/tiket" className={`flex flex-col items-center justify-center w-full h-12 gap-1 rounded-xl transition-all ${pathname.includes('/tiket') ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
              <span className={`material-icons-round text-2xl transition-transform ${pathname.includes('/tiket') ? 'scale-110' : ''}`}>local_activity</span>
              <span className="text-[10px] tracking-wide">Tiket</span>
            </Link>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className={`flex flex-col items-center justify-center w-full h-12 gap-1 rounded-xl transition-all ${isSettingsOpen ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}
            >
              <span className={`material-icons-round text-2xl transition-transform ${isSettingsOpen ? 'scale-110' : ''}`}>settings</span>
              <span className="text-[10px] tracking-wide">Pengaturan</span>
            </button>
          </div>

        </div>
      </nav>

      {/* MODAL QR CODE FULL SCREEN (OFFLINE SUPPORTED) */}
      {showQrModal && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in duration-200">
          
          <div className="w-full flex items-center justify-between p-6">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">QR Kehadiran</h2>
            <button onClick={() => setShowQrModal(false)} className="w-10 h-10 bg-slate-100 text-slate-500 rounded-full flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all">
              <span className="material-icons-round text-[24px]">close</span>
            </button>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center px-8 pb-12">
            
            <p className="text-slate-500 text-center text-sm font-medium mb-10 max-w-xs leading-relaxed">
              Tunjukkan layar ini kepada Usher untuk proses absensi mandiri yang cepat pada setiap acara gereja.
            </p>

            {/* Kotak QR Code yang sangat kontras/terang */}
            <div className="w-64 h-64 bg-white p-4 rounded-3xl outline outline-1 outline-offset-[10px] outline-slate-200 shadow-2xl shadow-blue-900/10 flex items-center justify-center mb-8">
              <QRCode 
                value={userData?.jemaat_id || userData?.user_id?.toString() || 'NO-ID'} 
                size={220}
                level="H"
                fgColor="#0f172a" /* slate-900 */
              />
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-1">{userData?.email || userData?.nama_lengkap || 'Jemaat GSJA'}</h3>
            <div className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-50 text-blue-700 font-mono font-bold tracking-widest rounded-lg border border-blue-100">
              <span className="material-icons-round text-[16px]">badge</span>
              {userData?.jemaat_id || 'ID TIDAK DITEMUKAN'}
            </div>

          </div>

          <div className="p-6 bg-slate-50 mt-auto border-t border-slate-100">
            <div className="flex items-center gap-3">
              <span className="material-icons-round text-amber-500 text-3xl">light_mode</span>
              <p className="text-xs text-slate-500 leading-relaxed font-medium">
                Kecerahan layar ponsel Anda disarankan untuk diarahkan ke maksimal saat di-_scan_ agar 100% akurat. Fitur QR ini tetap jalan walau HP kehilangan sinyal (Offline / Airplane mode).
              </p>
            </div>
          </div>

        </div>
      )}


    </div>
  );
}
