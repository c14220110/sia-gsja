'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLoader } from '@/components/ui/GlobalLoader';

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
      href: '/dashboard/warta',
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

            <div className="w-full flex flex-col gap-3">
              {(userData?.available_roles?.length > 1) && (
                <button 
                  onClick={handleSwitchRole}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 rounded-2xl transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center">
                      <span className="material-icons-round">swap_horiz</span>
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">Ganti Peran</div>
                      <div className="text-xs text-slate-500">Pindah ke akses Pengurus/Pelayan</div>
                    </div>
                  </div>
                  <span className="material-icons-round text-slate-400">chevron_right</span>
                </button>
              )}

              <button 
                onClick={handleLogout}
                className="w-full flex items-center justify-between p-4 bg-rose-50 hover:bg-rose-100 rounded-2xl transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center">
                    <span className="material-icons-round">logout</span>
                  </div>
                  <div>
                    <div className="font-bold text-rose-600">Keluar Sistem</div>
                    <div className="text-xs text-rose-500/70">Akhiri sesi anda saat ini</div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 w-full bg-white/80 backdrop-blur-md border-t border-slate-200/50 px-6 py-2 pb-safe shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)] z-50 flex justify-between items-center sm:justify-center sm:gap-16">
        {navItems.map((item, idx) => (
          <Link 
            key={idx} 
            href={item.href}
            className={`flex flex-col items-center justify-center w-16 h-12 gap-1 rounded-xl transition-all ${
              item.active ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
            }`}
          >
            <span className={`material-icons-round text-2xl transition-transform ${item.active ? 'scale-110' : ''}`}>
              {item.active ? item.icon : `${item.icon}`}
            </span>
            <span className="text-[10px] tracking-wide">{item.label}</span>
          </Link>
        ))}
        
        {/* Settings / Account Toggle (Direct to drawer) */}
        <button 
          onClick={() => setIsSettingsOpen(true)}
          className={`flex flex-col items-center justify-center w-16 h-12 gap-1 rounded-xl transition-all ${
            isSettingsOpen ? 'text-indigo-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'
          }`}
        >
          <span className={`material-icons-round text-2xl transition-transform ${isSettingsOpen ? 'scale-110' : ''}`}>
            settings
          </span>
          <span className="text-[10px] tracking-wide">Pengaturan</span>
        </button>
      </nav>

    </div>
  );
}
