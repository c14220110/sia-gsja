'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLoader } from '@/components/ui/GlobalLoader';
import JemaatPwaLayout from '@/components/layouts/JemaatPwaLayout';
import AkunSayaModal from '@/components/ui/AkunSayaModal';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { showLoader, hideLoader } = useLoader();
  const [userData, setUserData] = useState<any>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [submenuTop, setSubmenuTop] = useState<number>(0);
  const submenuTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileExpandedMenus, setMobileExpandedMenus] = useState<Record<string, boolean>>({});
  const [isAkunSayaModalOpen, setIsAkunSayaModalOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMobileMenu = (menuId: string) => {
    setMobileExpandedMenus(prev => ({ ...prev, [menuId]: !prev[menuId] }));
  };

  const handleMouseEnterMenu = (menuId: string, e: React.MouseEvent) => {
    if (submenuTimeout.current) clearTimeout(submenuTimeout.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setSubmenuTop(rect.top);
    setActiveSubmenu(menuId);
  };

  const handleMouseLeaveMenu = () => {
    submenuTimeout.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 150);
  };

  useEffect(() => {
    // Tarik info pengguna aktif dari token JWT
    const fetchUser = async () => {
      showLoader();
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUserData(data);
          localStorage.setItem('gsja_user_data', JSON.stringify(data)); // Simpan ke brankas HP
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Offline / Failed to fetch user', err);
        // BONGKAR CACHE SAAT OFFLINE AGAR TIDAK BLANK PUTIH
        const cachedUser = localStorage.getItem('gsja_user_data');
        if (cachedUser) {
           setUserData(JSON.parse(cachedUser));
        }
      } finally {
        hideLoader();
      }
    };
    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    showLoader();
    try {
      await fetch('/api/auth/me', { method: 'POST' });
      hideLoader();
      router.push('/login');
    } catch (err) {
      console.error('Logout failed', err);
      hideLoader(); // Only hide on error
    }
  };

  const handleSwitchRole = () => {
    if (userData) {
      // Gak perlu nyimpen user_id — urusan identitas biar diurus backend liat cookie.
      // Cukup simpan daftar role untuk ditampilkan di halaman pilih role.
      const payload = {
        available_roles: userData.available_roles || []
      };
      try {
        sessionStorage.setItem('temp_auth_data', JSON.stringify(payload));
      } catch (e) {
        (window as any).__TEMP_AUTH_DATA = JSON.stringify(payload);
      }
      router.push('/select-role');
    }
  };


  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  // Info: Dulu hak akses Sekretaris Satelit diatur pake isSekretarisSatelit kaku.
  // Now fully driven by hasPermission() on each menu section — no hardcoded role_id needed.

  let topbarTitle = 'Dashboard Utama';
  let topbarIcon  = 'dashboard';

  if (
    pathname.includes('/jemaat') ||
    pathname.includes('/pelayan') ||
    pathname.includes('/pengurus')
  ) {
    topbarTitle = 'Manajemen User';
    topbarIcon  = 'manage_accounts';
  } else if (pathname.includes('/settings')) {
    topbarTitle = 'Pengaturan Software';
    topbarIcon  = 'settings';
  } else if (pathname.includes('/kegiatan/notifikasi')) {
    topbarTitle = 'Broadcast Notifikasi';
    topbarIcon  = 'campaign';
  } else if (pathname.includes('/kegiatan/survei')) {
    topbarTitle = 'Survei Kepuasan';
    topbarIcon  = 'poll';
  } else if (pathname.includes('/kegiatan')) {
    topbarTitle = 'Modul Kegiatan';
    topbarIcon  = 'event';
  } else if (pathname.includes('/pegawai')) {
    topbarTitle = 'Manajemen Pegawai (HRD)';
    topbarIcon  = 'badge';
  } else if (pathname.includes('/buku-besar')) {
    topbarTitle = 'Buku Besar & Keuangan';
    topbarIcon  = 'menu_book';
  } else if (pathname.includes('/anggaran')) {
    topbarTitle = 'Anggaran & Plotting';
    topbarIcon  = 'request_quote';
  } else if (pathname.includes('/family-tree')) {
    topbarTitle = 'Family Tree';
    topbarIcon  = 'account_tree';
  }


  if (userData?.role_name?.toLowerCase() === 'jemaat') {
    return (
      <JemaatPwaLayout userData={userData}>
        {children}
      </JemaatPwaLayout>
    );
  }

  // Selama data user-nya masih muter, kasih layar putih kosong aja sementara
  // agar sidebar admin tidak "flash" sesaat sebelum redirect ke PWA Jemaat
  if (!userData) {
    return (
      <div className="w-full min-h-screen bg-slate-50 flex items-center justify-center" />
    );
  }

  return (
    <div className="w-full min-h-screen bg-neutral-100 inline-flex flex-col justify-start items-center overflow-auto font-sans">
      <div className="w-full h-screen inline-flex justify-start items-start overflow-hidden">
        
        {/* Sidebar */}
        {/* Mobile Backdrop */}
        {isMobileMenuOpen && (
          <div 
            className="md:hidden fixed inset-0 bg-slate-900/50 z-[100] backdrop-blur-sm transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <div className={`fixed inset-y-0 left-0 z-[110] transform ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 group h-full bg-slate-700 flex-shrink-0 w-[80%] md:w-20 md:hover:w-80 transition-all duration-300 ease-in-out z-40 flex flex-col shadow-2xl`}>
          {/* Header */}
          <div className="w-full p-6 border-b border-white/10 flex justify-start items-center gap-3 h-[89px] flex-shrink-0">
            <div className="w-10 h-10 flex justify-center items-center overflow-hidden flex-shrink-0">
              <img className="flex-1 self-stretch relative object-contain" src="/assets/logo_gsja.png" alt="logo" />
            </div>
            <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden">
                <div className="self-stretch flex flex-col justify-start items-start">
                <div className="h-4 flex items-center text-white text-sm font-bold font-sans leading-4 whitespace-nowrap truncate">SIM GSJA Eben Haezer</div>
              </div>
              <div className="self-stretch flex flex-col justify-start items-start overflow-hidden">
                <div className="h-4 flex items-center mt-1 text-slate-400 text-xs font-medium font-sans leading-4 whitespace-nowrap">Accounting System</div>
              </div>
            </div>
          </div>
          {/* Normal Admin Menus */}
          {userData?.role_name?.toLowerCase() !== 'jemaat' && (
            <nav className="flex-1 w-full overflow-y-auto overflow-x-hidden p-4 pb-20 flex flex-col justify-start items-start gap-2 scrollbar-hide">
              <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="w-full px-4 py-3 rounded-lg flex justify-start items-center gap-4 hover:bg-white/5 cursor-pointer text-inherit no-underline">
                <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                  <span className="material-icons-round text-slate-200 text-[20px]">dashboard</span>
                </div>
                <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                  <div className="justify-center text-slate-200 text-sm font-normal font-sans leading-5 pr-4">Dashboard Utama</div>
                </div>
              </Link>
              
              {[1, 2, 3, 4].includes(userData?.role_id) && (
                <div className="w-full">
                  <div
                    className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer"
                    onMouseEnter={(e) => handleMouseEnterMenu('pengaturan_software', e)}
                    onMouseLeave={handleMouseLeaveMenu}
                    onClick={() => toggleMobileMenu('pengaturan_software')}
                  >
                    <div className="flex justify-start items-center gap-4">
                      <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                        <span className="material-icons-round text-slate-300 text-[20px]">settings</span>
                      </div>
                      <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                        <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5 pr-4">Pengaturan Software</div>
                      </div>
                    </div>
                    <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                      <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                    </div>
                  </div>
                  {/* Mobile Accordion */}
                  <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['pengaturan_software'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                      {(hasPermission('user_access_manage') || hasPermission('akses_sementara_manage')) && <Link href="/settings/akun-akses" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Akun &amp; Hak Akses</Link>}
                      {hasPermission('master_data_manage') && <Link href="/settings/master-data" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Master Data</Link>}
                      {hasPermission('audit_log_view') && <Link href="/settings/audit-log" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Audit Log</Link>}
                      {hasPermission('pengurus_view') && <Link href="/settings/organisasi" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Bagan Organisasi</Link>}
                    </div>
                  </div>
                </div>
              )}

              {(hasPermission('jemaat_view') || hasPermission('pelayan_view') || hasPermission('pengurus_view')) && (
                <div className="w-full">
                  <div 
                    className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer"
                    onMouseEnter={(e) => handleMouseEnterMenu('manajemen_user', e)}
                    onMouseLeave={handleMouseLeaveMenu}
                    onClick={() => toggleMobileMenu('manajemen_user')}
                  >
                    <div className="flex justify-start items-center gap-4">
                      <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                        <span className="material-icons-round text-slate-300 text-[20px]">manage_accounts</span>
                      </div>
                      <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                        <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5 pr-4">Manajemen User</div>
                      </div>
                    </div>
                    <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                      <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                    </div>
                  </div>
                  {/* Mobile Accordion */}
                  <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['manajemen_user'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                      {hasPermission('jemaat_view') && <Link href="/jemaat" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Data Jemaat</Link>}
                      {hasPermission('pelayan_view') && <Link href="/pelayan" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Data Pelayan</Link>}
                      {hasPermission('pengurus_view') && <Link href="/pengurus" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Data Pengurus</Link>}
                    </div>
                  </div>
                </div>
              )}

              {(hasPermission('kegiatan_view') || hasPermission('kegiatan_pastoral_view') || hasPermission('kegiatan_create') || hasPermission('kegiatan_manage') || hasPermission('survei_view') || hasPermission('survei_manage')) && (
              <div className="w-full">
                <div 
                  className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnterMenu('kegiatan', e)}
                  onMouseLeave={handleMouseLeaveMenu}
                  onClick={() => toggleMobileMenu('kegiatan')}
                >
                  <div className="flex justify-start items-center gap-4">
                    <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                      <span className="material-icons-round text-slate-300 text-[20px]">event</span>
                    </div>
                    <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5 pr-4">Kegiatan</div>
                    </div>
                  </div>
                  <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
                {/* Mobile Accordion */}
                <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['kegiatan'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                  <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                    {hasPermission('kegiatan_view') && <Link href="/kegiatan" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Daftar Kegiatan</Link>}
                    {hasPermission('kegiatan_pastoral_view') && <Link href="/kegiatan/pastoral" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Permohonan Pastoral</Link>}
                    {hasPermission('survei_view') && <Link href="/kegiatan/survei" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Survei Kepuasan</Link>}
                  </div>
                </div>
              </div>
              )}

              {(hasPermission('buku_besar_view') || hasPermission('buku_besar_manage') || hasPermission('penggajian_manage')) && (
              <div className="w-full">
                <div 
                  className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnterMenu('buku_besar', e)}
                  onMouseLeave={handleMouseLeaveMenu}
                  onClick={() => toggleMobileMenu('buku_besar')}
                >
                  <div className="flex justify-start items-center gap-4">
                    <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                      <span className="material-icons-round text-slate-300 text-[20px]">menu_book</span>
                    </div>
                    <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5 pr-4">Buku Besar</div>
                    </div>
                  </div>
                  <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
                {/* Mobile Accordion */}
                <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['buku_besar'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                  <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                    {hasPermission('buku_besar_view') && <Link href="/buku-besar/coa" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Akun Perkiraan (COA)</Link>}
                    {hasPermission('buku_besar_manage') && <Link href="/buku-besar/jurnal" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Jurnal Umum</Link>}
                    {hasPermission('penggajian_manage') && <Link href="/buku-besar/gaji" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Pencatatan Gaji</Link>}
                    <Link href="/buku-besar/realisasi-kegiatan" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Realisasi Kegiatan (LPJ)</Link>
                  </div>
                </div>
              </div>
              )}

              {hasPermission('pegawai_view') && (
                <div className="w-full">
                  <div 
                    className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer"
                    onMouseEnter={(e) => handleMouseEnterMenu('pegawai', e)}
                    onMouseLeave={handleMouseLeaveMenu}
                    onClick={() => toggleMobileMenu('pegawai')}
                  >
                    <div className="flex justify-start items-center gap-4">
                      <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                        <span className="material-icons-round text-slate-300 text-[20px]">badge</span>
                      </div>
                      <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                        <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5 pr-4">Pegawai (HRD)</div>
                      </div>
                    </div>
                    <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                      <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                    </div>
                  </div>
                  {/* Mobile Accordion */}
                  <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['pegawai'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                      {hasPermission('pegawai_view') && <Link href="/pegawai" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Data Pegawai</Link>}
                      {hasPermission('pegawai_approval') && <Link href="/pegawai/permohonan" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Permohonan</Link>}
                      {hasPermission('penggajian_manage') && <Link href="/pegawai/penggajian" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Penggajian</Link>}
                    </div>
                  </div>
                </div>
              )}

              {(hasPermission('anggaran_view') || hasPermission('anggaran_create') || hasPermission('anggaran_review')) && (
              <div className="w-full">
                <div 
                  className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnterMenu('anggaran_proposal', e)}
                  onMouseLeave={handleMouseLeaveMenu}
                  onClick={() => toggleMobileMenu('anggaran_proposal')}
                >
                  <div className="flex justify-start items-center gap-4">
                    <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                      <span className="material-icons-round text-slate-300 text-[20px]">request_quote</span>
                    </div>
                    <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5 pr-4">Anggaran & Plotting</div>
                    </div>
                  </div>
                  <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
                <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['anggaran_proposal'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                  <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                    {hasPermission('anggaran_view') && <Link href="/anggaran/konsolidasi" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Rekapitulasi Anggaran</Link>}
                    {(hasPermission('anggaran_view') || hasPermission('anggaran_create')) && <Link href="/anggaran/rancangan" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Rancangan Anggaran</Link>}
                    {(hasPermission('anggaran_create') || hasPermission('anggaran_review')) && <Link href="/anggaran/plotting-tahunan" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Plotting Anggaran Tahunan</Link>}
                  </div>
                </div>
              </div>
              )}

              {/* hasPermission('buku_besar_manage') && (
              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">account_balance_wallet</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5 pr-4">Kas &amp; Bank</div>
                  </div>
                </div>
              </div>
              ) */}

              {/* hasPermission('buku_besar_manage') && (
              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">shopping_cart</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5 pr-4">Pembelian</div>
                  </div>
                </div>
              </div>
              ) */}

              {hasPermission('inventaris_view') && (
              <div
                className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer"
                onMouseEnter={(e) => handleMouseEnterMenu('inventaris', e)}
                onMouseLeave={handleMouseLeaveMenu}
              >
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">inventory_2</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5">Inventaris</div>
                  </div>
                </div>
                <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                  <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                </div>
              </div>
              )}


              {/* hasPermission('buku_besar_view') && (
              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">assessment</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5 pr-4">Laporan</div>
                  </div>
                </div>
              </div>
              ) */}

            </nav>
          )}

          {/* Jemaat Menus */}
          {userData?.role_name?.toLowerCase() === 'jemaat' && (
            <nav className="flex-1 w-full overflow-y-auto overflow-x-hidden p-4 pb-20 flex flex-col justify-start items-start gap-2 scrollbar-hide">
              <Link href="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="w-full block text-inherit no-underline">
                <div className="w-full px-4 py-3 rounded-lg flex justify-start items-center gap-4 hover:bg-white/5 cursor-pointer">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-200 text-[20px]">dashboard</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="justify-center text-slate-200 text-sm font-normal font-sans leading-5 pr-4">Dashboard Jemaat</div>
                  </div>
                </div>
              </Link>

              {/* Kegiatan */}
              <div className="w-full">
                <div 
                  className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnterMenu('kegiatan', e)}
                  onMouseLeave={handleMouseLeaveMenu}
                    onClick={() => toggleMobileMenu('kegiatan')}
                >
                  <div className="flex justify-start items-center gap-4">
                    <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                      <span className="material-icons-round text-slate-300 text-[20px]">event</span>
                    </div>
                    <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5 pr-4">Kegiatan</div>
                    </div>
                  </div>
                  <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
                  {/* Mobile Accordion */}
                  <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['kegiatan'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                      <Link href="/kegiatan" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Daftar Kegiatan</Link>
                    </div>
                  </div>
              </div>

              {/* Profil Saya */}
              <div className="w-full">
                <div 
                  className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer"
                  onMouseEnter={(e) => handleMouseEnterMenu('profil_saya', e)}
                  onMouseLeave={handleMouseLeaveMenu}
                    onClick={() => toggleMobileMenu('profil_saya')}
                >
                  <div className="flex justify-start items-center gap-4">
                    <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                      <span className="material-icons-round text-slate-300 text-[20px]">person</span>
                    </div>
                    <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-sans leading-5 pr-4">Profil Saya</div>
                    </div>
                  </div>
                  <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
                  {/* Mobile Accordion */}
                  <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['profil_saya'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                      <Link href="/profil" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Data Diri & Profil</Link>
                    </div>
                  </div>
              </div>
            </nav>
          )}

          {/* Bottom Actions */}
          <div className="w-full p-4 border-t border-white/10 mt-auto flex-shrink-0 flex flex-col gap-1">
            <button onClick={() => { setIsMobileMenuOpen(false); setIsAkunSayaModalOpen(true); }} className="w-full px-4 py-3 rounded-lg flex justify-start items-center gap-4 hover:bg-white/5 cursor-pointer outline-none text-inherit no-underline">
              <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                <span className="material-icons-round text-white text-[20px]">manage_accounts</span>
              </div>
              <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                <div className="h-5 justify-center text-white text-sm font-normal font-sans leading-5 pr-4">Akun Saya</div>
              </div>
            </button>
            <button onClick={() => { setIsMobileMenuOpen(false); handleSwitchRole(); }} className="w-full px-4 py-3 rounded-lg flex justify-start items-center gap-4 hover:bg-white/5 cursor-pointer outline-none">
              <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                <span className="material-icons-round text-white text-[20px]">swap_horiz</span>
              </div>
              <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                <div className="h-5 justify-center text-white text-sm font-normal font-sans leading-5 pr-4">Ganti Peran (Role)</div>
              </div>
            </button>
            <button onClick={handleLogout} className="w-full px-4 py-3 rounded-lg flex justify-start items-center gap-4 hover:bg-white/5 cursor-pointer outline-none">
              <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                <span className="material-icons-round text-white text-[20px]">logout</span>
              </div>
              <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                <div className="h-5 justify-center text-white text-sm font-normal font-sans leading-5 pr-4">Keluar</div>
              </div>
            </button>
          </div>

          {/* React Portaled Submenus (Always Relative to Sidebar Top) */}
          <div className="hidden md:block absolute top-0 left-full w-0 h-0 z-[100]">
            {activeSubmenu === 'inventaris' && (
              <div
                className="absolute pl-2 animate-in fade-in zoom-in-95 duration-200"
                style={{ top: submenuTop }}
                onMouseEnter={() => { if (submenuTimeout.current) clearTimeout(submenuTimeout.current) }}
                onMouseLeave={handleMouseLeaveMenu}
              >
                <div className="w-[620px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl flex flex-col justify-start items-start gap-4">
                  <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                    <div className="justify-center text-slate-800 text-lg font-bold font-sans leading-7">Inventaris</div>
                  </div>
                  <div className="self-stretch flex flex-wrap justify-start items-start gap-4">
                    {/* Daftar Barang — sudah live */}
                    {hasPermission('inventaris_view') && (
                      <Link href="/inventaris" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-slate-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-slate-200 flex flex-col justify-center items-center cursor-pointer hover:bg-slate-100 transition-colors text-inherit no-underline min-w-[160px]">
                        <div className="pb-2 flex flex-col justify-start items-center">
                          <span className="material-icons-round text-slate-600 text-[32px]">inventory_2</span>
                        </div>
                        <div className="text-center text-slate-900 text-sm font-bold font-sans leading-5">Daftar Barang</div>
                      </Link>
                    )}
                    {/* Stok Opname — sudah live */}
                    {hasPermission('inventaris_view') && (
                      <Link href="/inventaris/stok-opname" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-blue-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-blue-200 flex flex-col justify-center items-center cursor-pointer hover:bg-blue-100 transition-colors text-inherit no-underline min-w-[160px]">
                        <div className="pb-2 flex flex-col justify-start items-center">
                          <span className="material-icons-round text-blue-600 text-[32px]">assignment_turned_in</span>
                        </div>
                        <div className="text-center text-blue-900 text-sm font-bold font-sans leading-5">Stok Opname</div>
                      </Link>
                    )}
                    {/* Mutasi Barang — placeholder */}
                    {hasPermission('inventaris_view') && (
                      <Link href="/inventaris/mutasi" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-amber-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-amber-200 flex flex-col justify-center items-center cursor-pointer hover:bg-amber-100 transition-colors text-inherit no-underline min-w-[160px]">
                        <div className="pb-2 flex flex-col justify-start items-center">
                          <span className="material-icons-round text-amber-600 text-[32px]">swap_horiz</span>
                        </div>
                        <div className="text-center text-amber-900 text-sm font-bold font-sans leading-5">Mutasi Barang</div>
                      </Link>
                    )}
                    {/* Peminjaman — placeholder */}
                    {hasPermission('inventaris_view') && (
                      <Link href="/inventaris/peminjaman" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-purple-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-purple-200 flex flex-col justify-center items-center cursor-pointer hover:bg-purple-100 transition-colors text-inherit no-underline min-w-[160px]">
                        <div className="pb-2 flex flex-col justify-start items-center">
                          <span className="material-icons-round text-purple-600 text-[32px]">assignment_return</span>
                        </div>
                        <div className="text-center text-purple-900 text-sm font-bold font-sans leading-5">Peminjaman</div>
                      </Link>
                    )}
                    {/* Dispose — placeholder */}
                    {hasPermission('inventaris_view') && (
                      <Link href="/inventaris/dispose" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-red-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-red-200 flex flex-col justify-center items-center cursor-pointer hover:bg-red-100 transition-colors text-inherit no-underline min-w-[160px]">
                        <div className="pb-2 flex flex-col justify-start items-center">
                          <span className="material-icons-round text-red-600 text-[32px]">delete_sweep</span>
                        </div>
                        <div className="text-center text-red-900 text-sm font-bold font-sans leading-5">Dispose Barang</div>
                      </Link>
                    )}
                    {/* Master Data — placeholder */}
                    {hasPermission('inventaris_view') && (
                      <Link href="/inventaris/master-data" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-emerald-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-emerald-200 flex flex-col justify-center items-center cursor-pointer hover:bg-emerald-100 transition-colors text-inherit no-underline min-w-[160px]">
                        <div className="pb-2 flex flex-col justify-start items-center">
                          <span className="material-icons-round text-emerald-600 text-[32px]">category</span>
                        </div>
                        <div className="text-center text-emerald-900 text-sm font-bold font-sans leading-5">Master Data</div>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSubmenu === 'pengaturan_software' && (
              <div
                className="absolute pl-2 animate-in fade-in zoom-in-95 duration-200"
                style={{ top: submenuTop }}
                onMouseEnter={() => { if (submenuTimeout.current) clearTimeout(submenuTimeout.current) }}
                onMouseLeave={handleMouseLeaveMenu}
              >
                <div className="w-[500px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl flex flex-col justify-start items-start gap-4">
                  <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                    <div className="justify-center text-slate-800 text-lg font-bold font-sans leading-7">Pengaturan Software</div>
                  </div>
                  <div className="self-stretch flex flex-wrap justify-start items-start gap-4">
                    {(hasPermission('user_access_manage') || hasPermission('akses_sementara_manage')) && (
                      <Link href="/settings/akun-akses" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-purple-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-purple-200 flex flex-col justify-center items-center cursor-pointer hover:bg-purple-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-purple-600 text-[32px]">admin_panel_settings</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-purple-900 text-sm font-bold font-sans leading-5">Akun &amp; Hak Akses</div>
                        </div>
                      </Link>
                    )}
                    {hasPermission('master_data_manage') && (
                      <Link href="/settings/master-data" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-emerald-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-emerald-200 flex flex-col justify-center items-center cursor-pointer hover:bg-emerald-100 transition-colors text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-emerald-600 text-[32px]">dataset</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-emerald-900 text-sm font-bold font-sans leading-5">Master Data</div>
                        </div>
                      </Link>
                    )}
                    {hasPermission('audit_log_view') && (
                      <Link href="/settings/audit-log" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-amber-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-amber-200 flex flex-col justify-center items-center cursor-pointer hover:bg-amber-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-amber-600 text-[32px]">history_edu</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-amber-900 text-sm font-bold font-sans leading-5">Audit Log</div>
                        </div>
                      </Link>
                    )}
                    {hasPermission('pengurus_view') && (
                      <Link href="/settings/organisasi" onClick={() => setActiveSubmenu(null)} className="w-full h-32 p-4 bg-sky-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-sky-200 flex flex-col justify-center items-center cursor-pointer hover:bg-sky-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-sky-600 text-[32px]">account_tree</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-sky-900 text-sm font-bold font-sans leading-5">Bagan Organisasi</div>
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSubmenu === 'manajemen_user' && (
              <div 
                className="absolute pl-2 animate-in fade-in zoom-in-95 duration-200"
                style={{ top: submenuTop }}
                onMouseEnter={() => { if (submenuTimeout.current) clearTimeout(submenuTimeout.current) }}
                onMouseLeave={handleMouseLeaveMenu}
              >
                <div className="w-[500px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl flex flex-col justify-start items-start gap-4">
                  <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                    <div className="justify-center text-slate-800 text-lg font-bold font-sans leading-7">Manajemen User</div>
                  </div>
                  <div className="self-stretch flex justify-between items-start gap-4">
                    {hasPermission('jemaat_view') && (
                      <Link href="/jemaat" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-pink-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-pink-200 flex flex-col justify-center items-center cursor-pointer hover:bg-pink-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-pink-600 text-[32px]">group</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-pink-900 text-sm font-bold font-sans leading-5">Data Jemaat</div>
                        </div>
                      </Link>
                    )}
                    {hasPermission('pelayan_view') && (
                      <Link href="/pelayan" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-violet-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-violet-200 flex flex-col justify-center items-center cursor-pointer hover:bg-violet-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-violet-600 text-[32px]">volunteer_activism</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-violet-900 text-sm font-bold font-sans leading-5">Data Pelayan</div>
                        </div>
                      </Link>
                    )}
                    {hasPermission('pengurus_view') && (
                      <Link href="/pengurus" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-pink-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-pink-200 flex flex-col justify-center items-center cursor-pointer hover:bg-pink-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-pink-600 text-[32px]">admin_panel_settings</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-pink-900 text-sm font-bold font-sans leading-5">Data Pengurus</div>
                        </div>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSubmenu === 'pegawai' && (
              <div 
                className="absolute pl-2 animate-in fade-in zoom-in-95 duration-200"
                style={{ top: submenuTop }}
                onMouseEnter={() => { if (submenuTimeout.current) clearTimeout(submenuTimeout.current) }}
                onMouseLeave={handleMouseLeaveMenu}
              >
                <div className="w-[500px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl flex flex-col justify-start items-start gap-4">
                  <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                    <div className="justify-center text-slate-800 text-lg font-bold font-sans leading-7">Pegawai (HRD)</div>
                  </div>
                  <div className="self-stretch flex justify-between items-start gap-4">
                    {hasPermission('pegawai_view') && (
                    <Link href="/pegawai" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-teal-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-teal-200 flex flex-col justify-center items-center cursor-pointer hover:bg-teal-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-start">
                        <div className="flex flex-col justify-start items-center">
                          <span className="material-icons-round text-teal-600 text-[32px]">badge</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-start items-center">
                        <div className="text-center justify-center text-teal-900 text-sm font-bold font-sans leading-5">Data<br/>Pegawai</div>
                      </div>
                    </Link>
                    )}
                    {hasPermission('pegawai_approval') && (
                    <Link href="/pegawai/permohonan" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-orange-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-orange-200 flex flex-col justify-center items-center cursor-pointer hover:bg-orange-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-start">
                        <div className="flex flex-col justify-start items-center">
                          <span className="material-icons-round text-orange-600 text-[32px]">assignment_turned_in</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-start items-center">
                        <div className="text-center justify-center text-orange-900 text-sm font-bold font-sans leading-5">Permohonan<br/>& Approval</div>
                      </div>
                    </Link>
                    )}
                    {hasPermission('penggajian_manage') && (
                    <Link href="/pegawai/penggajian" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-cyan-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-cyan-200 flex flex-col justify-center items-center cursor-pointer hover:bg-cyan-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-start">
                        <div className="flex flex-col justify-start items-center">
                          <span className="material-icons-round text-cyan-600 text-[32px]">account_balance_wallet</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-start items-center">
                        <div className="text-center justify-center text-cyan-900 text-sm font-bold font-sans leading-5">Sistem<br/>Penggajian</div>
                      </div>
                    </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSubmenu === 'kegiatan' && (
              <div 
                className="absolute pl-2 animate-in fade-in zoom-in-95 duration-200"
                style={{ top: submenuTop }}
                onMouseEnter={() => { if (submenuTimeout.current) clearTimeout(submenuTimeout.current) }}
                onMouseLeave={handleMouseLeaveMenu}
              >
                <div className="w-[500px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl flex flex-col justify-start items-start gap-4">
                  <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                    <div className="justify-center text-slate-800 text-lg font-bold font-sans leading-7">Modul Kegiatan</div>
                  </div>
                  <div className="self-stretch flex justify-between items-start gap-4">
                    {/* Item 1 */}
                    {hasPermission('kegiatan_view') && (
                    <Link href="/kegiatan" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-blue-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-blue-200 flex flex-col justify-center items-center cursor-pointer hover:bg-blue-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-center">
                        <span className="material-icons-round text-blue-600 text-[32px]">calendar_month</span>
                      </div>
                      <div className="text-center justify-center text-blue-900 text-sm font-bold font-sans leading-5">Daftar Kegiatan</div>
                    </Link>
                    )}

                    {/* Item 2 */}
                    {hasPermission('kegiatan_pastoral_view') && (
                    <Link href="/kegiatan/pastoral" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-rose-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-rose-200 flex flex-col justify-center items-center cursor-pointer hover:bg-rose-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-center">
                        <span className="material-icons-round text-rose-600 text-[32px]">volunteer_activism</span>
                      </div>
                      <div className="text-center justify-center text-rose-900 text-sm font-bold font-sans leading-5">Permohonan<br/>Pastoral</div>
                    </Link>
                    )}

                    {/* Item 3 */}
                    {hasPermission('survei_view') && (
                    <Link href="/kegiatan/survei" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-amber-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-amber-200 flex flex-col justify-center items-center cursor-pointer hover:bg-amber-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-center">
                        <span className="material-icons-round text-amber-600 text-[32px]">poll</span>
                      </div>
                      <div className="text-center justify-center text-amber-900 text-sm font-bold font-sans leading-5">Survei<br/>Kepuasan</div>
                    </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSubmenu === 'buku_besar' && (
              <div
                className="absolute pl-2 animate-in fade-in zoom-in-95 duration-200"
                style={{ top: submenuTop }}
                onMouseEnter={() => { if (submenuTimeout.current) clearTimeout(submenuTimeout.current) }}
                onMouseLeave={handleMouseLeaveMenu}
              >
                <div className="w-[500px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl flex flex-col justify-start items-start gap-4">
                  <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                    <div className="justify-center text-slate-800 text-lg font-bold font-sans leading-7">Buku Besar</div>
                  </div>
                  {/* Row 1: 3 cards */}
                  <div className="self-stretch flex justify-between items-start gap-4">
                    {hasPermission('buku_besar_view') && (
                      <Link href="/buku-besar/coa" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-indigo-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-indigo-200 flex flex-col justify-center items-center cursor-pointer hover:bg-indigo-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-center">
                          <span className="material-icons-round text-indigo-600 text-[32px]">account_tree</span>
                        </div>
                        <div className="text-center text-indigo-900 text-sm font-bold font-sans leading-5">Akun Perkiraan<br/>(COA)</div>
                      </Link>
                    )}
                    {hasPermission('buku_besar_manage') && (
                      <Link href="/buku-besar/jurnal" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-emerald-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-emerald-200 flex flex-col justify-center items-center cursor-pointer hover:bg-emerald-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-center">
                          <span className="material-icons-round text-emerald-600 text-[32px]">receipt_long</span>
                        </div>
                        <div className="text-center text-emerald-900 text-sm font-bold font-sans leading-5">Jurnal<br/>Umum</div>
                      </Link>
                    )}
                    {hasPermission('penggajian_manage') && (
                      <Link href="/buku-besar/gaji" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-amber-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-amber-200 flex flex-col justify-center items-center cursor-pointer hover:bg-amber-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-center">
                          <span className="material-icons-round text-amber-600 text-[32px]">payments</span>
                        </div>
                        <div className="text-center text-amber-900 text-sm font-bold font-sans leading-5">Pencatatan<br/>Gaji</div>
                      </Link>
                    )}
                  </div>
                  {/* Row 2: 1 full-width card */}
                  <div className="self-stretch">
                    <Link href="/buku-besar/realisasi-kegiatan" onClick={() => setActiveSubmenu(null)} className="w-full h-32 p-4 bg-rose-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-rose-200 flex flex-col justify-center items-center cursor-pointer hover:bg-rose-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-center">
                        <span className="material-icons-round text-rose-600 text-[32px]">bar_chart</span>
                      </div>
                      <div className="text-center text-rose-900 text-sm font-bold font-sans leading-5">Realisasi Kegiatan (LPJ)</div>
                    </Link>
                  </div>
                </div>
              </div>
            )}



            {activeSubmenu === 'profil_saya' && (
              <div 
                className="absolute pl-2 animate-in fade-in zoom-in-95 duration-200"
                style={{ top: submenuTop }}
                onMouseEnter={() => { if (submenuTimeout.current) clearTimeout(submenuTimeout.current) }}
                onMouseLeave={handleMouseLeaveMenu}
              >
                <div className="w-[330px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl flex flex-col justify-start items-start gap-4">
                  <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                    <div className="justify-center text-slate-800 text-lg font-bold font-sans leading-7">Profil Saya</div>
                  </div>
                  <div className="self-stretch flex justify-between items-start gap-4">
                    <Link href="/profil" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-teal-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-teal-200 flex flex-col justify-center items-center cursor-pointer hover:bg-teal-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-start">
                        <div className="flex flex-col justify-start items-center">
                          <span className="material-icons-round text-teal-600 text-[32px]">badge</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-start items-center text-center">
                        <div className="justify-center text-teal-900 text-sm font-bold font-sans leading-5">Data Diri</div>
                      </div>
                    </Link>
                    <Link href="/profil" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-teal-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-teal-200 flex flex-col justify-center items-center cursor-pointer hover:bg-teal-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-start">
                        <div className="flex flex-col justify-start items-center">
                          <span className="material-icons-round text-teal-600 text-[32px]">family_restroom</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-start items-center text-center">
                        <div className="justify-center text-teal-900 text-sm font-bold font-sans leading-5">Silsilah Keluarga</div>
                      </div>
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {activeSubmenu === 'anggaran_proposal' && (
              <div 
                className="absolute pl-2 animate-in fade-in zoom-in-95 duration-200"
                style={{ top: submenuTop }}
                onMouseEnter={() => { if (submenuTimeout.current) clearTimeout(submenuTimeout.current) }}
                onMouseLeave={handleMouseLeaveMenu}
              >
                <div className="w-[500px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl flex flex-col justify-start items-start gap-4">
                  <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                    <div className="justify-center text-slate-800 text-lg font-bold font-sans leading-7 flex items-center gap-2">
                      <span className="material-icons-round text-[20px] text-purple-600">request_quote</span>
                      Anggaran & Plotting
                    </div>
                  </div>
                  <div className="self-stretch flex justify-between items-start gap-4">
                    {hasPermission('anggaran_view') && (
                    <Link href="/anggaran/konsolidasi" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-emerald-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-emerald-200 flex flex-col justify-center items-center cursor-pointer hover:bg-emerald-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-start">
                        <div className="flex flex-col justify-start items-center">
                          <span className="material-icons-round text-emerald-600 text-[32px]">pie_chart</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-start items-center text-center">
                        <div className="justify-center text-emerald-900 text-sm font-bold font-sans leading-5">Rekapitulasi<br/>Anggaran</div>
                      </div>
                    </Link>
                    )}
                    {(hasPermission('anggaran_view') || hasPermission('anggaran_create')) && (
                    <Link href="/anggaran/rancangan" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-fuchsia-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-fuchsia-200 flex flex-col justify-center items-center cursor-pointer hover:bg-fuchsia-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-start">
                        <div className="flex flex-col justify-start items-center">
                          <span className="material-icons-round text-fuchsia-600 text-[32px]">event_note</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-start items-center text-center">
                        <div className="justify-center text-fuchsia-900 text-sm font-bold font-sans leading-5">Rancangan<br/>Anggaran</div>
                      </div>
                    </Link>
                    )}
                    {(hasPermission('anggaran_create') || hasPermission('anggaran_review')) && (
                    <Link href="/anggaran/plotting-tahunan" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-violet-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-violet-200 flex flex-col justify-center items-center cursor-pointer hover:bg-violet-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-start">
                        <div className="flex flex-col justify-start items-center">
                          <span className="material-icons-round text-violet-600 text-[32px]">request_quote</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-start items-center text-center">
                        <div className="justify-center text-violet-900 text-sm font-bold font-sans leading-5">Plotting<br/>Tahunan</div>
                      </div>
                    </Link>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 self-stretch relative overflow-hidden flex flex-col bg-neutral-100">
          {/* Topbar */}
          <div className="w-full h-16 px-4 md:px-8 bg-white border-b border-slate-200 inline-flex justify-between items-center flex-shrink-0 z-50 relative box-border">
            <div className="flex justify-start items-center gap-4 md:gap-6">
              <button 
                className="md:hidden p-2 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center outline-none -ml-2"
                onClick={() => setIsMobileMenuOpen(true)}
              >
                <span className="material-icons-round text-2xl">menu</span>
              </button>
              <div className="flex justify-start items-center gap-2">
                <div className="inline-flex flex-col justify-center items-center pr-2">
                   <span className="material-icons-round text-slate-700 text-[28px]">{topbarIcon}</span>
                </div>
                <div className="inline-flex flex-col justify-start items-start">
                  <div className="h-7 items-center flex text-slate-700 text-xl font-bold font-sans leading-7 whitespace-nowrap">{topbarTitle}</div>
                </div>
              </div>
            </div>
            <div className="flex justify-start items-center gap-4">
              <div ref={profileDropdownRef} className="flex justify-start items-center gap-3 cursor-pointer p-1 rounded-lg hover:bg-gray-50 transition-colors relative" onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}>
                <div className="inline-flex flex-col justify-start items-start">
                  <div className="self-stretch flex flex-col justify-start items-end">
                    <div className="hidden sm:block w-28 h-5 text-right justify-center text-slate-900 text-sm font-semibold font-sans leading-5 truncate">
                      {userData ? userData.email : 'Loading...'}
                    </div>
                  </div>
                  <div className="self-stretch flex flex-col justify-start items-end">
                    <div className="hidden sm:block w-32 h-4 text-right justify-center text-slate-500 text-xs font-normal font-sans leading-4 truncate">
                       {userData ? `${userData.role_name} - ${userData.satelit_name}`  : 'Role placeholder'}
                    </div>
                  </div>
                </div>
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center border-2 border-slate-400 overflow-hidden shrink-0">
                   {userData?.foto_url ? (
                     <img src={userData.foto_url} alt="profil" className="w-full h-full object-cover" />
                   ) : (
                     <span className="material-icons-round text-slate-400 text-2xl">person</span>
                   )}
                </div>

                {/* Dropdown Menu for Switching Role */}
                {isProfileDropdownOpen && (
                  <div className="absolute top-full right-0 pt-2 z-[9999]">
                    <div className="w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-2 animate-in fade-in slide-in-from-top-2">
                      <button 
                        type="button"
                        onClick={() => { setIsProfileDropdownOpen(false); setIsAkunSayaModalOpen(true); }} 
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 cursor-pointer"
                      >
                          <span className="material-icons-round text-[18px] text-slate-400">manage_accounts</span>
                          Akun Saya
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setIsProfileDropdownOpen(false); handleSwitchRole(); }} 
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 border-t border-slate-100 mt-1 pt-2 cursor-pointer"
                      >
                          <span className="material-icons-round text-[18px] text-slate-400">swap_horiz</span>
                          Ganti Peran (Role)
                      </button>
                      <button 
                        type="button"
                        onClick={() => { setIsProfileDropdownOpen(false); handleLogout(); }} 
                        className="w-full text-left px-4 py-2 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-3 text-sm text-red-500 border-t border-slate-100 mt-1 pt-2 cursor-pointer"
                      >
                          <span className="material-icons-round text-[18px]">logout</span>
                          Keluar Akun
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Outlet */}
          <div className="flex-1 w-full bg-neutral-100 p-4 md:p-8 overflow-y-auto overflow-x-hidden relative">
             {children}
          </div>
        </div>
      </div>
      
      <AkunSayaModal 
        isOpen={isAkunSayaModalOpen} 
        onClose={() => setIsAkunSayaModalOpen(false)} 
        userData={userData} 
        setUserData={setUserData} 
      />
    </div>
  );
}
