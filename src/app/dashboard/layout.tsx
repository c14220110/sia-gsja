'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useLoader } from '@/components/ui/GlobalLoader';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { showLoader, hideLoader } = useLoader();
  const [userData, setUserData] = useState<any>(null);

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
      await fetch('/api/auth/logout', { method: 'POST' });
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

  let topbarTitle = 'Dashboard Utama';
  let topbarIcon = 'dashboard';
  
  if (pathname.includes('/dashboard/members')) {
    topbarTitle = 'Manajemen User';
    topbarIcon = 'manage_accounts';
  }

  return (
    <div className="w-full min-h-screen bg-neutral-100 inline-flex flex-col justify-start items-center overflow-auto font-sans">
      <div className="w-full h-screen inline-flex justify-start items-start overflow-hidden">
        
        {/* Sidebar */}
        <div className="group h-full relative bg-slate-700 flex-shrink-0 w-20 hover:w-80 transition-all duration-300 ease-in-out z-40 flex flex-col shadow-2xl">
          {/* Header */}
          <div className="w-full p-6 border-b border-white/10 flex justify-start items-center gap-3 h-[89px] flex-shrink-0">
            <div className="w-10 h-10 flex justify-center items-center overflow-hidden flex-shrink-0">
              <img className="flex-1 self-stretch relative object-contain" src="/assets/logo_gsja.png" alt="logo" />
            </div>
            <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden">
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
            <nav className="flex-1 w-full overflow-y-auto overflow-x-visible p-4 flex flex-col justify-start items-start gap-2 scrollbar-hide">
              <div className="w-full px-4 py-3 rounded-lg flex justify-start items-center gap-4 hover:bg-white/5 cursor-pointer">
                <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                  <span className="material-icons-round text-slate-200 text-[20px]">dashboard</span>
                </div>
                <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                  <div className="justify-center text-slate-200 text-sm font-normal font-['Inter'] leading-5 pr-4">Dashboard Utama</div>
                </div>
              </div>
              
              {userData?.is_super_admin && (
                <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                  <div className="flex justify-start items-center gap-4">
                    <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                      <span className="material-icons-round text-slate-300 text-[20px]">settings</span>
                    </div>
                    <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Pengaturan Software</div>
                    </div>
                  </div>
                </div>
              )}

              {userData?.role_name?.toUpperCase() !== 'BENDAHARA SATELIT' && (
                <div className="w-full group/submenu">
                  <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                    <div className="flex justify-start items-center gap-4">
                      <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                        <span className="material-icons-round text-slate-300 text-[20px]">manage_accounts</span>
                      </div>
                      <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                        <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Manajemen User</div>
                      </div>
                    </div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                    </div>
                  </div>
                  
                  {/* Flyout Submenu */}
                  <div className="absolute left-full pl-4 hidden group-hover/submenu:flex z-50">
                    <div className="w-[500px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col justify-start items-start gap-4">
                      <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                        <div className="justify-center text-slate-800 text-lg font-bold font-['Inter'] leading-7">Manajemen User</div>
                      </div>
                      <div className="self-stretch flex justify-between items-start gap-4">
                        {/* Data Jemaat */}
                        <Link href="/dashboard/members" className="flex-1 h-32 p-4 bg-pink-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-pink-200 flex flex-col justify-center items-center cursor-pointer hover:bg-pink-100 transition-colors block text-inherit no-underline">
                          <div className="pb-2 flex flex-col justify-start items-start">
                            <div className="flex flex-col justify-start items-center">
                               <span className="material-icons-round text-pink-600 text-[32px]">group</span>
                            </div>
                          </div>
                          <div className="flex flex-col justify-start items-center">
                            <div className="text-center justify-center text-pink-900 text-sm font-bold font-['Inter'] leading-5">Data Jemaat</div>
                          </div>
                        </Link>
                        
                        {/* Data Pelayan */}
                        <div className="flex-1 h-32 p-4 bg-pink-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-pink-200 flex flex-col justify-center items-center cursor-pointer hover:bg-pink-100 transition-colors">
                          <div className="pb-2 flex flex-col justify-start items-start">
                            <div className="flex flex-col justify-start items-center">
                              <span className="material-icons-round text-pink-600 text-[32px]">volunteer_activism</span>
                            </div>
                          </div>
                          <div className="flex flex-col justify-start items-center">
                            <div className="text-center justify-center text-pink-900 text-sm font-bold font-['Inter'] leading-5">Data Pelayan</div>
                          </div>
                        </div>
                        
                        {/* Data Pengurus */}
                        <div className="flex-1 h-32 p-4 bg-pink-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-pink-200 flex flex-col justify-center items-center cursor-pointer hover:bg-pink-100 transition-colors">
                          <div className="pb-2 flex flex-col justify-start items-start">
                            <div className="flex flex-col justify-start items-center">
                              <span className="material-icons-round text-pink-600 text-[32px]">admin_panel_settings</span>
                            </div>
                          </div>
                          <div className="flex flex-col justify-start items-center">
                            <div className="text-center justify-center text-pink-900 text-sm font-bold font-['Inter'] leading-5">Data Pengurus</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">menu_book</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Buku Besar</div>
                  </div>
                </div>
              </div>

              {userData?.role_name?.toUpperCase() !== 'BENDAHARA SATELIT' && (
                <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                  <div className="flex justify-start items-center gap-4">
                    <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                      <span className="material-icons-round text-slate-300 text-[20px]">badge</span>
                    </div>
                    <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
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
                  <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Anggaran & Proposal</div>
                  </div>
                </div>
              </div>

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">event</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Kegiatan</div>
                  </div>
                </div>
              </div>

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">account_balance_wallet</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Kas &amp; Bank</div>
                  </div>
                </div>
              </div>

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">shopping_cart</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Pembelian</div>
                  </div>
                </div>
              </div>

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">inventory_2</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Perlengkapan / Aset Tetap</div>
                  </div>
                </div>
              </div>

              <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                <div className="flex justify-start items-center gap-4">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-300 text-[20px]">assessment</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Laporan</div>
                  </div>
                </div>
              </div>

            </nav>
          )}

          {/* Jemaat Menus */}
          {userData?.role_name?.toLowerCase() === 'jemaat' && (
            <nav className="flex-1 w-full overflow-y-auto overflow-x-visible p-4 flex flex-col justify-start items-start gap-2 scrollbar-hide">
              <Link href="/dashboard" className="w-full block text-inherit no-underline">
                <div className="w-full px-4 py-3 rounded-lg flex justify-start items-center gap-4 hover:bg-white/5 cursor-pointer">
                  <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                    <span className="material-icons-round text-slate-200 text-[20px]">dashboard</span>
                  </div>
                  <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                    <div className="justify-center text-slate-200 text-sm font-normal font-['Inter'] leading-5 pr-4">Dashboard Jemaat</div>
                  </div>
                </div>
              </Link>

              {/* Kegiatan */}
              <div className="w-full group/submenu">
                <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                  <div className="flex justify-start items-center gap-4">
                    <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                      <span className="material-icons-round text-slate-300 text-[20px]">event</span>
                    </div>
                    <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Kegiatan</div>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
                
                {/* Flyout Submenu: Kegiatan */}
                <div className="absolute left-full pl-4 hidden group-hover/submenu:flex z-50">
                  <div className="w-[500px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col justify-start items-start gap-4">
                    <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                      <div className="justify-center text-slate-800 text-lg font-bold font-['Inter'] leading-7">Kegiatan</div>
                    </div>
                    <div className="self-stretch flex justify-between items-start gap-4">
                      {/* Jadwal Kegiatan */}
                      <div className="flex-1 h-32 p-4 bg-blue-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-blue-200 flex flex-col justify-center items-center cursor-pointer hover:bg-blue-100 transition-colors">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-blue-600 text-[32px]">calendar_month</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center text-center">
                          <div className="justify-center text-blue-900 text-sm font-bold font-['Inter'] leading-5">Jadwal Kegiatan</div>
                        </div>
                      </div>
                      
                      {/* Daftar Event */}
                      <div className="flex-1 h-32 p-4 bg-blue-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-blue-200 flex flex-col justify-center items-center cursor-pointer hover:bg-blue-100 transition-colors">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-blue-600 text-[32px]">how_to_reg</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center text-center">
                          <div className="justify-center text-blue-900 text-sm font-bold font-['Inter'] leading-5">Daftar / Registrasi Event</div>
                        </div>
                      </div>
                      
                      {/* Riwayat Kehadiran */}
                      <div className="flex-1 h-32 p-4 bg-blue-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-blue-200 flex flex-col justify-center items-center cursor-pointer hover:bg-blue-100 transition-colors">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-blue-600 text-[32px]">history</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center text-center">
                          <div className="justify-center text-blue-900 text-sm font-bold font-['Inter'] leading-5">Riwayat Kehadiran</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Profil Saya */}
              <div className="w-full group/submenu">
                <div className="w-full px-4 py-3 rounded-lg flex justify-between items-center hover:bg-white/5 cursor-pointer">
                  <div className="flex justify-start items-center gap-4">
                    <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                      <span className="material-icons-round text-slate-300 text-[20px]">person</span>
                    </div>
                    <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                      <div className="h-5 justify-center text-slate-200 text-sm font-medium font-['Inter'] leading-5 pr-4">Profil Saya</div>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="material-icons-round text-slate-400 text-[16px]">chevron_right</span>
                  </div>
                </div>
                
                {/* Flyout Submenu: Profil Saya */}
                <div className="absolute left-full pl-4 hidden group-hover/submenu:flex z-50">
                  <div className="w-[330px] p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-slate-200 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col justify-start items-start gap-4">
                    <div className="self-stretch pb-2 border-b border-slate-100 flex flex-col justify-start items-start">
                      <div className="justify-center text-slate-800 text-lg font-bold font-['Inter'] leading-7">Profil Saya</div>
                    </div>
                    <div className="self-stretch flex justify-between items-start gap-4">
                      {/* Data Diri */}
                      <Link href={`/dashboard/members/${userData?.jemaat_id || 'not-found'}?mode=view`} className="flex-1 h-32 p-4 bg-teal-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-teal-200 flex flex-col justify-center items-center cursor-pointer hover:bg-teal-100 transition-colors block text-inherit no-underline">
                        <div className="pb-2 flex flex-col justify-start items-start">
                          <div className="flex flex-col justify-start items-center">
                            <span className="material-icons-round text-teal-600 text-[32px]">badge</span>
                          </div>
                        </div>
                        <div className="flex flex-col justify-start items-center text-center">
                          <div className="justify-center text-teal-900 text-sm font-bold font-['Inter'] leading-5">Data Diri</div>
                        </div>
                      </Link>
                      
                      {/* Family Tree */}
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
              </div>
            </nav>
          )}

          {/* Logout button at bottom */}
          <div className="w-full p-4 border-t border-white/10 mt-auto flex-shrink-0">
            <button onClick={handleLogout} className="w-full px-4 py-3 rounded-lg flex justify-start items-center gap-4 hover:bg-white/5 cursor-pointer outline-none">
              <div className="w-6 flex flex-col justify-center items-center flex-shrink-0">
                <span className="material-icons-round text-white text-[20px]">logout</span>
              </div>
              <div className="flex flex-col justify-start items-start opacity-0 group-hover:opacity-100 transition-all duration-300 w-0 group-hover:w-auto overflow-hidden whitespace-nowrap">
                <div className="h-5 justify-center text-white text-sm font-normal font-['Inter'] leading-5 pr-4">Keluar</div>
              </div>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 self-stretch relative overflow-hidden flex flex-col bg-neutral-100">
          {/* Topbar */}
          <div className="w-full h-16 px-8 bg-white border-b border-slate-200 inline-flex justify-between items-center flex-shrink-0 z-10 box-border">
            <div className="flex justify-start items-center gap-6">
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
              <div className="w-10 h-10 relative bg-slate-100 rounded-lg flex justify-center items-center cursor-pointer hover:bg-slate-200 transition-colors">
                <div className="inline-flex flex-col justify-center items-center">
                   <span className="material-icons-round text-slate-600 text-[20px]">notifications</span>
                </div>
                <div className="w-2.5 h-2.5 absolute bg-red-500 rounded-full border-2 border-white top-[8px] right-[8px]" />
              </div>
              <div className="w-4 h-8 px-2 inline-flex flex-col justify-start items-start">
                <div className="w-px h-8 bg-slate-200" />
              </div>
              <div className="flex justify-start items-center gap-3 cursor-pointer p-1 rounded-lg hover:bg-gray-50 transition-colors group relative">
                <div className="inline-flex flex-col justify-start items-start">
                  <div className="self-stretch flex flex-col justify-start items-end">
                    <div className="w-28 h-5 text-right justify-center text-slate-900 text-sm font-semibold font-['Inter'] leading-5 truncate">
                      {userData ? userData.email : 'Loading...'}
                    </div>
                  </div>
                  <div className="self-stretch flex flex-col justify-start items-end">
                    <div className="w-32 h-4 text-right justify-center text-slate-500 text-xs font-normal font-['Inter'] leading-4 truncate">
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
          <div className="flex-1 w-full bg-neutral-100 p-8 overflow-y-auto relative">
             {children}
          </div>
        </div>
      </div>
    </div>
  );
}
