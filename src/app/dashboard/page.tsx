'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import QRCode from 'react-qr-code';
import { useLoader } from '@/components/ui/GlobalLoader';

export default function DashboardHome() {
  const [userData, setUserData] = useState<any>(null);
  const [nearestEvent, setNearestEvent] = useState<any>(null);
  const [isFullscreenQR, setIsFullscreenQR] = useState(false);
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

  // --- TAMPILAN JEMAAT (PWA SUPER APP) ---
  if (userData?.role_name?.toLowerCase() === 'jemaat') {
    const jemaatName = userData.email?.split('@')[0] || 'Jemaat';
    const qrPayload = JSON.stringify({ type: 'JEMAAT', id: userData.jemaat_id });

    return (
      <div className="w-full h-full flex flex-col bg-slate-50 overflow-y-auto">
        
        {/* Fullscreen QR Toggle Context */}
        {isFullscreenQR && (
          <div 
            className="fixed inset-0 bg-white z-[9999] flex flex-col items-center justify-center p-8 animate-in zoom-in-95 duration-200"
            onClick={() => setIsFullscreenQR(false)}
          >
             <div className="text-center mb-8 flex flex-col items-center">
                <span className="material-icons-round text-blue-500 text-6xl mb-2">check_circle</span>
                <h2 className="text-2xl font-black text-slate-800">Scan QR Presensi</h2>
                <p className="text-slate-500 mt-2 text-sm max-w-xs">Arahkan layar HP Anda ke perangkat Kiosk Usher di pintu masuk.</p>
             </div>
             <div className="bg-white p-6 rounded-3xl shadow-2xl border border-slate-100 flex items-center justify-center">
                <QRCode value={qrPayload} size={280} level="H" />
             </div>
             <p className="fixed bottom-12 text-slate-400 font-bold tracking-widest text-xs uppercase animate-pulse">Ketuk Layar Untuk Menutup</p>
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
           
           {/* 2. HERO CARD (DIGITAL IDENTITY & QR) */}
           <div 
             onClick={() => setIsFullscreenQR(true)}
             className="w-full bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 flex flex-col items-center shadow-lg shadow-blue-500/30 relative overflow-hidden cursor-pointer group transition-transform active:scale-95"
           >
              {/* Ornaments */}
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none"></div>
              
              <div className="w-full flex justify-between items-start mb-4 z-10">
                 <div className="flex flex-col">
                    <span className="text-blue-100 text-xs font-bold uppercase tracking-widest mb-0.5">ID Jemaat Valid</span>
                    <span className="text-white font-black text-lg tracking-wider font-mono">{String(userData.jemaat_id).padStart(6, '0')}</span>
                 </div>
                 <span className="material-icons-round text-white/40 text-4xl group-hover:rotate-12 transition-transform">qr_code_scanner</span>
              </div>

              <div className="bg-white p-4 rounded-2xl shadow-inner z-10 mb-4 inline-flex">
                 <QRCode value={qrPayload} size={130} level="M" />
              </div>

              <p className="text-center text-blue-50 text-xs font-medium max-w-[250px] z-10 leading-relaxed">
                 Tunjukkan QR ini ke Usher di pintu, atau <span className="font-bold underline">ketuk kartu</span> untuk perbesar (*Fullscreen*).
              </p>
           </div>

           {/* 3. QUICK ACTIONS GRID */}
           <div className="w-full flex flex-col gap-3">
              <h3 className="text-slate-800 font-black text-lg tracking-tight px-1">Menu Jemaat</h3>
              <div className="grid grid-cols-4 sm:grid-cols-4 gap-y-6 gap-x-2 w-full p-5 bg-white rounded-3xl shadow-sm border border-slate-100">
                 
                 <Link href="/dashboard/kegiatan" className="flex flex-col items-center gap-2 group">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors duration-300 shadow-sm border border-blue-100/50">
                       <span className="material-icons-round text-[26px]">event</span>
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-600 text-center leading-tight">Jadwal &<br/>Acara</span>
                 </Link>

                 <div className="flex flex-col items-center gap-2 group cursor-not-allowed opacity-50 relative">
                    <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center shadow-sm border border-amber-100/50">
                       <span className="material-icons-round text-[26px]">music_note</span>
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-600 text-center leading-tight">Jadwal<br/>Pelayanan</span>
                 </div>

                 <Link href={`/dashboard/members/${userData.jemaat_id}?mode=edit`} className="flex flex-col items-center gap-2 group">
                    <div className="w-12 h-12 bg-teal-50 text-teal-600 rounded-2xl flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors duration-300 shadow-sm border border-teal-100/50">
                       <span className="material-icons-round text-[26px]">manage_accounts</span>
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-600 text-center leading-tight">Data<br/>Diri</span>
                 </Link>

                 <Link href="/dashboard/family-tree" className="flex flex-col items-center gap-2 group">
                    <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center group-hover:bg-rose-600 group-hover:text-white transition-colors duration-300 shadow-sm border border-rose-100/50">
                       <span className="material-icons-round text-[26px]">family_restroom</span>
                    </div>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-600 text-center leading-tight">Relasi<br/>Keluarga</span>
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
