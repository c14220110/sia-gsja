'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function AdminPastoralPage() {
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Stats State
  const [data, setData] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [menunggu, setMenunggu] = useState(0);
  const [diproses, setDiproses] = useState(0);
  const [selesaiBulanIni, setSelesaiBulanIni] = useState(0);
  
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;
  
  // Filters
  const [filterStatus, setFilterStatus] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [jenisKegiatanOptions, setJenisKegiatanOptions] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  // Assign Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [picOptions, setPicOptions] = useState<any[]>([]);
  const [picSearch, setPicSearch] = useState('');
  const [debouncedPicSearch, setDebouncedPicSearch] = useState('');
  const [picRoleFilter, setPicRoleFilter] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [tanggalFix, setTanggalFix] = useState('');
  const [waktuFix, setWaktuFix] = useState('');

  // Fetch Options
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const resJenis = await fetch('/api/options?type=jenis_kegiatan');
        if (resJenis.ok) {
          const json = await resJenis.json();
          if (json.success) setJenisKegiatanOptions(json.data.filter((j: any) => j.kategori === 'Layanan Pastoral' || j.kategori === 'Sakramen & Layanan' || j.kategori === 'Sosial & Diakonia' || true)); // Fetch all or specific for pastoral
        }
      } catch (error) {
        console.error('Failed to fetch options', error);
      }
    };
    fetchOptions();
  }, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce PIC search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPicSearch(picSearch), 300);
    return () => clearTimeout(timer);
  }, [picSearch]);

  // Fetch PIC options for modal
  useEffect(() => {
    if (!assignModalOpen) return;
    const fetchPics = async () => {
      try {
        const queryParams = new URLSearchParams();
        if (debouncedPicSearch) queryParams.append('search', debouncedPicSearch);
        const res = await fetch(`/api/kegiatan/pastoral/pic-options?${queryParams.toString()}`);
        if (res.ok) {
          const json = await res.json();
          if (json.success) setPicOptions(json.data);
        }
      } catch (error) {
        console.error('Failed to fetch PICs', error);
      }
    };
    fetchPics();
  }, [assignModalOpen, debouncedPicSearch]);

  const handleAssign = async (pengurusId: number) => {
    if (!selectedTicketId) return;
    if (!tanggalFix || !waktuFix) {
      alert("Harap lengkapi Tanggal Fix dan Jam Fix terlebih dahulu!");
      return;
    }
    setAssignLoading(true);
    setSubmitState({ status: 'loading', message: 'Menugaskan Penanggung Jawab...' });
    setAssignModalOpen(false);
    try {
      const res = await fetch(`/api/kegiatan/pastoral/${selectedTicketId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pengurus_id: pengurusId, tanggal_fix: tanggalFix, waktu_fix: waktuFix })
      });
      const result = await res.json();
      if (result.success) {
        setSubmitState({ status: 'success', message: 'Penanggung Jawab berhasil ditugaskan!' });
        setRefreshTrigger(prev => prev + 1);
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal menugaskan PIC' });
      }
    } catch (error) {
      console.error(error);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan sistem' });
    } finally {
      setAssignLoading(false);
    }
  };

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterStatus, filterJenis]);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.append('search', debouncedSearch);
        if (filterStatus) queryParams.append('status', filterStatus);
        if (filterJenis) queryParams.append('jenis_layanan', filterJenis);
        
        queryParams.append('limit', limit.toString());
        queryParams.append('offset', ((currentPage - 1) * limit).toString());

        const res = await fetch(`/api/kegiatan/pastoral?${queryParams.toString()}`);
        if (res.ok) {
          const result = await res.json();
          if (result.success) {
            setData(result.data);
            setTotalItems(result.meta.total);
            setMenunggu(result.meta.menunggu || 0);
            setDiproses(result.meta.diproses || 0);
            setSelesaiBulanIni(result.meta.selesai_bulan_ini || 0);
          } else {
             setSubmitState({ status: 'error', message: result.message + " " + (result.error || '') });
          }
        } else {
           const errResult = await res.json().catch(() => ({}));
           setSubmitState({ status: 'error', message: errResult.message || `API Error: ${res.status} ${res.statusText} ${errResult.error || ''}` });
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        hideLoader();
      }
    };

    fetchData();
  }, [debouncedSearch, filterStatus, filterJenis, currentPage, refreshTrigger]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  // Render Status Badge
  const renderStatusBadge = (status: string) => {
    let colorClass = "bg-slate-100 text-slate-700 border-slate-200"; 
    
    if (status === 'Menunggu') colorClass = "bg-orange-50 text-orange-700 border-orange-200";
    else if (status === 'Belum Ditangani') colorClass = "bg-rose-50 text-rose-700 border-rose-200";
    else if (status === 'Ditugaskan') colorClass = "bg-amber-50 text-amber-700 border-amber-200";
    else if (status === 'Ditindaklanjuti') colorClass = "bg-blue-50 text-blue-700 border-blue-200";
    else if (status === 'Selesai') colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    else if (status === 'Dibatalkan') colorClass = "bg-slate-100 text-slate-600 border-slate-300";

    if (status === 'Belum Ditangani') {
      return (
        <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${colorClass} whitespace-nowrap flex items-center gap-1.5`}>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
          SLA Breached
        </span>
      );
    }

    return (
      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${colorClass} whitespace-nowrap`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date) + ' WIB';
  };

  return (
    <div className="w-full flex flex-col gap-8 pb-10 relative">
      
      {/* Submit Overlay */}
      {(submitState.status !== 'idle') && <SubmitOverlay status={submitState.status} message={submitState.message} onClose={() => setSubmitState({ status: 'idle', message: '' })} />}

      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Permohonan Pastoral</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">Manajemen Layanan Pastoral Jemaat</div>
        </div>
      </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1 */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-rose-50 rounded-xl flex justify-center items-center">
             <span className="material-icons-round text-rose-600 text-3xl">priority_high</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">MENUNGGU TINDAKAN</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{menunggu}</span>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-blue-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-blue-600 text-3xl">autorenew</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">SEDANG DIPROSES</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{diproses}</span>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-emerald-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-emerald-600 text-3xl">done_all</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-sans uppercase tracking-wide">SELESAI (BULAN INI)</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-emerald-600 text-3xl font-bold font-sans leading-9">{selesaiBulanIni}</span>
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
            placeholder="Cari No. Tiket atau Nama..."
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Status Dropdown */}
        <div className="relative min-w-[150px]">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="Menunggu">Menunggu</option>
            <option value="Ditugaskan">Ditugaskan</option>
            <option value="Ditindaklanjuti">Ditindaklanjuti</option>
            <option value="Selesai">Selesai</option>
            <option value="Dibatalkan">Dibatalkan</option>
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Jenis Layanan Dropdown */}
        <div className="relative min-w-[180px]">
          <select 
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            {jenisKegiatanOptions.map((jk) => (
              <option key={jk.id} value={jk.id}>{jk.nama_jenis_kegiatan}</option>
            ))}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

      </div>

      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto pb-32 min-h-[480px]">
          <div className="min-w-[1200px] flex flex-col">
            {/* Table Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-[180px] shrink-0 text-left pr-4 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">WAKTU PENGAJUAN</div>
              <div className="w-[160px] shrink-0 text-left pr-4 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">STATUS</div>
              <div className="flex-1 min-w-[200px] text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">PEMOHON & TARGET</div>
              <div className="w-48 shrink-0 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">JENIS LAYANAN</div>
              <div className="w-[180px] shrink-0 text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">PENANGGUNG JAWAB</div>
              <div className="w-12 shrink-0 text-center text-slate-700 text-xs font-bold font-sans uppercase tracking-wider">AKSI</div>
            </div>

            {/* Table Body */}
            <div>
              {data.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">inbox</span>
                  <span className="text-sm font-sans">Tidak ada permohonan pastoral yang ditemukan.</span>
                </div>
              ) : (
                data.map((ticket, idx) => {
                  const isLastRows = data.length > 5 && idx >= data.length - 2;
                  
                  return (
                <div key={ticket.id} className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors relative ${openMenuId === ticket.id ? 'z-50' : 'z-10'}`}>
                  
                  {/* Kolom 1: Waktu Pengajuan */}
                  <div className="w-[180px] shrink-0 flex flex-col items-start justify-center pr-4 gap-1">
                     <span className="text-slate-700 text-sm font-medium">{formatDate(ticket.waktu_diterima)}</span>
                     <span className="text-slate-400 text-xs font-sans tracking-wide">{ticket.nomor_tiket}</span>
                  </div>
                  
                  {/* Kolom 2: Status */}
                  <div className="w-[160px] shrink-0 flex items-center justify-start pr-4">
                     {renderStatusBadge(ticket.displayStatus)}
                  </div>
                  
                  {/* Kolom 3: Pemohon & Target */}
                  <div className="flex-1 min-w-[200px] flex flex-col justify-center pr-4">
                     <span className="text-slate-900 font-bold text-sm capitalize">{ticket.target_pelayanan}</span>
                     <span className="text-slate-500 text-[11px] font-medium mt-0.5">Pemohon: {ticket.nama_pemohon}</span>
                     {ticket.is_urgent && (
                        <span className="text-rose-600 text-[10px] font-black uppercase mt-1 flex items-center gap-1">
                          <span className="material-icons-round text-[12px]">warning</span> URGENT / DARURAT
                        </span>
                     )}
                  </div>

                  {/* Kolom 4: Jenis Layanan */}
                  <div className="w-48 shrink-0 flex flex-col items-start justify-center pr-6">
                     <span className="text-slate-700 font-bold text-[12px] bg-slate-100 px-2 py-1 rounded inline-block max-w-full truncate border border-slate-200" title={ticket.nama_jenis_kegiatan}>
                        {ticket.nama_jenis_kegiatan}
                     </span>
                  </div>

                  {/* Kolom 5: Penanggung Jawab */}
                  <div className="w-[180px] shrink-0 flex flex-col justify-center pr-4">
                     <span className="text-slate-700 text-sm font-medium truncate flex items-center gap-1.5" title={ticket.nama_penanggung_jawab || 'Belum Ditugaskan'}>
                        {ticket.nama_penanggung_jawab ? (
                           <><span className="material-icons-round text-[16px] text-blue-400">badge</span> {ticket.nama_penanggung_jawab}</>
                        ) : (
                           <><span className="material-icons-round text-[16px] text-slate-300">help_outline</span> <span className="text-slate-400 italic">Belum Ditugaskan</span></>
                        )}
                     </span>
                  </div>

                  {/* Kolom 6: Aksi */}
                  <div className="w-12 shrink-0 flex justify-center items-center">
                    <div className="relative">
                      <button 
                        onClick={() => setOpenMenuId(openMenuId === ticket.id ? null : ticket.id)}
                        className="w-8 h-8 rounded-full flex justify-center items-center hover:bg-slate-200 text-slate-500 transition-colors"
                      >
                        <span className="material-icons-round text-[20px]">more_vert</span>
                      </button>

                      {openMenuId === ticket.id && (
                        <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-2 z-50`}>
                          <Link href={`/kegiatan/pastoral/${ticket.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                             <span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat & Kelola Detail
                          </Link>
                          
                          {/* Tindakan Cepat */}
                          {ticket.status_permohonan === 'Menunggu' && (
                             <button 
                               onClick={() => {
                                 setSelectedTicketId(ticket.id);
                                 setAssignModalOpen(true);
                                 setOpenMenuId(null);
                               }}
                               className="w-full text-left px-4 py-2 hover:bg-blue-50 text-blue-600 text-sm flex items-center gap-2 mt-1 border-t border-slate-100 pt-2 font-medium"
                             >
                                <span className="material-icons-round text-[18px]">assignment_ind</span>Tugaskan Penanggung Jawab
                             </button>
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
            <div className="text-slate-500 text-sm font-sans">
              Menampilkan {((currentPage - 1) * limit) + 1} - {Math.min(currentPage * limit, totalItems)} dari {totalItems} tiket
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

      {/* Assign Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-[100] flex justify-center items-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setAssignModalOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex justify-center items-center text-blue-600">
                  <span className="material-icons-round">assignment_ind</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Tugaskan Penanggung Jawab</h3>
                  <p className="text-xs text-slate-500 font-medium">Pilih pelayan untuk tiket ini</p>
                </div>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <span className="material-icons-round">close</span>
              </button>
            </div>
            
            <div className="p-6 border-b border-slate-100 bg-white flex flex-col gap-4 shrink-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tanggal Fix (WIB) <span className="text-rose-500">*</span></label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 font-medium transition-all"
                    value={tanggalFix}
                    onChange={(e) => setTanggalFix(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Jam Fix (WIB) <span className="text-rose-500">*</span></label>
                  <input
                    type="time"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-700 font-medium transition-all"
                    value={waktuFix}
                    onChange={(e) => setWaktuFix(e.target.value)}
                  />
                </div>
              </div>
              <hr className="border-slate-100" />
              
              <div className="relative">
                <span className="material-icons-round absolute left-4 top-3 text-slate-400 text-[20px]">search</span>
                <input 
                  type="text" 
                  placeholder="Cari nama pengurus..."
                  className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 font-sans text-sm"
                  value={picSearch}
                  onChange={(e) => setPicSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-slate-50">
              {picOptions.length === 0 ? (
                <div className="w-full py-10 flex flex-col items-center justify-center text-slate-400">
                  <span className="material-icons-round text-4xl mb-2 opacity-50">group_off</span>
                  <span className="text-sm">Tidak ada pengurus yang ditemukan.</span>
                </div>
              ) : (
                <div className="flex flex-col gap-1 p-2">
                  {picOptions.map(pic => (
                    <div key={pic.pengurus_id} className="w-full bg-white border border-slate-100 rounded-xl p-3 flex justify-between items-center hover:shadow-sm hover:border-blue-100 transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-100 flex justify-center items-center text-slate-600 font-bold uppercase">
                          {pic.nama.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-bold text-sm">{pic.nama}</span>
                          <span className="text-slate-500 text-xs font-medium">{pic.role}</span>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleAssign(pic.pengurus_id)}
                        disabled={assignLoading}
                        className="px-4 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
                      >
                        Pilih
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
