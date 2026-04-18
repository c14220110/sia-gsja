'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';

export default function TiketDanRegistrasiPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any>(null);
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();

  useEffect(() => {
    const fetchTickets = async () => {
      showLoader();
      try {
        const res = await fetch('/api/kegiatan/registrasi/saya');
        if (res.ok) {
           const result = await res.json();
           if(result.success) setTickets(result.data);
        }
      } catch (err) {
        console.error('Failed fetching tickets', err);
      } finally {
        hideLoader();
      }
    };
    fetchTickets();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(dateString));
  };

  const formatTime = (timeString: string) => timeString ? timeString.substring(0, 5) : '';

  // 1. Group tickets by date to match the Timeline aesthetic
  const groupedTickets = useMemo(() => {
    return tickets.reduce((acc, curr) => {
      const dateStr = curr.tanggal_mulai?.substring(0, 10) || '0000-00-00';
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(curr);
      return acc;
    }, {} as Record<string, any[]>);
  }, [tickets]);

  const sortedDates = Object.keys(groupedTickets).sort();

  return (
    <div className="w-full min-h-screen flex flex-col bg-slate-50 overflow-y-auto font-sans pb-24">
      
      {/* Sticky Glass Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 pt-6 pb-4 px-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3">
           <Link href="/" className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
             <span className="material-icons-round text-xl">arrow_back</span>
           </Link>
           <h1 className="text-xl font-black text-slate-800 tracking-tight">Tiket Saya</h1>
        </div>
      </div>

      <div className="w-full px-5 flex flex-col gap-5 pt-6">
          {sortedDates.length > 0 ? (
             <div className="flex flex-col relative w-full pt-2">
               {/* Timeline vertical line */}
               <div className="absolute top-4 bottom-4 left-[9px] w-[2px] bg-slate-200/80 rounded-full z-0"></div>

               <div className="flex flex-col gap-8 w-full">
                 {sortedDates.map((dateStr) => {
                    const dateObj = new Date(dateStr);
                    const isToday = new Date().toISOString().substring(0,10) === dateStr;

                    return (
                      <div key={dateStr} className="relative z-10 flex flex-col w-full animate-in slide-in-from-bottom-4 fade-in duration-500">
                        
                        {/* Timeline Date Header */}
                        <div className="flex items-center gap-4 mb-4">
                           <div className={`w-5 h-5 rounded-full border-4 border-slate-50 shadow-sm shrink-0 z-10 relative -left-[2px] transition-colors ${isToday ? 'bg-violet-500' : 'bg-slate-300'}`}></div>
                           <div className="flex items-baseline gap-2">
                             <h2 className={`text-base font-black ${isToday ? 'text-violet-600' : 'text-slate-800'}`}>
                               {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(dateObj)}
                             </h2>
                             {isToday && <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-md">HARI INI</span>}
                           </div>
                        </div>

                        {/* Event Cards Wrapper */}
                        <div className="pl-[34px] w-full flex flex-col gap-4">
                          {groupedTickets[dateStr].map((t: any) => {
                            
                            // Determine status badge colors
                            let badgeStyle = "bg-amber-100 text-amber-700";
                            let badgeText = "MENUNGGU BAYAR";
                            if (t.is_checked_in) {
                               badgeStyle = "bg-indigo-100 text-indigo-700";
                               badgeText = "HADIR (CHECKED IN)";
                            } else if (t.status_pembayaran === 'Paid') {
                               badgeStyle = "bg-emerald-100 text-emerald-700";
                               badgeText = "LUNAS";
                            } else if (t.url_bukti_bayar) {
                               badgeStyle = "bg-blue-100 text-blue-700";
                               badgeText = "MENUNGGU VERIFIKASI";
                            }

                            return (
                              <div key={t.id} onClick={() => setSelectedTicket(t)} className="bg-white rounded-[20px] p-4 border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] flex flex-col gap-1 relative overflow-hidden group cursor-pointer active:scale-[0.98] transition-transform">
                                {/* Status Top Right Absolute Badge */}
                                <div className={`absolute top-0 right-0 text-[9px] font-black uppercase px-2.5 py-1 rounded-bl-lg tracking-wider ${badgeStyle}`}>
                                   {badgeText}
                                </div>

                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 opacity-80 mt-1">Acara</div>
                                <h3 className="text-base font-black text-slate-800 leading-snug line-clamp-2 mb-2 pr-16">{t.nama_kegiatan}</h3>
                                
                                <div className="flex items-center gap-1.5 mb-2">
                                  <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded tracking-widest uppercase">{t.kode_kegiatan}</span>
                                </div>

                                <div className="flex flex-col gap-1.5 mt-1.5">
                                   <div className="flex items-center gap-2.5 bg-slate-50/80 p-2 rounded-xl">
                                     <span className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center shrink-0">
                                        <span className="material-icons-round text-[14px] text-violet-600">schedule</span>
                                     </span>
                                     <div className="flex flex-col">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">Waktu</span>
                                        <span className="text-xs font-black text-slate-700">{formatTime(t.waktu_mulai)} WIB</span>
                                     </div>
                                   </div>
                                   
                                   <div className="flex items-center gap-2.5 bg-slate-50/80 p-2 rounded-xl">
                                     <span className="w-6 h-6 rounded-md bg-emerald-100 flex items-center justify-center shrink-0">
                                        <span className="material-icons-round text-[14px] text-emerald-600">place</span>
                                     </span>
                                     <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] text-slate-400 font-bold uppercase leading-none">Lokasi</span>
                                        <span className="text-xs font-bold text-slate-700 truncate">{t.lokasi_kegiatan || 'Satelit Utama'}</span>
                                     </div>
                                   </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    );
                 })}
               </div>
             </div>
          ) : (
            <div className="w-full py-20 flex flex-col items-center justify-center text-center px-6 bg-white border border-slate-100 border-dashed rounded-[20px] shadow-sm">
               <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                 <span className="material-icons-round text-4xl text-slate-300">local_activity</span>
               </div>
               <h3 className="text-lg font-bold text-slate-600 mb-2">Belum Memiliki Tiket</h3>
               <p className="text-sm text-slate-400 leading-relaxed max-w-[250px]">Anda belum terdaftar di kegiatan berbayar atau bermandat. Silakan telusuri Jadwal & Acara.</p>
            </div>
          )}
      </div>

      {/* Modal Detail Tiket */}
      {selectedTicket && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex flex-col justify-end animate-in fade-in" onClick={() => setSelectedTicket(null)}>
           <div className="w-full bg-white rounded-t-3xl p-6 flex flex-col animate-in slide-in-from-bottom" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
              <h3 className="text-xl font-black text-slate-800 tracking-tight mb-2">Detail Tiket Terdaftar</h3>
              
              <div className="flex flex-col gap-4 mt-2">
                 <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl flex flex-col gap-1.5">
                    <span className="text-slate-800 font-black text-sm pr-4 leading-snug">{selectedTicket.nama_kegiatan}</span>
                    <span className="text-slate-500 font-semibold text-xs flex items-center gap-1.5">
                       <span className="material-icons-round text-[14px]">event</span>
                       {new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(selectedTicket.tanggal_mulai))} • {selectedTicket.waktu_mulai.slice(0,5)} WIB
                    </span>
                 </div>

                 <div className="flex items-center justify-between border-b border-slate-100 pb-3 mt-1">
                    <span className="text-slate-500 text-sm font-medium">Status Pendaftaran</span>
                    <span className="font-bold text-slate-800">
                       {selectedTicket.status_pembayaran === 'Unpaid' && selectedTicket.url_bukti_bayar ? 'Menunggu Verifikasi Pembayaran' : (selectedTicket.status_pendaftaran || 'Terkirim')}
                    </span>
                 </div>
                 
                 <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <span className="text-slate-500 text-sm font-medium">Status Pembayaran</span>
                    <span className={`font-bold text-right leading-tight ${selectedTicket.status_pembayaran === 'Paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                       {selectedTicket.status_pembayaran === 'Paid' ? 'LUNAS' : (selectedTicket.url_bukti_bayar ? 'MENUNGGU VERIFIKASI PANITIA' : 'MENUNGGU PEMBAYARAN')}
                    </span>
                 </div>

                 {selectedTicket.is_checked_in ? (
                    <div className="bg-indigo-50 p-4 rounded-2xl mt-1 flex gap-3 border border-indigo-100">
                       <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                          <span className="material-icons-round text-[18px]">how_to_reg</span>
                       </div>
                       <p className="text-xs text-indigo-700 leading-relaxed font-medium pt-1">Anda telah tercatat Hadir (Check-in) pada tiket acara ini.</p>
                    </div>
                 ) : (
                    <div className="bg-blue-50/50 p-4 rounded-2xl mt-1 flex gap-3 border border-blue-100">
                       <span className="material-icons-round text-blue-500">qr_code_scanner</span>
                       <p className="text-xs text-slate-600 leading-relaxed font-medium pt-0.5">Beritahu panitia dan tunjukkan <strong>QR Saya</strong> (tombol bundar biru di bawah layar) untuk *Check-in* kehadiran saat tiba.</p>
                    </div>
                 )}
              </div>

              <button onClick={() => setSelectedTicket(null)} className="w-full mt-6 py-3.5 bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold rounded-xl active:scale-95 transition-all">Tutup</button>
           </div>
        </div>
      )}

    </div>
  );
}
