'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Scanner } from '@yudiel/react-qr-scanner';
import { useLoader } from '@/components/ui/GlobalLoader';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function DashboardHome() {
  const [userData, setUserData] = useState<any>(null);
  const [nearestEvent, setNearestEvent] = useState<any>(null);
  const [isFullscreenQR, setIsFullscreenQR] = useState(false);
  const [scanFeedback, setScanFeedback] = useState<{ isVisible: boolean, type: 'success' | 'error', message: string }>({ isVisible: false, type: 'success', message: '' });
  const { showLoader, hideLoader } = useLoader();

  useEffect(() => {
    const initData = async () => {
       showLoader();
       try {
         const resAuth = await fetch('/api/auth/me');
         if (resAuth.ok) {
           const uData = await resAuth.json();
           setUserData(uData);

           if (uData?.role_name?.toLowerCase() === 'jemaat') {
             const q = new URLSearchParams({ limit: '1', status: 'Akan Datang' });
             if (uData.satelit_id) q.append('satelit_id', uData.satelit_id);
             
             const resEv = await fetch(`/api/kegiatan?${q.toString()}`);
             if (resEv.ok) {
                const reqData = await resEv.json();
                if (reqData.success && reqData.data.length > 0) {
                   setNearestEvent(reqData.data[0]);
                }
             }
           }
         }
       } catch (err) {
          console.error(err);
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

  // --- TAMPILAN JEMAAT (PWA SUPER APP) ---
  if (userData?.role_name?.toLowerCase() === 'jemaat') {
    const jemaatName = userData.email?.split('@')[0] || 'Jemaat';
    const qrPayload = JSON.stringify({ type: 'JEMAAT', id: userData.jemaat_id });

    return (
      <div className="w-full h-full flex flex-col bg-slate-50 overflow-y-auto">
        
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
           
           <Link href={`/dashboard/members/${userData.jemaat_id}?mode=view`} className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center shadow-inner border border-blue-100 overflow-hidden shrink-0">
             <span className="material-icons-round text-blue-500 text-2xl">person</span>
           </Link>
        </div>

        <div className="w-full px-6 flex flex-col gap-8 pb-12 mt-6">
           
           {/* 2. HERO CARD (SCANNER TRIGGER) */}
           <div 
             onClick={() => setIsFullscreenQR(true)}
             className="w-full bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-500 rounded-3xl p-6 flex flex-col items-center shadow-lg shadow-blue-500/30 relative overflow-hidden cursor-pointer group transition-transform active:scale-95"
           >
              {/* Ornaments */}
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-sky-300/20 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="w-full flex justify-between items-start mb-2 z-10">
                 <div className="flex flex-col">
                    <span className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-0.5">Sistem Presensi GSJA</span>
                 </div>
              </div>

              <div className="w-36 h-36 bg-white/20 backdrop-blur-md border border-white/40 p-1 rounded-3xl shadow-inner z-10 mb-4 flex items-center justify-center group-hover:bg-white/30 transition-colors pointer-events-none">
                 <div className="w-full h-full text-white pointer-events-none mix-blend-plus-lighter opacity-90 group-hover:scale-110 transition-transform">
                   <DotLottieReact src="/assets/qr-scan.lottie" loop autoplay />
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
                                <Link href="/dashboard/kegiatan" className="flex flex-col items-center gap-3 group">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:shadow-md group-hover:-translate-y-1 transition-all text-blue-600">
                       <span className="material-icons-round text-3xl">event</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">Jadwal &<br/>Acara</span>
                 </Link>
                 
                 <Link href="/dashboard/pelayan" className="flex flex-col items-center gap-3 group">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:shadow-md group-hover:-translate-y-1 transition-all text-emerald-600">
                       <span className="material-icons-round text-3xl">assignment_ind</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">Jadwal<br/>Pelayanan</span>
                 </Link>

                 <Link href="/dashboard/kehadiran" className="flex flex-col items-center gap-3 group">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:shadow-md group-hover:-translate-y-1 transition-all text-amber-600">
                       <span className="material-icons-round text-3xl">history</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">Riwayat<br/>Kehadiran</span>
                 </Link>

                 <Link href="/dashboard/tiket" className="flex flex-col items-center gap-3 group">
                    <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center group-hover:shadow-md group-hover:-translate-y-1 transition-all text-violet-600">
                       <span className="material-icons-round text-3xl">local_activity</span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-600 text-center leading-tight">Tiket Saya &<br/>Kupon</span>
                 </Link>

              </div>
           </div>

           {/* 4. DYNAMIC WIDGET (Nearest Event) */}
           <div className="w-full flex flex-col gap-3">
              <h3 className="text-slate-800 font-black text-lg tracking-tight px-1 flex items-center justify-between">
                 Kegiatan Mendatang
                 <Link href="/dashboard/kegiatan" className="text-blue-500 font-bold text-xs">Lihat Semua</Link>
              </h3>
              
              {nearestEvent ? (
                 <Link href={`/dashboard/kegiatan/${nearestEvent.id}`} className="w-full bg-white rounded-3xl p-5 flex flex-col shadow-sm border border-slate-100 relative overflow-hidden group hover:shadow-md transition-all">
                    <div className="absolute right-0 top-0 w-1 rounded-bl-lg bg-blue-500 h-full"></div>
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 font-black uppercase tracking-widest text-[10px] rounded mb-3 w-fit border border-blue-100">{nearestEvent.nama_jenis_kegiatan}</span>
                    <h4 className="text-slate-900 font-black text-lg leading-tight mb-3 pr-4 group-hover:text-blue-600 transition-colors">{nearestEvent.nama_kegiatan}</h4>
                    
                    <div className="flex flex-col gap-2">
                       <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                          <span className="material-icons-round text-[16px] text-slate-400">calendar_today</span>
                          {formatDate(nearestEvent.tanggal_mulai)}
                       </div>
                       <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                          <span className="material-icons-round text-[16px] text-slate-400">schedule</span>
                          {nearestEvent.waktu_mulai.slice(0,5)} WIB
                       </div>
                       <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                          <span className="material-icons-round text-[16px] text-slate-400">place</span>
                          {nearestEvent.lokasi_kegiatan || 'Gedung GSJA'}
                       </div>
                    </div>
                 </Link>
              ) : (
                 <div className="w-full bg-slate-100/50 rounded-3xl p-6 flex flex-col items-center justify-center text-center border border-slate-200 border-dashed">
                    <span className="material-icons-round text-4xl text-slate-300 mb-2">event_available</span>
                    <span className="text-sm font-bold text-slate-500">Belum Ada Agenda Terjadwal</span>
                    <p className="text-xs text-slate-400 mt-1 max-w-[200px]">Nantikan informasi ibadah dan acara selajutnya.</p>
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
