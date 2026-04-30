'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

// Icon Map based on Jenis Kegiatan
const iconMap: Record<string, string> = {
  'Bimbingan Pranikah': 'people',
  'Pernikahan': 'favorite',
  'Kunjungan Sakit': 'local_hospital',
  'Besuk Orang Sakit': 'local_hospital',
  'Konseling': 'forum',
  'Doa Syukur': 'volunteer_activism',
  'Doa Khusus': 'volunteer_activism',
  'Pemberkatan Rumah': 'home',
  'Layanan Kedukaan': 'church',
  'Kunjungan Penjara': 'shield'
};

// Colors based on Status (matching the screenshot logic)
const statusMap: Record<string, { badgeBg: string, badgeText: string, borderLeft: string, iconColor: string, iconBg: string }> = {
  'Belum Ditangani': { 
    badgeBg: 'bg-rose-100', badgeText: 'text-rose-700', borderLeft: 'border-l-rose-600', iconColor: 'text-rose-600', iconBg: 'bg-rose-50' 
  },
  'Menunggu': { 
    badgeBg: 'bg-orange-100', badgeText: 'text-orange-700', borderLeft: 'border-l-orange-500', iconColor: 'text-orange-600', iconBg: 'bg-orange-50' 
  },
  'Ditugaskan': { 
    badgeBg: 'bg-amber-100', badgeText: 'text-amber-700', borderLeft: 'border-l-amber-500', iconColor: 'text-amber-600', iconBg: 'bg-amber-50' 
  },
  'Ditindaklanjuti': { 
    badgeBg: 'bg-indigo-100', badgeText: 'text-indigo-700', borderLeft: 'border-l-indigo-600', iconColor: 'text-indigo-600', iconBg: 'bg-indigo-50' 
  },
  'Selesai': { 
    badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-700', borderLeft: 'border-l-emerald-500', iconColor: 'text-emerald-600', iconBg: 'bg-emerald-50' 
  },
  'Dibatalkan': { 
    badgeBg: 'bg-slate-100', badgeText: 'text-slate-600', borderLeft: 'border-l-slate-300', iconColor: 'text-slate-500', iconBg: 'bg-slate-100' 
  }
};

