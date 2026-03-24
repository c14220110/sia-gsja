'use client';

import React from 'react';
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
    },
    {
      label: 'Pengaturan',
      icon: 'settings',
      href: '/dashboard/settings/jemaat',
      active: pathname.includes('/settings')
    }
  ];

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col font-['Inter'] relative selection:bg-blue-100 selection:text-blue-900">
      
      {/* AREA KONTEN UTAMA */}
      {/* Memberikan padding bawah agar tidak tertutup Bottom NavBar */}
      <main className="flex-1 w-full pb-24 overflow-x-hidden">
        {children}
      </main>

      {/* BOTTOM NAVIGATION BAR (Sticky di bawah ala PWA) */}
      <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-slate-200 px-6 py-2 pb-safe shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-50 flex justify-between items-center sm:justify-center sm:gap-16">
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
      </nav>

    </div>
  );
}
