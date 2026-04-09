'use client';
import { useEffect, useState } from 'react';
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

  return (
    <div className="w-full h-full flex flex-col bg-slate-50 overflow-y-auto">
      
      {/* Header */}
      <div className="w-full px-6 pt-8 pb-8 bg-white flex flex-col rounded-b-3xl shadow-sm z-10 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 rounded-bl-full pointer-events-none"></div>
        <button onClick={() => router.push('/dashboard')} className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 active:scale-95 transition-all mb-4 relative z-10">
           <span className="material-icons-round">arrow_back</span>
        </button>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight mb-2 relative z-10">Tiket Saya</h1>
        <p className="text-sm text-slate-500 leading-relaxed relative z-10">Daftar kegiatan yang Anda daftarkan. Ketuk tiket Anda untuk melihat instruksi dan detail penyelesaian.</p>
      </div>

      <div className="w-full px-6 flex flex-col gap-5 pb-24">
          {tickets.length > 0 ? tickets.map((t) => (
             <button key={t.id} onClick={() => setSelectedTicket(t)} className="w-full bg-white rounded-3xl p-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] border border-slate-100 flex gap-4 active:scale-95 transition-transform text-left">
                
                {/* Left Date Block */}
                <div className="w-16 h-20 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col items-center justify-center shrink-0 shadow-inner">
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(t.tanggal_mulai))}</span>
                   <span className="text-2xl font-black text-slate-800 leading-none">{new Date(t.tanggal_mulai).getDate()}</span>
                </div>
                
                {/* Center Info */}
                <div className="flex flex-col flex-1 pb-1 justify-center">
                   <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded tracking-widest">{t.kode_kegiatan}</span>
                   </div>
                   <h3 className="font-black text-slate-900 text-sm leading-tight mb-1 line-clamp-2">{t.nama_kegiatan}</h3>
                   <div className="flex flex-col gap-0.5 mt-1">
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                         <span className="material-icons-round text-[13px] text-slate-400">schedule</span>
                         <span className="truncate">{t.waktu_mulai.slice(0,5)} WIB</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium">
                         <span className="material-icons-round text-[13px] text-slate-400">place</span>
                         <span className="truncate">{t.lokasi_kegiatan || 'GSJA Eben Haezer'}</span>
                      </div>
                   </div>
                </div>
 
                {/* Right Status */}
                <div className="w-[85px] flex flex-col justify-center border-l border-slate-100 pl-3 py-1 shrink-0 items-center">
                   {t.is_checked_in ? (
                      <>
                        <div className="w-10 h-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-500 border border-indigo-100 mb-1">
                           <span className="material-icons-round text-[20px]">how_to_reg</span>
                        </div>
                        <span className="text-[9px] font-bold text-indigo-600 tracking-wide text-center">HADIR</span>
                      </>
                   ) : t.status_pembayaran === 'Paid' ? (
                      <>
                        <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-100 mb-1">
                           <span className="material-icons-round text-[20px]">verified</span>
                        </div>
                        <span className="text-[9px] font-bold text-emerald-600 tracking-wide text-center">LUNAS</span>
                      </>
                   ) : (
                      <>
                        <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center text-amber-500 border border-amber-100 mb-1">
                           <span className="material-icons-round text-[20px]">hourglass_empty</span>
                        </div>
                        <span className="text-[9px] font-bold text-amber-600 tracking-wide text-center leading-tight">MENUNGGU<br/>BAYAR</span>
                      </>
                   )}
                </div>
             </button>
          )) : (
            <div className="w-full py-20 flex flex-col items-center justify-center text-center opacity-50 px-6">
               <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
                 <span className="material-icons-round text-5xl text-slate-300">local_activity_outline</span>
               </div>
               <h3 className="text-lg font-bold text-slate-600 mb-2">Belum Memiliki Tiket</h3>
               <p className="text-sm text-slate-400 leading-relaxed max-w-[200px]">Anda belum mendaftar di kegiatan manapun. Temukan acara terbaru di menu Jadwal!</p>
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
