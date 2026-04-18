'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';

export default function JadwalDanAcaraPage() {
  const [events, setEvents] = useState<any[]>([]);
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();
  
  // State untuk filter kategori (Hybrid UI)
  const [filterKategori, setFilterKategori] = useState('Semua');

  useEffect(() => {
    const fetchEvents = async () => {
      showLoader();
      try {
        // Harus explisit isi tanggal='Semua' agar tidak tertimpa default API yang membatasi hanya jadwal 'Bulan Ini'
        const q = new URLSearchParams({ limit: '50', status: 'Akan Datang', tanggal: 'Semua' });
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

  const formatDateStr = (dateString: string) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateString));
  };

  const formatTimeStr = (timeString: string) => {
    if (!timeString) return '';
    return timeString.substring(0, 5);
  };

  // 1. Filter Data (Berdasarkan Kategori Database Exact Match)
  const filteredEvents = filterKategori === 'Semua' 
    ? events 
    : events.filter(item => (item.kategori || '') === filterKategori);

  // 2. Group by Date
  const groupedEvents = filteredEvents.reduce((acc, curr) => {
    const dateStr = curr.tanggal_mulai || '0000-00-00';
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(curr);
    return acc;
  }, {} as Record<string, any[]>);

  const sortedDates = Object.keys(groupedEvents).sort();

  // 3. Auto-Thumbnail / Render Image
  const renderThumbnail = (item: any) => {
    if (item.url_banner) {
      return <img src={item.url_banner} alt="Poster" className="w-20 h-20 rounded-2xl object-cover shadow-sm bg-slate-100 shrink-0 border border-slate-100" />;
    }
    const kn = (item.kategori || '').toLowerCase();
    const nnm = (item.nama_jenis_kegiatan || '').toLowerCase();
    let bg = "bg-indigo-50", text = "text-indigo-500", icon = "church";
    if (kn.includes('sosial') || kn.includes('diakonia')) { bg = "bg-rose-50"; text = "text-rose-500"; icon = "volunteer_activism"; }
    else if (kn.includes('edukasi') || kn.includes('pelatihan')) { bg = "bg-purple-50"; text = "text-purple-500"; icon = "school"; }
    else if (nnm.includes('pemuda') || nnm.includes('youth') || nnm.includes('komsel')) { bg = "bg-orange-50"; text = "text-orange-500"; icon = "local_fire_department"; }
    else if (nnm.includes('anak') || nnm.includes('sekolah minggu')) { bg = "bg-yellow-50"; text = "text-yellow-600"; icon = "child_care"; }
    else if (kn.includes('event') || kn.includes('perayaan')) { bg = "bg-emerald-50"; text = "text-emerald-500"; icon = "celebration"; }

    return (
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shrink-0 border border-white shadow-sm transition-colors ${bg}`}>
        <span className={`material-icons-round text-3xl ${text}`}>{icon}</span>
      </div>
    );
  };

    const chips = ['Semua', 'Ibadah Rutin', 'Event & Perayaan', 'Edukasi & Pelatihan', 'Sosial & Diakonia', 'Sakramen & Layanan'];

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col font-['Public_Sans'] -mt-6 pb-20">
      
      {/* Fixed Header & Filters */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 pt-6 pb-3 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="px-5 flex items-center gap-3">
           <Link href="/" className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
             <span className="material-icons-round text-xl">arrow_back</span>
           </Link>
           <h1 className="text-xl font-black text-slate-800 tracking-tight">Jadwal & Acara</h1>
        </div>

        <div className="px-5 mt-4 flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
           {chips.map(kat => (
             <button 
               key={kat} 
               onClick={() => setFilterKategori(kat)}
               className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold border transition-all duration-200 ${filterKategori === kat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
             >
               {kat === 'Event & Perayaan' ? 'Event' : kat === 'Edukasi & Pelatihan' ? 'Edukasi' : kat === 'Sosial & Diakonia' ? 'Sosial' : kat === 'Sakramen & Layanan' ? 'Sakramen' : kat}
             </button>
           ))}
        </div>
      </div>

      {/* Content / Timeline Area */}
      <div className="px-5 py-6">
        {sortedDates.length === 0 ? (
           <div className="w-full py-20 flex flex-col items-center justify-center text-slate-400">
             <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
               <span className="material-icons-round text-4xl text-slate-300">event_busy</span>
             </div>
             <p className="text-sm font-medium text-slate-500">Belum ada acara mendatang.</p>
           </div>
        ) : (
           <div className="flex flex-col relative w-full">
             {/* Timeline vertical line */}
             <div className="absolute top-3 bottom-0 left-[9px] w-0.5 bg-slate-200/80 rounded-full z-0"></div>

             <div className="flex flex-col gap-8 w-full">
               {sortedDates.map((dateStr) => {
                  const dateObj = new Date(dateStr);
                  const isToday = new Date().toISOString().substring(0,10) === dateStr;
                  
                  return (
                    <div key={dateStr} className="relative z-10 flex flex-col w-full animate-in slide-in-from-bottom-4 fade-in duration-500">
                      {/* Timeline Date Header */}
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`w-5 h-5 rounded-full border-4 border-slate-50 shadow-sm shrink-0 z-10 relative -left-[2px] transition-colors ${isToday ? 'bg-indigo-500' : 'bg-slate-300'}`}></div>
                        <div className="flex items-baseline gap-2">
                           <h2 className={`text-base font-black ${isToday ? 'text-indigo-600' : 'text-slate-800'}`}>
                             {formatDateStr(dateStr)}
                           </h2>
                           {isToday && <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-md">HARI INI</span>}
                        </div>
                      </div>

                      {/* Event Cards Wrapper */}
                      <div className="flex flex-col gap-4 pl-[34px] w-full">
                        {groupedEvents[dateStr].map((item: any) => (
                          <div key={item.id} className="bg-white rounded-[20px] p-3.5 border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col gap-3 group relative overflow-hidden transition-all hover:shadow-md">
                             {/* Left Accent line */}
                             <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"></div>

                             <div className="flex gap-3.5 items-start">
                               {renderThumbnail(item)}
                               
                               <div className="flex flex-col flex-1 min-w-0 pt-0.5">
                                  <div className="flex justify-between items-start mb-1 gap-2">
                                     <span className="text-[10px] font-black tracking-wider text-indigo-600 uppercase truncate pr-2 bg-indigo-50 px-2 py-0.5 rounded-md w-fit">
                                       {item.nama_jenis_kegiatan || 'Umum'}
                                     </span>
                                     {item.status_kegiatan === 'Ongoing' && (
                                       <span className="px-1.5 py-0.5 bg-red-500 text-white text-[9px] font-black rounded-md animate-pulse shadow-sm whitespace-nowrap">LIVE</span>
                                     )}
                                  </div>
                                  <h3 className="text-[15px] font-black text-slate-800 leading-snug line-clamp-2">{item.nama_kegiatan}</h3>
                                  
                                  <div className="flex flex-col gap-1.5 mt-2.5">
                                     <div className="flex items-center gap-2">
                                       <span className="material-icons-round text-[14px] text-slate-400">schedule</span>
                                       <span className="text-[12px] font-bold text-slate-600">{formatTimeStr(item.waktu_mulai)} WIB {item.waktu_selesai ? `- ${formatTimeStr(item.waktu_selesai)}` : ''}</span>
                                     </div>
                                     <div className="flex items-center gap-2">
                                       <span className="material-icons-round text-[14px] text-slate-400 shrink-0">place</span>
                                       <span className="text-[12px] font-medium text-slate-600 truncate">{item.lokasi_kegiatan || '-'}</span>
                                     </div>
                                  </div>
                               </div>
                             </div>

                             {/* Action Buttons */}
                             <div className="flex gap-2 mt-1 pt-3 border-t border-slate-100/80">
                               <Link href={`/jadwal/${item.id}`} className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl flex items-center justify-center gap-1.5 text-slate-600 transition-colors">
                                   <span className="text-[13px] font-bold">Lihat Detail</span>
                               </Link>
                               {item.butuh_registrasi && (
                                 <Link href={`/jadwal/${item.id}`} className="flex-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 rounded-xl flex items-center justify-center gap-1.5 text-indigo-700 transition-colors">
                                     <span className="material-icons-round text-[16px]">confirmation_num</span>
                                     <span className="text-[13px] font-black">Daftar / RSVP</span>
                                 </Link>
                               )}
                             </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
               })}
             </div>
           </div>
        )}
      </div>
    </div>
  );
}
