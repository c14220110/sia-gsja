'use client';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLoader } from '@/components/ui/GlobalLoader';

export default function RiwayatKehadiranPage() {
  const router = useRouter();
  const { showLoader, hideLoader } = useLoader();

  const [records, setRecords] = useState<any[]>([]);
  const [filterChip, setFilterChip] = useState('Semua');

  useEffect(() => {
    const fetchRiwayat = async () => {
      showLoader();
      try {
        const res = await fetch('/api/riwayat-kehadiran');
        const data = await res.json();
        if (data.success) {
          setRecords(data.data);
        }
      } catch (err) {
        console.error(err);
      } finally {
        hideLoader();
      }
    };
    fetchRiwayat();
  }, []);

  // Compute Gamification Stats for Current Month
  const stats = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let jemaatCount = 0;
    let pelayanCount = 0;

    records.forEach(r => {
      const d = new Date(r.waktu_hadir);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        if (r.role_kehadiran === 'Jemaat') {
          jemaatCount++;
        } else if (r.role_kehadiran && r.role_kehadiran !== 'Tamu') {
          pelayanCount++;
        }
      }
    });

    return { jemaatCount, pelayanCount };
  }, [records]);

  // Apply Chip Filters
  const filteredRecords = useMemo(() => {
    return records.filter(item => {
      if (filterChip === 'Semua') return true;
      if (filterChip === 'Pelayanan') return item.role_kehadiran && item.role_kehadiran !== 'Jemaat' && item.role_kehadiran !== 'Tamu';
      if (filterChip === 'Event') return item.kategori?.includes('Event') || item.kategori?.includes('Perayaan') || item.kategori?.includes('Sosial');
      if (filterChip === 'Ibadah') return item.kategori?.includes('Ibadah');
      return true;
    });
  }, [records, filterChip]);

  // Helpers
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    return new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(dateStr));
  };
  const formatTime = (timeStr: string) => timeStr ? timeStr.substring(0, 5) : '';

  const getEventIcon = (kategori: string) => {
    const k = (kategori || '').toLowerCase();
    if (k.includes('ibadah')) return { icon: 'menu_book', color: 'text-indigo-500', bg: 'bg-indigo-50' };
    if (k.includes('event')) return { icon: 'event_available', color: 'text-emerald-500', bg: 'bg-emerald-50' };
    return { icon: 'people', color: 'text-blue-500', bg: 'bg-blue-50' };
  };

  const chips = ['Semua', 'Ibadah', 'Event', 'Pelayanan'];

  return (
    <div className="w-full min-h-screen bg-slate-50 flex flex-col font-['Public_Sans'] pb-24">
      {/* ── HEADER ── */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200/60 pt-6 pb-4 px-5 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center gap-3 mb-5">
           <Link href="/" className="w-10 h-10 rounded-full flex items-center justify-center bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors">
             <span className="material-icons-round text-xl">arrow_back</span>
           </Link>
           <h1 className="text-xl font-black text-slate-800 tracking-tight">Riwayat Kehadiran</h1>
        </div>

        {/* ── STATISTIK (GAMIFIKASI) ── */}
        <div className="w-full grid grid-cols-2 gap-3 mb-4">
           <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col shadow-sm">
              <span className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Kehadiran Bulan Ini</span>
              <div className="flex items-end gap-2">
                 <h2 className="text-3xl font-black text-slate-800 leading-none">{stats.jemaatCount}x</h2>
                 <span className="text-xs font-bold text-slate-500 mb-0.5">Jemaat</span>
              </div>
           </div>
           <div className="bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl p-4 flex flex-col shadow-md shadow-blue-500/20">
              <span className="text-blue-200 text-xs font-bold uppercase tracking-wider mb-1">Pelayanan Bulan Ini</span>
              <div className="flex items-end gap-2">
                 <h2 className="text-3xl font-black text-white leading-none">{stats.pelayanCount}x</h2>
                 <span className="text-xs font-bold text-blue-100 mb-0.5">Tugas</span>
              </div>
           </div>
        </div>

        {/* ── FILTER CHIPS ── */}
        <div className="flex overflow-x-auto gap-2 pb-1 pt-1 scrollbar-hide">
           {chips.map(kat => (
             <button 
               key={kat} 
               onClick={() => setFilterChip(kat)}
               className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-bold border transition-all duration-200 ${filterChip === kat ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
             >
               {kat}
             </button>
           ))}
        </div>
      </div>

      {/* ── LIST AREA ── */}
      <div className="px-5 py-6 flex flex-col gap-4">
        {filteredRecords.length === 0 ? (
          <div className="w-full py-16 flex flex-col items-center justify-center text-slate-400 bg-white border border-slate-100 border-dashed rounded-[20px]">
             <span className="material-icons-round text-5xl mb-3 opacity-50">history</span>
             <p className="text-sm font-medium">Belum ada riwayat tercatat.</p>
          </div>
        ) : (
          filteredRecords.map((item: any) => {
            const isPelayan = item.role_kehadiran && item.role_kehadiran !== 'Jemaat' && item.role_kehadiran !== 'Tamu';
            const iconConfig = getEventIcon(item.kategori || '');

            return (
              <div key={item.absensi_id} className="bg-white rounded-[20px] p-4 border border-slate-200/60 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)] w-full flex gap-3 relative overflow-hidden group hover:shadow-md transition-shadow">
                 
                 {/* Left Icon Panel */}
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 mt-1 ${iconConfig.bg}`}>
                    <span className={`material-icons-round ${iconConfig.color} text-2xl`}>{iconConfig.icon}</span>
                 </div>
                 
                 {/* Right Data Panel */}
                 <div className="flex-1 min-w-0 pr-16 flex flex-col justify-center">
                    <h3 className="text-[15px] font-black text-slate-900 leading-snug line-clamp-2 mb-1">{item.nama_kegiatan}</h3>
                    
                    <div className="flex flex-col gap-0.5">
                       <span className="text-[12px] font-medium text-slate-500 truncate">
                         {formatDate(item.waktu_hadir)}
                       </span>
                       <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[11px] font-bold text-slate-400"><i className="material-icons-round text-[12px] align-middle mr-1">schedule</i>{formatTime(item.waktu_mulai)} WIB</span>
                          <span className="text-slate-300">•</span>
                          <span className="text-[11px] font-bold text-slate-400 truncate"><i className="material-icons-round text-[12px] align-middle mr-1">place</i>{item.lokasi_kegiatan || 'Satelit'}</span>
                       </div>
                    </div>
                 </div>

                 {/* Role Badge Absolute */}
                 <div className="absolute top-4 right-4 flex items-center">
                    {isPelayan ? (
                       <div className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm border border-emerald-200/50">
                          <span className="material-icons-round text-[12px]">verified_user</span>
                          <span className="text-[10px] font-black uppercase tracking-wider">{item.role_kehadiran}</span>
                       </div>
                    ) : (
                       <div className="bg-slate-100 text-slate-500 px-2.5 py-1 rounded-lg flex items-center gap-1">
                          <span className="material-icons-round text-[12px]">person</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider">Jemaat</span>
                       </div>
                    )}
                 </div>

              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