export default function LayananPastoralPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState('Semua');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const res = await fetch('/api/layanan-pastoral/saya');
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            // Evaluasi status SLA (Jika Menunggu > 24 Jam jadi Belum Ditangani)
            const evaluatedTickets = json.data.map((t: any) => {
              let displayStatus = t.status;
              if (t.status === 'Menunggu') {
                const diajukan = new Date(t.tanggal_pengajuan);
                const sekarang = new Date();
                const diffHours = (sekarang.getTime() - diajukan.getTime()) / (1000 * 60 * 60);
                if (diffHours > 24) {
                  displayStatus = 'Belum Ditangani';
                }
              }
              return { ...t, displayStatus };
            });
            setTickets(evaluatedTickets);
          }
        }
      } catch (err) {
        console.error('Failed to load tickets', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTickets();
  }, []);

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(dateString));
  };

  const filteredTickets = filter === 'Semua' 
    ? tickets 
    : tickets.filter(t => 
        // Group "Belum Ditangani" into "Menunggu" tab logically, or strict match if we want it strict.
        // Assuming "Menunggu" filter shows both Menunggu and Belum Ditangani.
        (filter === 'Menunggu' && (t.displayStatus === 'Menunggu' || t.displayStatus === 'Belum Ditangani')) || 
        t.displayStatus === filter
      );

  return (
    <div className="w-full flex flex-col bg-[#F9FAFB] font-sans pb-28 relative h-full min-h-[100vh]">
      
      {/* Sticky Glass Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 pt-6 pb-4 px-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] flex flex-col gap-4">
        <div className="flex items-center gap-4">
           <Link href="/" className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors shrink-0">
             <span className="material-icons-round text-xl">arrow_back</span>
           </Link>
           <h1 className="text-xl font-black text-slate-800 tracking-tight">Permintaan Saya</h1>
        </div>
      </div>

      <div className="w-full px-5 pt-6 flex flex-col max-w-md mx-auto">
        
        {/* Title & Subtitle */}
        <div className="flex flex-col gap-1.5 mb-5 px-1">
          <h2 className="text-[28px] font-black text-slate-900 tracking-tight leading-tight">Permintaan Saya</h2>
          <p className="text-[15px] text-slate-500 leading-relaxed">
            Pantau status pelayanan pastoral Anda.
          </p>
        </div>

        {/* Filters Horizontal Scroll */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 scrollbar-hide px-1">
          {['Semua', 'Menunggu', 'Ditindaklanjuti', 'Selesai', 'Dibatalkan'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-bold transition-all ${
                filter === f
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 border border-blue-600'
                  : 'bg-slate-100 text-slate-600 border border-slate-200/60 hover:bg-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Ticket List */}
        <div className="flex flex-col gap-4">
          {isLoading ? (
            <div className="flex flex-col gap-4">
               {[1,2,3].map(i => (
                 <div key={i} className="bg-white rounded-[20px] p-5 border border-slate-100 h-[120px] animate-pulse flex flex-col gap-3">
                    <div className="flex justify-between items-center"><div className="w-32 h-4 bg-slate-200 rounded"></div><div className="w-20 h-6 bg-slate-200 rounded-full"></div></div>
                    <div className="w-48 h-6 bg-slate-200 rounded"></div>
                    <div className="w-24 h-4 bg-slate-200 rounded"></div>
                 </div>
               ))}
            </div>
          ) : filteredTickets.length > 0 ? (
            filteredTickets.map((ticket) => {
              const statusConfig = statusMap[ticket.displayStatus] || statusMap['Menunggu'];
              const iconName = iconMap[ticket.jenis_layanan] || 'spa';

              return (
                <Link href={`/layanan-pastoral/${ticket.id}`} key={ticket.id}>
                  <div className={`bg-white rounded-[20px] p-5 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.04)] border border-slate-100/80 border-l-[5px] ${statusConfig.borderLeft} flex flex-col gap-3 relative overflow-hidden active:scale-[0.98] transition-transform`}>
                    
                    {/* Top Row: Icon, Category, Status Badge */}
                    <div className="flex justify-between items-center w-full">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${statusConfig.iconBg} ${statusConfig.iconColor}`}>
                          <span className="material-icons-round text-[18px]">{iconName}</span>
                        </div>
                        <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{ticket.jenis_layanan}</span>
                      </div>
                      <div className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase ${statusConfig.badgeBg} ${statusConfig.badgeText}`}>
                        {ticket.displayStatus}
                      </div>
                    </div>

                    {/* Middle Row: Target Name */}
                    <div className="mt-1">
                      <h3 className="text-xl font-medium text-slate-800 leading-snug">{ticket.target_pelayanan}</h3>
                    </div>

                    {/* Bottom Row: Date */}
                    <div className="flex items-center gap-1.5 text-slate-500 mt-0.5">
                      <span className="material-icons-round text-[16px]">calendar_today</span>
                      <span className="text-sm font-medium">{formatDate(ticket.tanggal_pengajuan)}</span>
                    </div>

                  </div>
                </Link>
              );
            })
          ) : (
            <div className="w-full py-16 flex flex-col items-center justify-center text-center px-6 bg-white border border-slate-100 border-dashed rounded-[24px] shadow-sm mt-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                <span className="material-icons-round text-4xl text-slate-300">inbox</span>
              </div>
              <h3 className="text-lg font-bold text-slate-600 mb-2">Belum Ada Permintaan</h3>
              <p className="text-sm text-slate-400 leading-relaxed max-w-[250px]">Anda belum pernah mengajukan layanan pastoral, atau status tidak ditemukan.</p>
            </div>
          )}
        </div>

      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-24 right-5 z-50">
        <Link href="/layanan-pastoral/ajukan">
          <div className="w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-[0_8px_20px_-6px_rgba(37,99,235,0.6)] active:scale-95 transition-all">
            <span className="material-icons-round text-3xl">add</span>
          </div>
        </Link>
      </div>

    </div>
  );
}
