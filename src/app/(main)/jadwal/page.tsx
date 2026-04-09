'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';

export default function JadwalDanAcaraPage() {
  const [events, setEvents] = useState<any[]>([]);
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  useEffect(() => {
    const fetchEvents = async () => {
      showLoader();
      try {
        // Hanya ambil kegiatan yang di publikasi dan akan datang (Bulan Ini atau Mendatang lebih besar dari hari ini)
        const q = new URLSearchParams({ limit: '50', status: 'Akan Datang' });
        const res = await fetch(`/api/kegiatan?${q.toString()}`);
        if (res.ok) {
           const result = await res.json();
           if (result.success) setEvents(result.data);
        }
      } catch (err) {
        console.error('Failed fetching events', err);
      } finally {
        hideLoader();
      }
    };
    fetchEvents();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateString));
  };

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 overflow-y-auto">
       
      {/* Header */}
      <div className="w-full px-6 pt-8 pb-8 bg-white flex flex-col rounded-b-3xl shadow-sm z-10 mb-6">
        <button onClick={() => router.push('/dashboard')} className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition-all mb-4">
           <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2 relative z-10">Jadwal & Acara</h1>
        <p className="text-sm text-slate-500 leading-relaxed relative z-10">Jelajahi dan ikuti berbagai kegiatan kerohanian dan kebersamaan keluarga besar GSJA.</p>
      </div>

      <div className="w-full px-6 flex flex-col gap-6 pb-24">
         {events.length > 0 ? events.map((evt) => (
           <Link key={evt.id} href={`/jadwal/${evt.id}`} className="w-full bg-white rounded-3xl p-5 flex flex-col shadow-sm border border-slate-100 relative overflow-hidden group active:scale-[0.98] transition-transform">
             {/* Decor */}
             <div className="absolute right-0 top-0 w-1.5 rounded-bl-lg bg-blue-500 h-full"></div>

             {evt.url_banner ? (
               <div className="w-full h-40 bg-slate-100 rounded-xl relative overflow-hidden mb-5 shrink-0 shadow-sm border border-slate-100">
                 <img src={evt.url_banner} alt="Kegiatan" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                 <span className="absolute bottom-3 right-3 bg-black/60 backdrop-blur text-white text-[10px] uppercase font-bold px-2 py-1 rounded border border-white/20 tracking-widest">{evt.nama_jenis_kegiatan}</span>
                 {evt.butuh_registrasi && (
                    <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-2.5 py-1.5 rounded-lg shadow-sm border border-white/50 flex items-center gap-1.5">
                       <span className="material-icons-round text-[12px] text-blue-600">confirmation_number</span>
                       <span className="text-[9px] font-bold text-blue-700 tracking-wide uppercase">Wajib Daftar</span>
                    </div>
                 )}
               </div>
             ) : (
                <div className="w-full h-40 bg-gradient-to-br from-indigo-50 to-blue-100 rounded-xl relative overflow-hidden mb-5 shrink-0 shadow-sm border border-slate-100 flex items-center justify-center">
                   <div className="absolute right-0 top-0 w-full h-full bg-white/40 pattern-grid"></div>
                   <span className="material-icons-round text-blue-300 text-6xl absolute -left-4 -bottom-4 opacity-50">event</span>
                   
                   <div className="relative z-10 flex flex-col items-center">
                      <span className="bg-white/80 backdrop-blur text-blue-800 text-[11px] font-black px-3 py-1.5 rounded-lg uppercase tracking-widest border border-blue-200/50 shadow-sm">
                         {evt.nama_jenis_kegiatan}
                      </span>
                   </div>
                   
                   {evt.butuh_registrasi && (
                     <div className="absolute top-3 left-3 bg-white/95 backdrop-blur px-2.5 py-1.5 rounded-lg shadow-sm border border-white/50 flex items-center gap-1.5">
                        <span className="material-icons-round text-[12px] text-blue-600">confirmation_number</span>
                        <span className="text-[9px] font-bold text-blue-700 tracking-wide uppercase">Wajib Daftar</span>
                     </div>
                   )}
                </div>
             )}

             <h2 className="text-lg font-black text-slate-900 mb-4 pr-4 line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">{evt.nama_kegiatan}</h2>

             <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/50">
                     <span className="material-icons-round text-[16px]">calendar_today</span>
                   </div>
                   <div className="flex flex-col justify-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Tanggal</span>
                      <span className="text-xs font-bold text-slate-700">{formatDate(evt.tanggal_mulai)}</span>
                   </div>
                </div>
                
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100/50">
                     <span className="material-icons-round text-[16px]">schedule</span>
                   </div>
                   <div className="flex flex-col justify-center">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-0.5">Pukul</span>
                      <span className="text-xs font-bold text-slate-700">{evt.waktu_mulai.slice(0,5)} WIB</span>
                   </div>
                </div>

                <div className="flex items-start gap-3 mt-1">
                   <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100/50">
                     <span className="material-icons-round text-[16px]">place</span>
                   </div>
                   <div className="flex flex-col justify-center pt-1.5">
                      <span className="text-xs font-bold text-slate-700 leading-snug pr-2">{evt.lokasi_kegiatan || 'Gedung Pribadi GSJA'}</span>
                   </div>
                </div>
             </div>

           </Link>
         )) : (
            <div className="w-full py-16 flex flex-col items-center justify-center text-center opacity-70 bg-white rounded-3xl border border-slate-200 border-dashed">
               <span className="material-icons-round text-5xl text-slate-300 mb-3">event_busy</span>
               <h3 className="text-sm font-bold text-slate-600 mb-1">Katalog Kosong</h3>
               <p className="text-xs text-slate-400 max-w-[200px]">Belum ada jadwal yang dipublikasikan.</p>
            </div>
         )}
      </div>
    </div>
  );
}
