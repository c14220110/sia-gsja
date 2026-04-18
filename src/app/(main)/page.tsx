'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function DashboardHome() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [pendingRoster, setPendingRoster] = useState<any[]>([]); // Jadwal pelayanan yang belum dikonfirmasi
  const [isPelayan, setIsPelayan] = useState(false);             // Apakah jemaat ini terdaftar pelayan?
  const [showLayananSheet, setShowLayananSheet] = useState(false); // Bottom sheet
  const [isFullscreenQR, setIsFullscreenQR] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ isVisible: boolean, type: 'success' | 'error', message: string }>({ isVisible: false, type: 'success', message: '' });
  const { showLoader, hideLoader } = useLoader();

  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }
  }, []);

  useEffect(() => {
    const initData = async () => {
       showLoader();
       try {
         // Coba ambil data terbaru saat online
         const resAuth = await fetch('/api/auth/me');
         if (resAuth.ok) {
           const uData = await resAuth.json();
           setUserData(uData);
           localStorage.setItem('gsja_user_data', JSON.stringify(uData)); // Simpan Cache

           if (uData?.role_name?.toLowerCase() === 'jemaat') {
             const q = new URLSearchParams({ limit: '20', status: 'Akan Datang', tanggal: 'Semua' });
             // Dihapus: filter satelit, karena jemaat bebas mendaftar acara satelit manapun
             
             const resEv = await fetch(`/api/kegiatan?${q.toString()}`);
             if (resEv.ok) {
                const reqData = await resEv.json();
                if (reqData.success && reqData.data.length > 0) {
                   const eventsWithReg = reqData.data.filter((e: any) => e.butuh_registrasi === true).slice(0, 5);
                   setUpcomingEvents(eventsWithReg);
                   localStorage.setItem('gsja_upcoming_events', JSON.stringify(eventsWithReg)); // Simpan Cache Kasar Kegiatan
                }
             }

             // Cek jadwal pelayanan yang belum dikonfirmasi (untuk banner & badge)
             const resRoster = await fetch('/api/pelayan/jadwal-saya');
             if (resRoster.ok) {
               const rosterData = await resRoster.json();
               if (rosterData.success) {
                 setIsPelayan(rosterData.is_pelayan);
                 if (rosterData.total > 0) setPendingRoster(rosterData.pending);
               }
             }
           }
         }
       } catch (err) {
          console.error('Mode Offline terdeteksi:', err);
          
          // JIKA OFFLINE (Fetch Gagal), BONGKAR CACHE DARI LOCAL STORAGE
          const cachedUser = localStorage.getItem('gsja_user_data');
          if (cachedUser) {
             setUserData(JSON.parse(cachedUser));
          }
          
          const cachedEvent = localStorage.getItem('gsja_upcoming_events');
          if (cachedEvent) {
             setUpcomingEvents(JSON.parse(cachedEvent));
          }
       } finally {
          hideLoader();
       }
    };
    initData();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateString));
  };

  const handleScan = async (detectedCodes: any[]) => {
    if (!detectedCodes || detectedCodes.length === 0) return;
    const rawValue = detectedCodes[0].rawValue;
    if (!rawValue) return;

    // Hindari scan berkali-kali jika loader/feedback sedang aktif
    if (scanFeedback.isVisible) return; 

    try {
      showLoader();
      const decodedStr = atob(rawValue);
      const payload = JSON.parse(decodedStr);

      if (!payload.k || !payload.exp) throw new Error('Format QR tidak valid');
      
      if (Date.now() > payload.exp) {
         setScanFeedback({ isVisible: true, type: 'error', message: 'QR Code Kadaluarsa! Mohon Usher memperbarui layar.' });
         hideLoader();
         setTimeout(() => setScanFeedback(prev => ({ ...prev, isVisible: false })), 4000);
         return;
      }

      // Hit API Absensi
      const res = await fetch(`/api/kegiatan/${payload.k}/absensi`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            action_type: 'qr_scan',
            id_jemaat: userData.jemaat_id
         })
      });

      const result = await res.json();
      
      if (res.ok && result.success) {
         setScanFeedback({ isVisible: true, type: 'success', message: result.message || 'Presensi Berhasil Dicatat!' });
         setTimeout(() => {
            setScanFeedback(prev => ({ ...prev, isVisible: false }));
            setIsFullscreenQR(false); // Otomatis tutup scanner setelah sukses 2 detik
         }, 3000);
      } else {
         setScanFeedback({ isVisible: true, type: 'error', message: result.message || 'Gagal memproses absensi.' });
         setTimeout(() => setScanFeedback(prev => ({ ...prev, isVisible: false })), 4000);
      }
    } catch (err) {
      setScanFeedback({ isVisible: true, type: 'error', message: 'QR Code Rusak Ditolak: Bukan milik Acara GSJA.' });
      setTimeout(() => setScanFeedback(prev => ({ ...prev, isVisible: false })), 4000);
    } finally {
      hideLoader();
    }
  };

  // Klik tombol "Jadwal Pelayanan" — routing cerdas
  const handleJadwalPelayananClick = () => {
    // DEBUG: cek nilai isPelayan saat tombol diklik
    console.log('[JadwalSaya-UI] isPelayan saat diklik =', isPelayan);
    if (isPelayan) {
      router.push('/pelayan/jadwal');
    } else {
      setShowLayananSheet(true);
    }
  };

  // --- TAMPILAN JEMAAT (PWA SUPER APP) ---
  if (userData?.role_name?.toLowerCase() === 'jemaat') {
    const jemaatName = userData.email?.split('@')[0] || 'Jemaat';
    const qrPayload = JSON.stringify({ type: 'JEMAAT', id: userData.jemaat_id });

    return (
      <div className="w-full h-full flex flex-col bg-slate-50 overflow-y-auto">
        
        {/* ── BOTTOM SHEET: Jadwal Pelayanan ── */}
        {showLayananSheet && (
          <div className="fixed inset-0 z-[9998] flex flex-col justify-end" onClick={() => setShowLayananSheet(false)}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200" />

            {/* Sheet Panel */}
            <div
              className="relative bg-white rounded-t-3xl px-6 pt-3 pb-10 animate-in slide-in-from-bottom-4 duration-300"
              onClick={e => e.stopPropagation()}
            >
              {/* Drag handle */}
              <div className="w-10 h-1.5 rounded-full bg-slate-200 mx-auto mb-6" />

              {isPelayan ? (
                /* ── Pelayan terdaftar: tampilkan jadwal ── */
                <div className="flex flex-col items-center">
                  <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4">
                    <span className="material-icons-round text-emerald-600 text-4xl">assignment_ind</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 text-center mb-1">Jadwal Pelayanan Anda</h2>
                  {pendingRoster.length > 0 ? (
                    <div className="w-full mt-4 flex flex-col gap-3">
                      {pendingRoster.map((r: any) => (
                        <div key={r.roster_id} className="w-full bg-amber-50 border border-amber-200 rounded-xl p-3 flex gap-3">
                          <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                            <span className="material-icons-round text-amber-600 text-[18px]">event</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-black text-slate-800 truncate">{r.nama_kegiatan}</p>
                            <p className="text-xs text-amber-700 font-medium">{r.nama_peran}</p>
                            <p className="text-[10px] text-slate-400 mt-0.5">{r.tanggal_mulai?.substring(0,10)} · {r.waktu_mulai?.substring(0,5)} WIB</p>
                          </div>
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full h-fit mt-1 whitespace-nowrap">Menunggu Konfirmasi</span>
                        </div>
                      ))}
                      <p className="text-xs text-slate-400 text-center mt-1">Fitur konfirmasi via HP segera hadir 🚀</p>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 text-center mt-2">Tidak ada jadwal yang perlu dikonfirmasi saat ini. Tetap semangat melayani! 🙌</p>
                  )}
                </div>
              ) : (
                /* ── Bukan pelayan: tampilkan ajakan melayani ── */
                <div className="flex flex-col items-center text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-indigo-100 to-blue-50 rounded-3xl flex items-center justify-center mb-5 shadow-inner">
                    <span className="material-icons-round text-indigo-500 text-5xl">volunteer_activism</span>
                  </div>
                  <h2 className="text-xl font-black text-slate-900 mb-2">Panggilan Untuk Melayani! 🙌</h2>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-[300px]">
                    Shalom! Saat ini Anda belum terdaftar dalam tim pelayanan GSJA.
                  </p>
                  <p className="text-sm text-slate-500 leading-relaxed max-w-[300px] mt-2">
                    Tuhan memanggil kita untuk tidak hanya menjadi jemaat, tetapi juga melayani ladang-Nya.
                    Mari temukan potensi Anda dan bergabunglah bersama tim pelayan kami!
                  </p>
                  <a
                    href={`https://wa.me/6287808786143?text=${encodeURIComponent('Shalom, saya ingin bertanya cara bergabung menjadi pelayan di GSJA 🙏')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 w-full flex items-center justify-center gap-2.5 py-3.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-sm rounded-2xl transition-all shadow-lg shadow-emerald-500/30"
                  >
                    <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                    Hubungi Kami via WhatsApp
                  </a>
                  <button
                    onClick={() => setShowLayananSheet(false)}
                    className="mt-3 text-xs text-slate-400 font-medium py-2"
                  >
                    Tutup
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Fullscreen Camera Scanner Context */}
        {isFullscreenQR && (
          <div className="fixed inset-0 bg-slate-900 z-[9999] flex flex-col items-center justify-center animate-in zoom-in-95 duration-200">
             
             {/* Header Scanner */}
             <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-slate-900/80 to-transparent">
               <button onClick={() => setIsFullscreenQR(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white backdrop-blur-sm border border-white/20">
                 <span className="material-icons-round">close</span>
               </button>
               <h2 className="text-white font-bold text-lg tracking-wider">Scan Kehadiran</h2>
               <div className="w-10"></div>
             </div>

             {/* Feedback Overlay */}
             {scanFeedback.isVisible && (
                <div className="absolute top-24 left-6 right-6 z-20 animate-in slide-in-from-top-4">
                  <div className={`p-4 rounded-2xl flex items-center gap-3 shadow-2xl border ${scanFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-rose-50 border-rose-200 text-rose-800'}`}>
                    <span className="material-icons-round text-3xl">{scanFeedback.type === 'success' ? 'check_circle' : 'error'}</span>
                    <span className="font-bold text-sm leading-tight">{scanFeedback.message}</span>
                  </div>
                </div>
             )}

             {/* Scanner Area */}
             <div className="w-full h-full flex items-center justify-center relative overflow-hidden bg-black">
                <Scanner 
                  onScan={handleScan}
                  formats={['qr_code']}
                  styles={{ container: { width: '100%', height: '100%' } }}
                  components={{ finder: true }}
                />
             </div>
             
             {/* Footer Scanner */}
             <div className="absolute bottom-0 left-0 right-0 p-8 text-center bg-gradient-to-t from-slate-900/90 to-transparent pointer-events-none">
                <p className="text-white/80 font-medium text-sm">Arahkan layar ke QR Code Acara yang ditampilkan oleh Usher di pintu.</p>
             </div>
          </div>
        )}

        {/* 1. HEADER PAGE */}
        <div className="w-full px-6 pt-10 pb-6 bg-white flex justify-between items-start rounded-b-3xl shadow-sm z-10">
           <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Shalom, {jemaatName}! 👋</h1>
              <div className="flex items-center gap-1.5 text-slate-500">
                 <span className="material-icons-round text-[16px]">location_on</span>
                 <span className="text-xs font-medium">{userData.satelit_name || 'Satelit GSJA'}</span>
              </div>
           </div>
           
           <Link href={`/profil`} className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center shadow-inner border border-blue-100 overflow-hidden shrink-0">
             {userData?.foto_url ? (
               <img src={userData.foto_url} alt="profil" className="w-full h-full object-cover" />
             ) : (
               <span className="material-icons-round text-blue-500 text-2xl">person</span>
             )}
           </Link>

        </div>

        {/* PITA PERINGATAN OFFLINE (Biar elegan dinonaktifkan / warning fitur jika tdk ada sinyal) */}
        {!isOnline && (
          <div className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 shadow-sm">
             <span className="material-icons-round text-amber-500 mt-0.5">signal_wifi_off</span>
             <p className="text-xs text-amber-700 font-medium leading-relaxed">
               <strong className="block mb-0.5">Anda sedang Offline.</strong>
               Menampilkan data terakhir (cached). Fitur pemindai dan pembaruan akan dinonaktifkan, namun fitur ganti role, lihat riwayat, dan lihat/scan kartu QR Anda (tombol tengah bawah) dijamin 100% tetap bisa berjalan!
             </p>
          </div>
        )}

        <div className="w-full px-6 flex flex-col gap-8 pb-12 mt-6">
           
           {/* ── DYNAMIC ACTION BANNER: Konfirmasi Jadwal Pelayanan ── */}
           {pendingRoster.length > 0 && (
             <div className="w-full bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 flex gap-3 shadow-sm animate-in slide-in-from-top-3 fade-in">
               <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                 <span className="material-icons-round text-amber-600 text-[22px]">assignment_late</span>
               </div>
               <div className="flex-1 min-w-0">
                 <p className="text-sm font-black text-amber-900 leading-tight mb-0.5">Konfirmasi Jadwal Pelayanan</p>
                 <p className="text-xs text-amber-700 leading-relaxed mb-3">
                   Anda dijadwalkan sebagai{' '}
                   <strong>{pendingRoster[0].nama_peran}</strong>{' '}
                   untuk <strong>{pendingRoster[0].nama_kegiatan}</strong>.
                   {pendingRoster.length > 1 && (
                     <span className="ml-1 text-amber-600 font-bold">+{pendingRoster.length - 1} lainnya.</span>
                   )}
                   {' '}Mohon konfirmasi kehadiran Anda.
                 </p>
                 <button
                   onClick={() => router.push('/pelayan/jadwal')}
                   className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-black rounded-lg transition-colors"
                 >
                   <span className="material-icons-round text-[14px]">how_to_reg</span>
                   Lihat & Konfirmasi
                 </button>
               </div>
               <button
                 onClick={() => setPendingRoster([])}
                 className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-amber-100 text-amber-400 hover:text-amber-600 shrink-0 transition-colors"
                 title="Tutup"
               >
                 <span className="material-icons-round text-[16px]">close</span>
               </button>
             </div>
           )}

           {/* 2. HERO CARD (SCANNER TRIGGER) */}
           <div 
             onClick={() => setIsFullscreenQR(true)}
             className="w-full bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 rounded-3xl p-6 flex flex-col items-center shadow-lg shadow-blue-500/30 relative overflow-hidden cursor-pointer group transition-transform active:scale-95"
           >
              {/* Ornaments */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sky-300/20 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="w-36 h-36 bg-white/20 backdrop-blur-md border border-white/40 p-1 rounded-3xl shadow-inner z-10 mb-4 flex items-center justify-center group-hover:bg-white/30 transition-colors pointer-events-none">
                 <div className="w-full h-full text-white pointer-events-none mix-blend-plus-lighter opacity-90 group-hover:scale-110 transition-transform">
                   <DotLottieReact src="/assets/qr-code-scan.lottie" loop autoplay />
                 </div>
              </div>

              <h2 className="text-white font-black text-2xl tracking-tight mb-1 z-10">Pindai Kehadiran</h2>
              <p className="text-center text-blue-50 text-xs font-medium max-w-[270px] z-10 leading-relaxed mb-1 opacity-90">
                 Ketuk layar ini untuk mengaktifkan kamera belakang dan memindai QR ibadah/kegiatan!
              </p>
           </div>

           {/* 3. QUICK ACTIONS GRID */}
           <div className="w-full flex flex-col gap-3">
              <h3 className="text-slate-800 font-black text-lg tracking-tight px-1">Menu Jemaat</h3>
              <div className="grid grid-cols-4 sm:grid-cols-4 gap-y-6 gap-x-2 w-full p-5 bg-white rounded-3xl shadow-sm border border-slate-100">
                 <Link href="/jadwal" className="flex flex-col items-center gap-3 group cursor-pointer">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:shadow-md transition-all text-blue-600">
                       <span className="material-icons-round text-3xl">event</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">Jadwal &<br/>Acara</span>
                 </Link>
                 
                 <div onClick={handleJadwalPelayananClick} className="flex flex-col items-center gap-3 group cursor-pointer relative">
                     {/* Badge notifikasi jika ada jadwal menunggu konfirmasi */}
                     {pendingRoster.length > 0 && (
                       <span className="absolute -top-1 -right-1 z-10 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black rounded-full flex items-center justify-center px-1 shadow-md animate-bounce">
                         {pendingRoster.length}
                       </span>
                     )}
                     <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:shadow-md transition-all text-emerald-600">
                        <span className="material-icons-round text-3xl">assignment_ind</span>
                     </div>
                     <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">Jadwal<br/>Pelayanan</span>
                  </div>

                 <Link href="/riwayat-kehadiran" className="flex flex-col items-center gap-3 group cursor-pointer">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:shadow-md transition-all text-amber-600">
                       <span className="material-icons-round text-3xl">history</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">Riwayat<br/>Kehadiran</span>
                 </Link>

                 <Link href="/tiket" className="flex flex-col items-center gap-3 group cursor-pointer">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:shadow-md transition-all text-violet-600">
                       <span className="material-icons-round text-3xl">local_activity</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">Tiket<br/>Saya</span>
                 </Link>
               </div>
           </div>

           {/* 4. DYNAMIC WIDGET (Upcoming Events Carousel) */}
           <div className="w-full flex flex-col gap-3">
              <h3 className="text-slate-800 font-black text-lg tracking-tight px-1 flex items-center justify-between">
                 Kegiatan Mendatang
                 <Link href="/jadwal" className="text-blue-500 font-bold text-xs flex items-center">Lihat Semua <span className="material-icons-round text-[14px]">chevron_right</span></Link>
              </h3>
              
              {upcomingEvents.length > 0 ? (
                 <div className="w-[calc(100%+3rem)] -ml-6 px-6 pb-4 flex overflow-x-auto snap-x snap-mandatory scrollbar-hide gap-4 items-stretch">
                   {upcomingEvents.map((evt) => (
                     <Link key={evt.id} href={`/jadwal/${evt.id}`} className="snap-center shrink-0 w-[280px] bg-white rounded-3xl flex flex-col shadow-sm border border-slate-100 relative overflow-hidden group">
                        {evt.url_banner ? (
                          <div className="w-full h-32 bg-slate-100 relative overflow-hidden shrink-0 border-b border-slate-100">
                            <img src={evt.url_banner} alt="Poster" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                            {evt.butuh_registrasi && (
                               <span className="absolute top-3 right-3 bg-white/90 backdrop-blur text-blue-600 text-[10px] font-bold px-2 py-1 rounded shadow-sm">Butuh Registrasi</span>
                            )}
                          </div>
                        ) : (
                          <div className="w-full h-20 bg-gradient-to-r from-blue-500 to-indigo-600 relative overflow-hidden shrink-0 flex items-center px-5">
                            <span className="material-icons-round text-white/20 text-6xl absolute -right-4 -top-2">event</span>
                            <span className="bg-white/20 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded border border-white/20 uppercase tracking-widest">{evt.nama_jenis_kegiatan}</span>
                          </div>
                        )}
                        
                        <div className="p-5 flex flex-col flex-1">
                          {!evt.url_banner && (
                             <div className="mb-2">
                               {evt.butuh_registrasi && <span className="bg-blue-50 text-blue-600 text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-widest border border-blue-100">REGISTRASI</span>}
                             </div>
                          )}
                          <h4 className="text-slate-900 font-black text-[15px] leading-snug mb-3 group-hover:text-blue-600 transition-colors line-clamp-2">{evt.nama_kegiatan}</h4>
                          
                          <div className="flex flex-col gap-1.5 mb-4">
                             <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium">
                                <span className="material-icons-round text-[14px] text-slate-400">calendar_today</span>
                                <span className="truncate">{formatDate(evt.tanggal_mulai)}</span>
                             </div>
                             <div className="flex items-center gap-2 text-slate-500 text-[11px] font-medium">
                                <span className="material-icons-round text-[14px] text-slate-400">place</span>
                                <span className="truncate">{evt.lokasi_kegiatan || 'Gedung GSJA'}</span>
                             </div>
                          </div>

                          <div className="mt-auto pt-3 border-t border-slate-100/60 flex items-center justify-between pointer-events-none">
                             <span className="text-[11px] font-bold text-slate-400">{evt.waktu_mulai.slice(0,5)} WIB</span>
                             <span className="material-icons-round text-slate-300 text-[18px] group-hover:text-blue-500 transition-colors">arrow_forward</span>
                          </div>
                        </div>
                     </Link>
                   ))}
                   <div className="w-2 shrink-0"></div> {/* Trailing spacer */}
                 </div>
              ) : (
                 <div className="w-full bg-slate-100/50 rounded-3xl p-6 flex flex-col items-center justify-center text-center border border-slate-200 border-dashed">
                    <span className="material-icons-round text-4xl text-slate-300 mb-2">event_available</span>
                    <span className="text-sm font-bold text-slate-500">Belum Ada Acara Mendatang</span>
                 </div>
              )}
           </div>

        </div>
      </div>
    );
  }

  // --- TAMPILAN ADMIN (SEKRETARIS) ---
  return null; 
}
