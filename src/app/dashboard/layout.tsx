'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLoader } from '@/components/ui/GlobalLoader';
import JemaatPwaLayout from '@/components/layouts/JemaatPwaLayout';

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
    // Fetch currently active user from JWT
    const fetchUser = async () => {
      showLoader();
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          setUserData(data);
        } else {
          router.push('/login');
        }
      } catch (err) {
        console.error('Failed to fetch user', err);
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
      sessionStorage.setItem('temp_auth_data', JSON.stringify({
        user_id: userData.user_id,
        available_roles: userData.available_roles || []
      }));
      router.push('/select-role');
    }
  };

  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  let topbarTitle = 'Dashboard Utama';
  let topbarIcon  = 'dashboard';

  if (
    pathname.includes('/dashboard/members') ||
    pathname.includes('/dashboard/pelayan') ||
    pathname.includes('/dashboard/pengurus')
  ) {
    topbarTitle = 'Manajemen User';
    topbarIcon  = 'manage_accounts';
  } else if (pathname.includes('/dashboard/settings')) {
    topbarTitle = 'Pengaturan Software';
    topbarIcon  = 'settings';
  } else if (pathname.includes('/dashboard/kegiatan')) {
    topbarTitle = 'Modul Kegiatan';
    topbarIcon  = 'event';
  } else if (pathname.includes('/dashboard/family-tree')) {
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

  // Selama data pengguna belum termuat, tampilkan layar kosong blank
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
                <div className="h-4 flex items-center text-white text-sm font-bold font-['Inter'] leading-4 whitespace-nowrap truncate">SIA GSJA Eben Haezer</div>
              </div>
              <div className="self-stretch flex flex-col justify-start items-start overflow-hidden">
                <div className="h-4 flex items-center mt-1 text-slate-400 text-xs font-medium font-['Inter'] leading-4 whitespace-nowrap">Accounting System</div>
              </div>
            </div>
          </div>
          {/* Normal Admin Menus */}
          {userData?.role_name?.toLowerCase() !== 'jemaat' && (
            <nav className="flex-1 w-full overflow-y-auto overflow-x-hidden p-4 pb-20 flex flex-col justify-start items-start gap-2 scrollbar-hide">
              <div className="w-full px-4 py-3 rounded-lg flex justify-start items-center gap-4 hover:bg-white/5 cursor-pointer">
                <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                  <span className="material-icons-round text-slate-200 text-[20px]">dashboard</span>
                </div>
                <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                  <div className="justify-center text-slate-200 text-sm font-normal font-['Inter'] leading-5 pr-4">Dashboard Utama</div>
                </div>
              </div>
              
              {(hasPermission('master_data_manage') || hasPermission('user_access_manage') || hasPermission('akses_sementara_manage') || hasPermission('audit_log_view') || userData?.is_super_admin) && (
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
                        <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Pengaturan Software</div>
                      </div>
                    </div>
                    <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                      <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                    </div>
                  </div>
                  {/* Mobile Accordion */}
                  <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['pengaturan_software'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                      {(hasPermission('user_access_manage') || hasPermission('akses_sementara_manage')) && <Link href="/dashboard/settings/akun-akses" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Akun &amp; Hak Akses</Link>}
                      {hasPermission('master_data_manage') && <Link href="/dashboard/settings/master-data" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Master Data</Link>}
                      {hasPermission('audit_log_view') && <Link href="/dashboard/settings/audit-log" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Audit Log</Link>}
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
                        <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Manajemen User</div>
                      </div>
                    </div>
                    <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                      <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                    </div>
                  </div>
                  {/* Mobile Accordion */}
                  <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['manajemen_user'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                      {hasPermission('jemaat_view') && <Link href="/dashboard/members" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Data Jemaat</Link>}
                      {hasPermission('pelayan_view') && <Link href="/dashboard/pelayan" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Data Pelayan</Link>}
                      {hasPermission('pengurus_view') && <Link href="/dashboard/pengurus" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Data Pengurus</Link>}
                    </div>
                  </div>
                </div>
              )}

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
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Kegiatan</div>
                    </div>
                  </div>
                  <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
                {/* Mobile Accordion */}
                <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['kegiatan'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                  <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                    <Link href="/dashboard/kegiatan" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Daftar Kegiatan</Link>
                    <Link href="/dashboard/kegiatan/pendaftaran" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Pendaftaran Peserta</Link>
                    <Link href="/dashboard/kegiatan/absensi" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Absensi & Kehadiran</Link>
                    <Link href="/dashboard/kegiatan/lpj" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">LPJ Kegiatan</Link>
                    <Link href="/dashboard/kegiatan/pemilu" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Pemilihan Umum</Link>
                  </div>
                </div>
              </div>

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">menu_book</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Buku Besar</div>
                  </div>
                </div>
              </div>

              {hasPermission('pelayan_view') && (
                <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                  <div className="flex justify-start items-center gap-4">
                    <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                      <span className="material-icons-round text-slate-300 text-[20px]">badge</span>
                    </div>
                    <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Pegawai</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">request_quote</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Anggaran & Proposal</div>
                  </div>
                </div>
              </div>

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">account_balance_wallet</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Kas &amp; Bank</div>
                  </div>
                </div>
              </div>

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">shopping_cart</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Pembelian</div>
                  </div>
                </div>
              </div>

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">inventory_2</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Perlengkapan / Aset Tetap</div>
                  </div>
                </div>
              </div>

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">assessment</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Laporan</div>
                  </div>
                </div>
              </div>

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
                    <div className="justify-center text-slate-200 text-sm font-normal font-['Inter'] leading-5 pr-4">Dashboard Jemaat</div>
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
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Kegiatan</div>
                    </div>
                  </div>
                  <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
                  {/* Mobile Accordion */}
                  <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['kegiatan'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                      <Link href="/dashboard/kegiatan" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Daftar Kegiatan</Link>
                      <Link href="/dashboard/kegiatan/pendaftaran" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Pendaftaran Peserta</Link>
                      <Link href="/dashboard/kegiatan/absensi" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Absensi & Kehadiran</Link>
                      <Link href="/dashboard/kegiatan/lpj" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">LPJ Kegiatan</Link>
                      <Link href="/dashboard/kegiatan/pemilu" onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Pemilihan Umum</Link>
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
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Profil Saya</div>
                    </div>
                  </div>
                  <div className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300">
                    <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
                  {/* Mobile Accordion */}
                  <div className={`md:hidden overflow-hidden transition-all duration-300 ${mobileExpandedMenus['profil_saya'] ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <div className="pl-14 pr-4 py-2 flex flex-col gap-4">
                      <Link href={`/dashboard/members/${userData?.jemaat_id || 'not-found'}?mode=view`} onClick={() => setIsMobileMenuOpen(false)} className="text-slate-300 text-sm font-medium hover:text-white transition-colors block">Data Diri</Link>
                      <span className="text-slate-300 text-sm font-medium hover:text-white transition-colors cursor-pointer block">Family Tree</span>
                    </div>
                  </div>
              </div>
            </nav>
          )}

          {/* Logout button at bottom */}
          <div className="w-full p-4 border-t border-white/10 mt-auto flex-shrink-0">
            <button onClick={handleLogout} className="w-full px-4 py-3 rounded-lg flex justify-start items-center gap-4 hover:bg-white/5 cursor-pointer outline-none">
              <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                <span className="material-icons-round text-white text-[20px]">logout</span>
              </div>
              <div className="flex flex-col justify-start items-start opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-300 w-auto md:w-0 md:group-hover:w-auto overflow-hidden whitespace-nowrap">
                <div className="h-5 justify-center text-white text-sm font-normal font-['Inter'] leading-5 pr-4">Keluar</div>
              </div>
            </button>
          </div>

          {/* React Portaled Submenus (Always Relative to Sidebar Top) */}
          <div className="hidden md:block absolute top-0 left-full w-0 h-0 z-[100]">
            {activeSubmenu === 'pengaturan_software' && (
              <div
                className="absolute pl-2 animate-in fade-in zoom-in-95 duration-200"
                style={{ top: submenuTop }}
                onMouseEnter={() => { if (submenuTimeout.current) clearTimeout(submenuTimeout.current) }}
                onMouseLeave={handleMouseLeaveMenu}
              >
                <div className="w-[500px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl flex flex-col justify-start items-start gap-4">
                  <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                    <div className="justify-center text-slate-800 text-lg font-bold font-['Inter'] leading-7">Pengaturan Software</div>
                  </div>
                  <div className="self-stretch flex flex-wrap justify-start items-start gap-4">
                    {(hasPermission('user_access_manage') || hasPermission('akses_sementara_manage')) && (
                      <Link href="/dashboard/settings/akun-akses" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-purple-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-purple-200 flex flex-col justify-center items-center cursor-pointer hover:bg-purple-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-purple-600 text-[32px]">admin_panel_settings</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-purple-900 text-sm font-bold font-['Inter'] leading-5">Akun &amp; Hak Akses</div>
                        </div>
                      </Link>
                    )}
                    {hasPermission('master_data_manage') && (
                      <Link href="/dashboard/settings/master-data" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-emerald-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-emerald-200 flex flex-col justify-center items-center cursor-pointer hover:bg-emerald-100 transition-colors text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-emerald-600 text-[32px]">dataset</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-emerald-900 text-sm font-bold font-['Inter'] leading-5">Master Data</div>
                        </div>
                      </Link>
                    )}
                    {hasPermission('audit_log_view') && (
                      <Link href="/dashboard/settings/audit-log" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-amber-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-amber-200 flex flex-col justify-center items-center cursor-pointer hover:bg-amber-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-amber-600 text-[32px]">history_edu</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-amber-900 text-sm font-bold font-['Inter'] leading-5">Audit Log</div>
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
                    <div className="justify-center text-slate-800 text-lg font-bold font-['Inter'] leading-7">Manajemen User</div>
                  </div>
                  <div className="self-stretch flex justify-between items-start gap-4">
                    {hasPermission('jemaat_view') && (
                      <Link href="/dashboard/members" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-pink-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-pink-200 flex flex-col justify-center items-center cursor-pointer hover:bg-pink-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-pink-600 text-[32px]">group</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-pink-900 text-sm font-bold font-['Inter'] leading-5">Data Jemaat</div>
                        </div>
                      </Link>
                    )}
                    {hasPermission('pelayan_view') && (
                      <Link href="/dashboard/pelayan" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-violet-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-violet-200 flex flex-col justify-center items-center cursor-pointer hover:bg-violet-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-violet-600 text-[32px]">volunteer_activism</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-violet-900 text-sm font-bold font-['Inter'] leading-5">Data Pelayan</div>
                        </div>
                      </Link>
                    )}
                    {hasPermission('pengurus_view') && (
                      <Link href="/dashboard/pengurus" onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-pink-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-pink-200 flex flex-col justify-center items-center cursor-pointer hover:bg-pink-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-pink-600 text-[32px]">admin_panel_settings</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center">
                          <div className="text-center justify-center text-pink-900 text-sm font-bold font-['Inter'] leading-5">Data Pengurus</div>
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
                <div className="w-[600px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl flex flex-col justify-start items-start gap-4">
                  <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                    <div className="justify-center text-slate-800 text-lg font-bold font-['Inter'] leading-7">Modul Kegiatan</div>
                  </div>
                  <div className="self-stretch grid grid-cols-6 gap-4">
                    {/* Item 1 */}
                    <Link href="/dashboard/kegiatan" onClick={() => setActiveSubmenu(null)} className="col-span-2 h-32 p-4 bg-blue-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-blue-200 flex flex-col justify-center items-center cursor-pointer hover:bg-blue-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-center">
                        <span className="material-icons-round text-blue-600 text-[32px]">calendar_month</span>
                      </div>
                      <div className="text-center justify-center text-blue-900 text-sm font-bold font-['Inter'] leading-5">Daftar Kegiatan</div>
                    </Link>

                    {/* Item 2 */}
                    <Link href="/dashboard/kegiatan/pendaftaran" onClick={() => setActiveSubmenu(null)} className="col-span-2 h-32 p-4 bg-sky-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-sky-200 flex flex-col justify-center items-center cursor-pointer hover:bg-sky-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-center">
                        <span className="material-icons-round text-sky-600 text-[32px]">how_to_reg</span>
                      </div>
                      <div className="text-center justify-center text-sky-900 text-sm font-bold font-['Inter'] leading-5">Pendaftaran Peserta</div>
                    </Link>

                    {/* Item 3 */}
                    <Link href="/dashboard/kegiatan/absensi" onClick={() => setActiveSubmenu(null)} className="col-span-2 h-32 p-4 bg-indigo-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-indigo-200 flex flex-col justify-center items-center cursor-pointer hover:bg-indigo-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-center">
                        <span className="material-icons-round text-indigo-600 text-[32px]">playlist_add_check</span>
                      </div>
                      <div className="text-center justify-center text-indigo-900 text-sm font-bold font-['Inter'] leading-5">Absensi & Kehadiran</div>
                    </Link>

                    {/* Item 4 */}
                    <Link href="/dashboard/kegiatan/lpj" onClick={() => setActiveSubmenu(null)} className="col-span-3 h-24 p-5 bg-cyan-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-cyan-200 flex flex-row justify-start items-center cursor-pointer hover:bg-cyan-100 transition-colors block text-inherit no-underline gap-4">
                      <div className="flex flex-col justify-start items-center">
                        <span className="material-icons-round text-cyan-600 text-[36px]">description</span>
                      </div>
                      <div className="flex flex-col">
                        <div className="text-left text-cyan-900 text-sm font-bold font-['Inter'] leading-5">LPJ Kegiatan</div>
                        <div className="text-left text-cyan-700 text-xs leading-4 mt-0.5">Pelaporan naratif pasca-kegiatan</div>
                      </div>
                    </Link>

                    {/* Item 5 */}
                    <Link href="/dashboard/kegiatan/pemilu" onClick={() => setActiveSubmenu(null)} className="col-span-3 h-24 p-5 bg-blue-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-blue-200 flex flex-row justify-start items-center cursor-pointer hover:bg-blue-100 transition-colors block text-inherit no-underline gap-4">
                      <div className="flex flex-col justify-start items-center">
                        <span className="material-icons-round text-blue-600 text-[36px]">how_to_vote</span>
                      </div>
                      <div className="flex flex-col">
                        <div className="text-left text-blue-900 text-sm font-bold font-['Inter'] leading-5">Pemilihan Umum</div>
                        <div className="text-left text-blue-700 text-xs leading-4 mt-0.5">Voting & Pemilu pengurus baru</div>
                      </div>
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
                    <div className="justify-center text-slate-800 text-lg font-bold font-['Inter'] leading-7">Profil Saya</div>
                  </div>
                  <div className="self-stretch flex justify-between items-start gap-4">
                    <Link href={`/dashboard/members/${userData?.jemaat_id || 'not-found'}?mode=view`} onClick={() => setActiveSubmenu(null)} className="flex-1 h-32 p-4 bg-teal-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-teal-200 flex flex-col justify-center items-center cursor-pointer hover:bg-teal-100 transition-colors block text-inherit no-underline">
                      <div className="pb-2 flex flex-col justify-start items-start">
                        <div className="flex flex-col justify-start items-center">
                          <span className="material-icons-round text-teal-600 text-[32px]">badge</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-start items-center text-center">
                        <div className="justify-center text-teal-900 text-sm font-bold font-['Inter'] leading-5">Data Diri</div>
                      </div>
                    </Link>
                    <div className="flex-1 h-32 p-4 bg-teal-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-teal-200 flex flex-col justify-center items-center cursor-pointer hover:bg-teal-100 transition-colors">
                      <div className="pb-2 flex flex-col justify-start items-start">
                        <div className="flex flex-col justify-start items-center">
                          <span className="material-icons-round text-teal-600 text-[32px]">family_restroom</span>
                        </div>
                      </div>
                      <div className="flex flex-col justify-start items-center text-center">
                        <div className="justify-center text-teal-900 text-sm font-bold font-['Inter'] leading-5">Family Tree</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 self-stretch relative overflow-hidden flex flex-col bg-neutral-100">
          {/* Topbar */}
          <div className="w-full h-16 px-4 md:px-8 bg-white border-b border-slate-200 inline-flex justify-between items-center flex-shrink-0 z-10 box-border">
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
                  <div className="h-7 items-center flex text-slate-700 text-xl font-bold font-['Inter'] leading-7 whitespace-nowrap">{topbarTitle}</div>
                </div>
              </div>
            </div>
            <div className="flex justify-start items-center gap-4">
              <div className="flex justify-start items-center gap-3 cursor-pointer p-1 rounded-lg hover:bg-gray-50 transition-colors group relative">
                <div className="inline-flex flex-col justify-start items-start">
                  <div className="self-stretch flex flex-col justify-start items-end">
                    <div className="hidden sm:block w-28 h-5 text-right justify-center text-slate-900 text-sm font-semibold font-['Inter'] leading-5 truncate">
                      {userData ? userData.email : 'Loading...'}
                    </div>
                  </div>
                  <div className="self-stretch flex flex-col justify-start items-end">
                    <div className="hidden sm:block w-32 h-4 text-right justify-center text-slate-500 text-xs font-normal font-['Inter'] leading-4 truncate">
                       {userData ? `${userData.role_name} - ${userData.satelit_name}`  : 'Role placeholder'}
                    </div>
                  </div>
                </div>
                <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center border-2 border-slate-400 overflow-hidden">
                   <span className="material-icons-round text-slate-400 text-2xl">person</span>
                </div>

                {/* Dropdown Menu for Switching Role */}
                <div className="hidden group-hover:block absolute top-[100%] right-0 pt-2 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-2">
                    <button onClick={handleSwitchRole} className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700">
                        <span className="material-icons-round text-[18px] text-slate-400">swap_horiz</span>
                        Ganti Peran (Role)
                    </button>
                    <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center gap-3 text-sm text-red-500 border-t border-slate-100 mt-1 pt-2">
                        <span className="material-icons-round text-[18px]">logout</span>
                        Keluar Akun
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Outlet */}
          <div className="flex-1 w-full bg-neutral-100 p-4 md:p-8 overflow-y-auto overflow-x-hidden relative">
             {children}
          </div>
        </div>
      </div>
    </div>
  );
}
