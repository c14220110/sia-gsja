'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function SurveiListPage() {
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Data State
  const [data, setData] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalSurvei, setTotalSurvei] = useState(0);
  const [totalResponden, setTotalResponden] = useState(0);
  const [rataRataSkor, setRataRataSkor] = useState(0);

  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTipe, setFilterTipe] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  // User data for permission
  const [userData, setUserData] = useState<any>(null);
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = await res.json();
          setUserData(json);
        }
      } catch {}
    };
    fetchUser();
  }, []);

  const hasPermission = (perm: string) => userData?.is_super_admin || userData?.permissions?.includes?.(perm);

  // Redirect jemaat
  useEffect(() => {
    if (userData?.role_name?.toLowerCase() === 'jemaat') router.replace('/jadwal');
  }, [userData, router]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterStatus, filterTipe]);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.append('search', debouncedSearch);
        if (filterStatus) queryParams.append('status', filterStatus);
        if (filterTipe) queryParams.append('tipe_survei', filterTipe);
        queryParams.append('limit', limit.toString());
        queryParams.append('offset', ((currentPage - 1) * limit).toString());

        const res = await fetch(`/api/survei?${queryParams.toString()}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setData(result.data);
            setTotalItems(result.meta.total);
            setTotalSurvei(result.meta.total_survei || 0);
            setTotalResponden(result.meta.total_responden || 0);
            setRataRataSkor(result.meta.rata_rata_skor || 0);
          } else {
            setSubmitState({ status: 'error', message: result.message || 'Gagal memuat data' });
          }
        } else {
          const errResult = await res.json().catch(() => ({}));
          setSubmitState({ status: 'error', message: errResult.message || `API Error: ${res.status}` });
        }
      } catch (error) {
        console.error('Failed to fetch survei data', error);
      } finally {
        hideLoader();
      }
    };

    fetchData();
  }, [debouncedSearch, filterStatus, filterTipe, currentPage, refreshTrigger]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  // Delete handler
  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menonaktifkan survei ini?')) return;
    setSubmitState({ status: 'loading', message: 'Menonaktifkan survei...' });
    try {
      const res = await fetch(`/api/survei/${id}`, { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: 'Survei berhasil dinonaktifkan!' });
        setRefreshTrigger(prev => prev + 1);
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal menonaktifkan survei' });
      }
    } catch (error) {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
    }
    setOpenMenuId(null);
  };

  // Push notification handler
  const handlePush = async (id: number) => {
    if (!confirm('Kirim notifikasi push ke jemaat yang belum mengisi survei ini?')) return;
    setSubmitState({ status: 'loading', message: 'Mengirim notifikasi...' });
    try {
      const res = await fetch(`/api/survei/${id}/push`, { method: 'POST' });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: result.message });
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 3000);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal mengirim notifikasi' });
      }
    } catch (error) {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
    }
    setOpenMenuId(null);
  };

  // Render Tipe Badge
  const renderTipeBadge = (tipe: string) => {
    if (tipe === 'otomatis') {
      return (
        <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap flex items-center gap-1">
          <span className="material-icons-round text-[10px]">bolt</span>Otomatis
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full border bg-purple-50 text-purple-700 border-purple-200 whitespace-nowrap flex items-center gap-1">
        <span className="material-icons-round text-[10px]">pan_tool</span>Manual
      </span>
    );
  };

  // Render Status Badge
  const renderStatusBadge = (survei: any) => {
    const now = new Date();
    const mulai = new Date(survei.periode_mulai);
    const selesai = new Date(survei.periode_selesai);
    
    if (!survei.is_active) {
      return <span className="px-2.5 py-1 text-xs font-bold rounded-full border bg-slate-100 text-slate-600 border-slate-300 whitespace-nowrap">Nonaktif</span>;
    }
    if (now < mulai) {
      return <span className="px-2.5 py-1 text-xs font-bold rounded-full border bg-amber-50 text-amber-700 border-amber-200 whitespace-nowrap">Terjadwal</span>;
    }
    if (now >= mulai && now <= selesai) {
      return (
        <span className="px-2.5 py-1 text-xs font-bold rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200 whitespace-nowrap flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Aktif
        </span>
      );
    }
    return <span className="px-2.5 py-1 text-xs font-bold rounded-full border bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">Selesai</span>;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };

  // Render star rating
  const renderStarRating = (skor: number) => {
    const rounded = Math.round(skor * 10) / 10;
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center">
          {[1, 2, 3, 4, 5].map(star => (
            <span key={star} className={`material-icons-round text-[16px] ${star <= Math.round(skor) ? 'text-amber-400' : 'text-slate-200'}`}>star</span>
          ))}
        </div>
        <span className="text-slate-700 text-sm font-bold font-['Public_Sans']">{rounded > 0 ? rounded.toFixed(1) : '-'}</span>
      </div>
    );
  };

  if (userData?.role_name?.toLowerCase() === 'jemaat') return null;

  return (
    <div className="w-full flex flex-col gap-8 pb-10 relative">
      
      {/* Submit Overlay */}
      {(submitState.status !== 'idle') && <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />}

      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Survei Kepuasan</h1>
          <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6">Kelola survei kepuasan jemaat terhadap kegiatan gereja</div>
        </div>
        {hasPermission('survei_manage') && (
          <div className="flex items-center gap-3">
            <Link
              href="/kegiatan/notifikasi"
              className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg flex justify-center items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <span className="material-icons-round text-[18px]">campaign</span>
              <span className="text-sm font-bold font-['Inter']">Broadcast Notifikasi</span>
            </Link>
            <Link
              href="/kegiatan/survei/buat"
              className="px-5 py-2.5 bg-slate-700 text-white rounded-lg flex justify-center items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm"
            >
              <span className="material-icons-round text-[18px]">add</span>
              <span className="text-sm font-bold font-['Inter']">Buat Survei Baru</span>
            </Link>
          </div>
        )}
      </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1: Total Survei Aktif */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-indigo-50 rounded-xl flex justify-center items-center">
             <span className="material-icons-round text-indigo-600 text-3xl">poll</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-['Public_Sans'] uppercase tracking-wide">TOTAL SURVEI</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">{totalSurvei}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Responden */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-blue-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-blue-600 text-3xl">groups</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-['Public_Sans'] uppercase tracking-wide">TOTAL RESPONDEN</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">{totalResponden}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Rata-rata Skor */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-amber-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-amber-600 text-3xl">stars</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-['Public_Sans'] uppercase tracking-wide">RATA-RATA SKOR CSAT</span>
            <div className="flex items-end gap-2 mt-1">
              <span className={`text-3xl font-bold font-['Public_Sans'] leading-9 ${rataRataSkor >= 4 ? 'text-emerald-600' : rataRataSkor >= 3 ? 'text-amber-600' : 'text-rose-600'}`}>{rataRataSkor > 0 ? rataRataSkor.toFixed(1) : '-'}</span>
              <span className="text-slate-400 text-sm font-medium mb-1">/ 5.0</span>
            </div>
          </div>
        </div>

      </div>

      {/* Filter Options */}
      <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">
        
        {/* Search Bar */}
        <div className="flex-1 min-w-[200px] relative flex items-center">
          <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
          <input 
            type="text" 
            placeholder="Cari judul survei..."
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Dropdown */}
        <div className="relative min-w-[150px]">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="aktif">Aktif</option>
            <option value="terjadwal">Terjadwal</option>
            <option value="selesai">Selesai</option>
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Tipe Survei Dropdown */}
        <div className="relative min-w-[150px]">
          <select 
            value={filterTipe}
            onChange={(e) => setFilterTipe(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
          >
            <option value="">Semua Tipe</option>
            <option value="otomatis">⚡ Otomatis</option>
            <option value="manual">✋ Manual</option>
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

      </div>

      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto pb-32 min-h-[480px]">
          <div className="min-w-[1000px] flex flex-col">
            {/* Table Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="flex-1 min-w-[250px] text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">JUDUL SURVEI</div>
              <div className="w-[140px] shrink-0 text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">STATUS</div>
              <div className="w-[180px] shrink-0 text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">PERIODE</div>
              <div className="w-[120px] shrink-0 text-center text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">RESPONDEN</div>
              <div className="w-[160px] shrink-0 text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">RATA-RATA SKOR</div>
              <div className="w-12 shrink-0 text-center text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">AKSI</div>
            </div>

            {/* Table Body */}
            <div>
              {data.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">poll</span>
                  <span className="text-sm font-['Public_Sans']">Belum ada survei yang dibuat.</span>
                </div>
              ) : (
                data.map((survei, idx) => {
                  const isLastRows = data.length > 5 && idx >= data.length - 2;
                  
                  return (
                <div key={survei.id} className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-blue-50/40 hover:shadow-[inset_4px_0_0_0_#3b82f6] transition-all relative ${openMenuId === survei.id ? 'z-50' : 'z-10'}`}>
                  
                  {/* Kolom 1: Judul Survei */}
                  <div className="flex-1 min-w-[250px] flex flex-col items-start justify-center pr-4 gap-0.5">
                     <div className="flex items-center gap-2">
                       <Link href={`/kegiatan/survei/${survei.id}`} className="text-slate-900 font-bold text-sm hover:text-blue-600 transition-colors">{survei.judul}</Link>
                       {renderTipeBadge(survei.tipe_survei || 'manual')}
                     </div>
                     {survei.nama_kegiatan ? (
                       <span className="text-blue-500 text-[11px] font-medium flex items-center gap-1">
                         <span className="material-icons-round text-[12px]">event</span>
                         {survei.nama_kegiatan}
                       </span>
                     ) : (
                       <span className="text-slate-400 text-[11px] font-medium italic">Survei Mandiri</span>
                     )}
                     <span className="text-slate-400 text-[11px] font-medium">{survei.nama_satelit}</span>
                  </div>
                  
                  {/* Kolom 2: Status */}
                  <div className="w-[140px] shrink-0 flex items-center justify-start pr-4">
                     {renderStatusBadge(survei)}
                  </div>
                  
                  {/* Kolom 3: Periode */}
                  <div className="w-[180px] shrink-0 flex flex-col justify-center pr-4">
                     <span className="text-slate-700 text-sm font-medium">{formatDate(survei.periode_mulai)}</span>
                     <span className="text-slate-400 text-[11px] font-medium">s/d {formatDate(survei.periode_selesai)}</span>
                  </div>

                  {/* Kolom 4: Responden */}
                  <div className="w-[120px] shrink-0 flex justify-center items-center">
                     <span className="text-slate-700 text-sm font-bold font-['Public_Sans']">{survei.total_responden || 0}</span>
                  </div>

                  {/* Kolom 5: Rata-rata Skor */}
                  <div className="w-[160px] shrink-0 flex items-center">
                     {renderStarRating(survei.avg_skor || 0)}
                  </div>

                  {/* Kolom 6: Aksi */}
                  <div className="w-12 shrink-0 flex justify-center items-center">
                    <div className="relative">
                      <button 
                        onClick={() => setOpenMenuId(openMenuId === survei.id ? null : survei.id)}
                        className="w-8 h-8 rounded-full flex justify-center items-center hover:bg-slate-200 text-slate-500 transition-colors"
                      >
                        <span className="material-icons-round text-[20px]">more_vert</span>
                      </button>

                      {openMenuId === survei.id && (
                        <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-2 z-50`}>
                          <Link href={`/kegiatan/survei/${survei.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                             <span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Hasil
                          </Link>
                          
                          {hasPermission('survei_manage') && survei.is_active && (
                            <>
                              <div className="w-full h-px bg-slate-100 my-1" />
                              <button 
                                onClick={() => handlePush(survei.id)}
                                className="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-700 text-sm flex items-center gap-2 font-medium"
                              >
                                 <span className="material-icons-round text-[18px] text-blue-500">notifications_active</span>Kirim Notifikasi
                              </button>
                            </>
                          )}

                          {hasPermission('survei_manage') && (
                            <>
                              <div className="w-full h-px bg-slate-100 my-1" />
                              <button 
                                onClick={() => handleDelete(survei.id)}
                                className="w-full text-left px-4 py-2 hover:bg-rose-50 text-rose-600 text-sm flex items-center gap-2 font-medium"
                              >
                                 <span className="material-icons-round text-[18px]">delete_outline</span>Nonaktifkan Survei
                              </button>
                            </>
                          )}
                          
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            }))}
            </div>

          </div>
        </div>

        {/* Pagination Footer */}
        {totalItems > 0 && (
          <div className="w-full px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center rounded-b-xl">
            <div className="text-slate-500 text-sm font-['Public_Sans']">
              Menampilkan {((currentPage - 1) * limit) + 1} - {Math.min(currentPage * limit, totalItems)} dari {totalItems} survei
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex justify-center items-center text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-icons-round text-[18px]">chevron_left</span>
              </button>
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg border border-slate-200 bg-white flex justify-center items-center text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-icons-round text-[18px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
