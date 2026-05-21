'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLoader } from '@/components/ui/GlobalLoader';
import QRCode from 'react-qr-code';
import PushNotificationManager from '@/components/ui/PushNotificationManager';
import dynamic from 'next/dynamic';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });
import scanQrLottie from '../../../public/assets/scan-qr-code.json';

export default function JemaatPwaLayout({
  children,
  userData
}: {
  children: React.ReactNode;
  userData: any;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { showLoader, hideLoader, setLoaderVariant } = useLoader();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [showQrOptions, setShowQrOptions] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [displayPath, setDisplayPath] = useState(pathname);
  const prevPathRef = useRef(pathname);
  const historyRef = useRef(['/']);
  const directionRef = useRef('forward');

  if (pathname !== prevPathRef.current) {
    const h = historyRef.current;
    if (h.length > 1 && h[h.length - 2] === pathname) {
      directionRef.current = 'backward';
      h.pop();
    } else {
      directionRef.current = 'forward';
      h.push(pathname);
    }
    prevPathRef.current = pathname;
  }

  // Install Prompt States
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [showAndroidInstructions, setShowAndroidInstructions] = useState(false);

  useEffect(() => {
    // Deteksi jika pengguna sudah menutup card
    const isDismissed = localStorage.getItem('gsja_hide_install') === 'true';
    
    // Deteksi kalau dia sudah buka lewat ikon di HP (Bukan Browser)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    // Cek OS (Apakah iPhone/iPad)
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIOSDevice);

    if (isDismissed || isStandalone) {
      return; 
    }

    // Selalu tampilkan card untuk semua OS sebagai panduan utama
    setShowInstallPrompt(true);

    // Untuk Android / Desktop Chrome (nangkap event otomatis kalau nyala)
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault(); // Tahan dulu bawaan HP
      setDeferredPrompt(e); // Simpan untuk dipanggil lewat tombol
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
       setShowIOSInstructions(true);
    } else {
       setShowAndroidInstructions(true);
    }
  };

  const handleDismissInstall = () => {
    localStorage.setItem('gsja_hide_install', 'true');
    setShowInstallPrompt(false);
  };

  // Set loader menjadi minimal eksklusif hanya untuk PWA Jemaat 
  useEffect(() => {
    setLoaderVariant('minimal');
    return () => setLoaderVariant('sandy');
  }, [setLoaderVariant]);

  
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
      active: pathname === '/' || pathname === '/dashboard'
    },
    {
      label: 'Alkitab',
      icon: 'menu_book',
      href: '/alkitab',
      active: pathname.includes('/alkitab')
    }
  ];

  // Determine base background dynamically to avoid flash during transitions
  let wrapperBgClass = "bg-slate-50";
  if (pathname.startsWith('/alkitab')) {
    if (typeof window !== 'undefined' && localStorage.getItem('alkitab_dark_mode') === 'true') {
      wrapperBgClass = "bg-slate-900";
    }
  }

  return (
    <div className={`w-full min-h-screen ${wrapperBgClass} flex flex-col font-['Inter'] relative selection:bg-blue-100 selection:text-blue-900 overflow-hidden`}>

      {/* PAGE TRANSITION STYLES */}
      <style>{`
        .pwa-page-enter-forward {
          animation: slideInLeft 0.35s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        .pwa-page-enter-backward {
          animation: slideInRight 0.35s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }
        
        @keyframes slideInRight {
          from { transform: translateX(30%); opacity: 0; }
          to { transform: none; opacity: 1; }
        }
        @keyframes slideInLeft {
          from { transform: translateX(-30%); opacity: 0; }
          to { transform: none; opacity: 1; }
        }

        @keyframes icon-breath {
          0% { transform: scale(1.1); filter: drop-shadow(0 0px 0px rgba(37,99,235,0)); }
          50% { transform: scale(1.25); filter: drop-shadow(0 4px 10px rgba(37,99,235,0.4)); }
          100% { transform: scale(1.1); filter: drop-shadow(0 0px 0px rgba(37,99,235,0)); }
        }

        @keyframes qr-backdrop-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes qr-pop-left {
          0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
          60% { transform: translate(-78px, -135px) scale(1.08); opacity: 1; }
          100% { transform: translate(-70px, -120px) scale(1); opacity: 1; }
        }
        @keyframes qr-pop-right {
          0% { transform: translate(0, 0) scale(0.3); opacity: 0; }
          60% { transform: translate(78px, -135px) scale(1.08); opacity: 1; }
          100% { transform: translate(70px, -120px) scale(1); opacity: 1; }
        }
        @keyframes qr-label-in {
          0% { opacity: 0; transform: translateY(8px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes qr-close-in {
          0% { transform: scale(0) rotate(-180deg); opacity: 0; }
          70% { transform: scale(1.1) rotate(10deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
      `}</style>
      
      {/* AREA KONTEN UTAMA */}
      <main
        key={pathname}
        className={`flex-1 w-full ${pathname.startsWith('/alkitab') ? '' : 'pb-24'} overflow-y-auto pwa-page-enter-${directionRef.current}`}
      >
        {children}
      </main>

      {/* CARD INSTALASI APLIKASI (Hanya di mode browser) */}
      {showInstallPrompt && (
         <div className="fixed bottom-[90px] left-4 right-4 z-40 animate-in slide-in-from-bottom fade-in duration-500">
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 rounded-2xl p-4 shadow-2xl shadow-blue-900/30 text-white relative overflow-hidden border border-white/10 max-w-lg mx-auto">
               {/* Ornamen Desain */}
               <div className="absolute -top-12 -right-12 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
               
               <div className="flex items-start justify-between relative z-10">
                  <div className="flex gap-3">
                     <div className="w-12 h-12 bg-white rounded-xl shadow-inner flex items-center justify-center shrink-0">
                        <span className="material-icons-round text-blue-600 text-3xl">add_to_home_screen</span>
                     </div>
                     <div className="flex flex-col">
                        <h4 className="font-bold text-sm tracking-wide">Akses Lebih Cepat</h4>
                        <p className="text-blue-100 text-[11px] leading-relaxed mt-0.5">
                           Pasang aplikasi Gereja ke layar utama HP Anda agar tidak perlu repot mengetik link lagi!
                        </p>
                     </div>
                  </div>
                  <button onClick={handleDismissInstall} className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 hover:bg-white/20 ml-2">
                     <span className="material-icons-round text-[14px]">close</span>
                  </button>
               </div>

               {showIOSInstructions ? (
                  <div className="mt-4 p-3 bg-white/10 rounded-xl border border-white/20 animate-in fade-in zoom-in-95">
                     <p className="text-[11px] font-medium leading-relaxed">
                        <strong className="text-white block mb-1">Panduan Khusus iPhone/iPad:</strong>
                        1. Ketuk ikon <strong>Bagikan 📤</strong> (Share) di bagian bawah browser Safari Anda.<br/>
                        2. Gulir ke bawah, lalu pilih <strong>Tambah ke Layar Utama ➕</strong> (Add to Home Screen).
                     </p>
                  </div>
               ) : showAndroidInstructions ? (
                  <div className="mt-4 p-3 bg-white/10 rounded-xl border border-white/20 animate-in fade-in zoom-in-95">
                     <p className="text-[11px] font-medium leading-relaxed">
                        <strong className="text-white block mb-1">Panduan Khusus Android:</strong>
                        1. Ketuk ikon <strong>Titik Tiga ⋮</strong> di bagian pojok kanan atas browser.<br/>
                        2. Pilih opsi <strong>Tambahkan ke Layar Utama</strong> atau <strong>Install App</strong>.
                     </p>
                  </div>
               ) : (
                  <button 
                     onClick={handleInstallClick} 
                     className="w-full mt-4 py-2 bg-white text-blue-700 font-bold rounded-xl text-xs hover:bg-blue-50 active:scale-95 transition-all shadow-lg"
                  >
                     Pasang Aplikasi Sekarang
                  </button>
               )}
            </div>
         </div>
      )}

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
      {!pathname.startsWith('/alkitab') && (
        <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-slate-200/60 pb-safe shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] z-50">
          <div className="flex justify-between items-center px-4 md:px-8 py-2 max-w-lg mx-auto relative">
          
          {/* Menu Kiri */}
          <div className="flex w-2/5 justify-between">
            <Link href={navItems[0].href} className={`flex flex-col items-center justify-center w-full h-12 gap-1 rounded-xl transition-all ${navItems[0].active ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
              <span 
                className={`material-icons-round text-2xl transition-transform ${navItems[0].active ? 'scale-110 text-blue-600' : ''}`}
                style={navItems[0].active ? { animation: 'icon-breath 2.5s infinite ease-in-out' } : undefined}
              >
                {navItems[0].icon}
              </span>
              <span className="text-[10px] tracking-wide">{navItems[0].label}</span>
            </Link>
            <Link href={navItems[1].href} className={`flex flex-col items-center justify-center w-full h-12 gap-1 rounded-xl transition-all ${navItems[1].active ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
              <span 
                className={`material-icons-round text-2xl transition-transform ${navItems[1].active ? 'scale-110 text-blue-600' : ''}`}
                style={navItems[1].active ? { animation: 'icon-breath 2.5s infinite ease-in-out' } : undefined}
              >
                {navItems[1].icon}
              </span>
              <span className="text-[10px] tracking-wide">{navItems[1].label}</span>
            </Link>
          </div>

          {/* Floating Action Button Tengah (QR Code) */}
          <div className="w-1/5 flex justify-center relative">
            <button 
              onClick={() => setShowQrOptions(true)}
              className="absolute -top-9 w-16 h-16 bg-gradient-to-br from-indigo-600 to-blue-500 rounded-full flex flex-col items-center justify-center text-white shadow-xl shadow-blue-500/30 border-4 border-white active:scale-95 transition-transform overflow-hidden"
            >
              <Lottie animationData={scanQrLottie} loop={true} className="w-14 h-14 scale-110" />
            </button>
            <span className="text-[10px] font-bold text-slate-800 tracking-wide mt-8">QR Code</span>
          </div>

          {/* Menu Kanan */}
          <div className="flex w-2/5 justify-between">
            <Link href="/tiket" className={`flex flex-col items-center justify-center w-full h-12 gap-1 rounded-xl transition-all ${pathname.includes('/tiket') ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}>
              <span 
                className={`material-icons-round text-2xl transition-transform ${pathname.includes('/tiket') ? 'scale-110 text-blue-600' : ''}`}
                style={pathname.includes('/tiket') ? { animation: 'icon-breath 2.5s infinite ease-in-out' } : undefined}
              >
                local_activity
              </span>
              <span className="text-[10px] tracking-wide">Tiket</span>
            </Link>
            <button 
              onClick={() => setIsSettingsOpen(true)}
              className={`flex flex-col items-center justify-center w-full h-12 gap-1 rounded-xl transition-all ${isSettingsOpen ? 'text-blue-600 font-bold' : 'text-slate-400 hover:text-slate-600 font-medium'}`}
            >
              <span 
                className={`material-icons-round text-2xl transition-transform ${isSettingsOpen ? 'scale-110 text-blue-600' : ''}`}
                style={isSettingsOpen ? { animation: 'icon-breath 2.5s infinite ease-in-out' } : undefined}
              >
                settings
              </span>
              <span className="text-[10px] tracking-wide">Pengaturan</span>
            </button>
            </div>
          </div>
        </nav>
      )}

      {/* RADIAL POP-OUT: QR OPTIONS */}
      {showQrOptions && (
        <div className="fixed inset-0 z-[100] pointer-events-none">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm pointer-events-auto"
            style={{ animation: 'qr-backdrop-in 0.3s ease-out forwards' }}
            onClick={() => setShowQrOptions(false)}
          />
          
          {/* Options Container — anchored to FAB center */}
          <div className="absolute bottom-0 left-0 right-0 flex justify-center pointer-events-none" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 36px)' }}>
            
            {/* Left Option: Scan QR — starts from center, flies upper-left */}
            <div 
              className="absolute flex flex-col items-center gap-2 pointer-events-auto"
              style={{ 
                bottom: '0px',
                animation: 'qr-pop-left 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
              }}
            >
              <span 
                className="text-white font-bold text-xs tracking-wide drop-shadow-lg"
                style={{ animation: 'qr-label-in 0.3s ease-out 0.25s both' }}
              >
                Scan QR
              </span>
              <button 
                onClick={() => {
                  setShowQrOptions(false);
                  if (pathname !== '/' && pathname !== '/dashboard') {
                    router.push('/?action=scan');
                  } else {
                    window.dispatchEvent(new Event('openScanner'));
                  }
                }}
                className="w-[64px] h-[64px] bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(37,99,235,0.6)] border-[3px] border-white active:scale-90 transition-transform"
              >
                <span className="material-icons-round text-[28px] text-white">photo_camera</span>
              </button>
            </div>

            {/* Right Option: QR Saya — starts from center, flies upper-right */}
            <div 
              className="absolute flex flex-col items-center gap-2 pointer-events-auto"
              style={{ 
                bottom: '0px',
                animation: 'qr-pop-right 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) 0.06s forwards',
                opacity: 0,
              }}
            >
              <span 
                className="text-white font-bold text-xs tracking-wide drop-shadow-lg"
                style={{ animation: 'qr-label-in 0.3s ease-out 0.3s both' }}
              >
                QR Saya
              </span>
              <button 
                onClick={() => {
                  setShowQrOptions(false);
                  setShowQrModal(true);
                }}
                className="w-[64px] h-[64px] bg-gradient-to-br from-indigo-400 to-indigo-600 rounded-full flex items-center justify-center shadow-[0_8px_30px_rgba(79,70,229,0.6)] border-[3px] border-white active:scale-90 transition-transform"
              >
                <span className="material-icons-round text-[28px] text-white">qr_code</span>
              </button>
            </div>

            {/* Close Button — same position as FAB, spins in */}
            <button 
              onClick={() => setShowQrOptions(false)}
              className="relative top-[2px] w-16 h-16 bg-white rounded-full flex items-center justify-center text-rose-500 shadow-2xl border-4 border-white active:scale-90 transition-transform pointer-events-auto"
              style={{ animation: 'qr-close-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards' }}
            >
              <span className="material-icons-round text-[32px]">close</span>
            </button>
            
          </div>
        </div>
      )}

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
                value={userData?.jemaat_nomor || userData?.jemaat_id?.toString() || userData?.user_id?.toString() || 'NO-ID'} 
                size={220}
                level="H"
                fgColor="#0f172a" /* slate-900 */
              />
            </div>

            <h3 className="text-xl font-bold text-slate-800 mb-1">{userData?.email || userData?.nama_lengkap || 'Jemaat GSJA'}</h3>
            <div className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-50 text-blue-700 font-mono font-bold tracking-widest rounded-lg border border-blue-100">
              <span className="material-icons-round text-[16px]">badge</span>
              {userData?.jemaat_nomor || 'ID TIDAK DITEMUKAN'}
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

      {/* WEB PUSH MANAGER */}
      <PushNotificationManager />

    </div>
  );
}
