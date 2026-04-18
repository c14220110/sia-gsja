'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLoader } from '@/components/ui/GlobalLoader';

export default function PelayanJadwalPage() {
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();

  const [pending, setPending] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [activeDate, setActiveDate] = useState<string>('');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [rejectModal, setRejectModal] = useState({ isOpen: false, rosterId: null as number | null, reason: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchJadwal = async () => {
    showLoader();
    try {
      const res = await fetch('/api/pelayan/jadwal-saya');
      const data = await res.json();
      if (data.success && data.is_pelayan) {
        setPending(data.pending);
        setSchedules(data.all_schedules);
        
        if (data.all_schedules.length > 0) {
            // Default to today if there is an event today, otherwise to the closest future event
            const todayStr = new Date().toISOString().substring(0, 10);
            const todayEvent = data.all_schedules.find((s: any) => s.tanggal_mulai?.substring(0, 10) === todayStr);
            if(todayEvent) {
                setActiveDate(todayStr);
            } else {
                setActiveDate(data.all_schedules[0].tanggal_mulai?.substring(0, 10));
            }
        }
      } else if (!data.is_pelayan) {
        router.replace('/'); 
      }
    } catch(err) {
      console.error(err);
    } finally {
      hideLoader();
    }
  };

  useEffect(() => {
    fetchJadwal();
  }, []);

  const handleKonfirmasi = async (id: number, status: string, reason?: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/pelayan/jadwal-saya/konfirmasi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roster_id: id, status_konfirmasi: status, alasan_absen: reason })
      });
      if(res.ok) {
        setRejectModal({ isOpen: false, rosterId: null, reason: '' });
        fetchJadwal();
      }
    } catch(err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Grouping Schedules
  const groupedSchedules = useMemo(() => {
    return schedules.reduce((acc, curr) => {
      const dateStr = curr.tanggal_mulai?.substring(0, 10) || '0000-00-00';
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(curr);
      return acc;
    }, {} as Record<string, any[]>);
  }, [schedules]);

  // Calendar Engine
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay(); // 0 is Sunday
  
  // Create calendar grid
  const calendarDays = [];
  // Fill empty start days
  const prevMonthDays = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 0).getDate();
  for(let i = firstDay === 0 ? 6 : firstDay - 1; i > 0; i--) {
     calendarDays.push({ day: prevMonthDays - i + 1, isCurrentMonth: false, dateStr: null });
  }
  for(let i = 1; i <= daysInMonth; i++) {
     const dateStr = `${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
     calendarDays.push({ day: i, isCurrentMonth: true, dateStr });
  }
  const remainingCells = 42 - calendarDays.length; // 6 rows max
  for(let i = 1; i <= remainingCells; i++) {
     calendarDays.push({ day: i, isCurrentMonth: false, dateStr: null });
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateString));
  };
  
  const formatTime = (timeString: string) => timeString ? timeString.substring(0, 5) : '';

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col font-['Public_Sans'] pb-24">
      {/* Reject Modal */}
      {rejectModal.isOpen && (
         <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-5 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-xl animate-in zoom-in-95 duration-300">
               <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4 mx-auto">
                 <span className="material-icons-round text-rose-600 text-2xl">cancel</span>
               </div>
               <h3 className="text-xl font-black text-slate-800 text-center mb-2">Tolak Penugasan</h3>
               <p className="text-sm text-slate-500 text-center mb-4">Mohon sertakan alasan agar admin gereja mengetahui absen Anda.</p>
               
               <textarea 
                 value={rejectModal.reason}
                 onChange={(e) => setRejectModal({...rejectModal, reason: e.target.value})}
                 className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-5 min-h-[100px]"
                 placeholder="Contoh: Sedang keluar kota... / Sakit"
               ></textarea>

               <div className="flex gap-3">
                 <button 
                   onClick={() => setRejectModal({isOpen: false, rosterId: null, reason: ''})}
                   className="flex-1 py-3 text-slate-600 bg-slate-100 font-bold rounded-xl active:scale-95 transition-transform"
                   disabled={isSubmitting}
                 >Tutup</button>
                 <button 
                   onClick={() => handleKonfirmasi(rejectModal.rosterId!, 'Berhalangan', rejectModal.reason)}
                   className="flex-1 py-3 text-white bg-rose-600 font-bold rounded-xl shadow-sm shadow-rose-200 active:scale-95 transition-transform flex items-center justify-center disabled:opacity-70"
                   disabled={!rejectModal.reason.trim() || isSubmitting}
                 >{isSubmitting ? 'Memproses...' : 'Kirim Penolakan'}</button>
               </div>
            </div>
         </div>
      )}

      {/* Fixed Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 pt-6 pb-4 px-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3">
           <Link href="/" className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
             <span className="material-icons-round text-xl">arrow_back</span>
           </Link>
           <h1 className="text-xl font-black text-slate-800 tracking-tight">Jadwal Pelayanan</h1>
        </div>
      </div>

      <div className="w-full flex flex-col pt-6 pb-12">
        {/* RSVP Carousel Section */}
        {pending.length > 0 && (
          <div className="w-full flex flex-col mb-8 pointer-events-auto">
            <h2 className="px-6 text-[18px] font-black text-slate-900 tracking-tight mb-3">Konfirmasi Jadwal</h2>
            <div className="flex overflow-x-auto gap-4 px-6 pb-4 scrollbar-hide snap-x">
               {pending.map((item: any) => (
                  <div key={item.roster_id} className="snap-start shrink-0 w-[260px] bg-white border border-blue-200 rounded-[20px] p-4 flex flex-col shadow-[0_4px_15px_-5px_rgba(59,130,246,0.15)] relative overflow-hidden">
                     <div className="absolute top-0 left-0 w-full h-2 bg-blue-500"></div>
                     <div className="grid grid-cols-[60px_1fr] gap-x-2 gap-y-1 mb-5">
                       <span className="text-slate-500 text-xs font-bold w-full truncate">Tugas</span>
                       <span className="text-slate-800 text-xs font-bold leading-tight line-clamp-1">{item.nama_peran}</span>
                       
                       <span className="text-slate-500 text-xs font-bold truncate">Acara</span>
                       <span className="text-slate-800 text-xs font-medium leading-tight line-clamp-1">{item.nama_kegiatan}</span>
                       
                       <span className="text-slate-500 text-xs font-bold truncate">Tanggal</span>
                       <span className="text-slate-800 text-xs font-medium">{formatDate(item.tanggal_mulai)}</span>
                     </div>
                     <div className="flex gap-2.5 mt-auto">
                        <button 
                          onClick={() => handleKonfirmasi(item.roster_id, 'Hadir')}
                          className="flex-[1.2] py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm active:scale-95 transition-all text-center flex items-center justify-center disabled:opacity-70"
                          disabled={isSubmitting}
                        >Terima</button>
                        <button 
                          onClick={() => setRejectModal({isOpen: true, rosterId: item.roster_id, reason: ''})}
                          className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold active:scale-95 transition-all text-center"
                        >Tolak</button>
                     </div>
                  </div>
               ))}
            </div>
          </div>
        )}

        {/* Master Calendar */}
        <div className="px-5 mb-8">
           <div className="bg-white rounded-[24px] shadow-sm border border-slate-100 p-5 flex flex-col">
              {/* Calendar Header */}
              <div className="flex justify-between items-center mb-5 px-1">
                 <h2 className="text-lg font-black text-slate-800">
                    {new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(currentMonth)}
                 </h2>
                 <div className="flex gap-2 text-slate-400">
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full cursor-pointer">
                      <span className="material-icons-round text-lg">chevron_left</span>
                    </button>
                    <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 rounded-full cursor-pointer">
                      <span className="material-icons-round text-lg">chevron_right</span>
                    </button>
                 </div>
              </div>

              {/* Grid Days */}
              <div className="grid grid-cols-7 mb-2">
                 {['S','S','R','K','J','S','M'].map((d, i) => (
                    <div key={i} className="text-[11px] font-bold text-slate-400 text-center uppercase tracking-widest h-6">{d}</div>
                 ))}
              </div>
              
              {/* Grid Dates */}
              <div className="grid grid-cols-7 gap-y-2">
                 {calendarDays.map((cal, i) => {
                    if (!cal.isCurrentMonth) {
                       return <div key={i} className="w-full aspect-square flex items-center justify-center text-slate-300 text-[13px] font-medium">{cal.day}</div>;
                    }

                    const hasEvent = groupedSchedules[cal.dateStr!] !== undefined;
                    const isActive = activeDate === cal.dateStr;

                    return (
                       <div key={i} onClick={() => setActiveDate(cal.dateStr!)} className="w-full aspect-square flex flex-col items-center justify-center relative group cursor-pointer active:scale-90 transition-transform">
                          <div className={`w-8 h-8 flex items-center justify-center rounded-full text-sm transition-all relative z-10 ${isActive ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-200' : 'text-slate-700 font-medium group-hover:bg-blue-50'} ${hasEvent && !isActive ? 'font-bold' : ''}`}>
                             {cal.day}
                          </div>
                          {hasEvent && (
                             <div className={`w-1 h-1 rounded-full absolute bottom-[2px] transition-colors ${isActive ? 'bg-white' : 'bg-blue-400'}`}></div>
                          )}
                       </div>
                    );
                 })}
              </div>
           </div>
        </div>

        {/* Selected Date Detail (Schedule List Timeline) */}
        <div className="px-5 flex flex-col gap-5">
           {activeDate && (
             <h3 className="text-lg font-black text-slate-800 px-1 border-b border-slate-200 pb-3 -mb-1">
                Jadwal ({new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long'}).format(new Date(activeDate))})
             </h3>
           )}

           {!activeDate || !groupedSchedules[activeDate] ? (
              <div className="w-full py-16 flex flex-col items-center justify-center text-slate-400 bg-white border border-slate-100 border-dashed rounded-[20px]">
                 <span className="material-icons-round text-5xl mb-3 opacity-50">event_available</span>
                 <p className="text-sm font-medium">Bebas dari jadwal pelayanan.</p>
              </div>
           ) : (
              <div className="flex flex-col relative w-full pt-2">
                {/* Timeline vertical line */}
                <div className="absolute top-4 bottom-4 left-[9px] w-[2px] bg-slate-200/80 rounded-full z-0"></div>

                <div className="flex flex-col gap-6 w-full">
                  {groupedSchedules[activeDate].map((item: any) => (
                    <div key={item.roster_id} className="relative z-10 flex flex-col w-full animate-in slide-in-from-bottom-2 fade-in duration-300">
                      
                      {/* Timeline dot header */}
                      <div className="flex items-center gap-4 mb-2">
                        <div className="w-5 h-5 rounded-full border-[5px] border-slate-50 shadow-sm shrink-0 z-10 relative -left-[2px] bg-blue-500"></div>
                        <h4 className="text-sm font-black text-blue-600 tracking-tight uppercase">
                            Tugas: {item.nama_peran}
                        </h4>
                      </div>

                      {/* Event Cards Aesthetics borrowed from Jadwal */}
                      <div className="pl-[34px] w-full">
                        <div className="bg-white rounded-[20px] p-4 border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col gap-1 relative overflow-hidden group">
                           {/* Status label (e.g. jika sudah konfirmasi hadir) */}
                           {item.status_konfirmasi !== 'Menunggu Konfirmasi' && (
                             <div className="absolute top-0 right-0 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase px-2.5 py-1 rounded-bl-lg tracking-wider">
                                {item.status_konfirmasi}
                             </div>
                           )}

                           <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 opacity-80">Acara</div>
                           <h3 className="text-base font-black text-slate-800 leading-snug line-clamp-2 mb-2 pr-16">{item.nama_kegiatan}</h3>
                           
                           <div className="flex flex-col gap-1.5 mt-1.5">
                              <div className="flex items-center gap-2.5 bg-slate-50/80 p-2 rounded-xl">
                                <span className="w-6 h-6 rounded-md bg-blue-100 flex items-center justify-center shrink-0">
                                   <span className="material-icons-round text-[14px] text-blue-600">schedule</span>
                                </span>
                                <div className="flex flex-col">
                                   <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">Waktu</span>
                                   <span className="text-xs font-black text-slate-700">{formatTime(item.waktu_mulai)} WIB</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2.5 bg-slate-50/80 p-2 rounded-xl">
                                <span className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                                   <span className="material-icons-round text-[14px] text-emerald-600">place</span>
                                </span>
                                <div className="flex flex-col min-w-0">
                                   <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">Lokasi</span>
                                   <span className="text-xs font-bold text-slate-700 truncate">{item.lokasi_kegiatan || 'Utama'}</span>
                                </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
           )}
        </div>
      </div>
    </div>
  );
}
