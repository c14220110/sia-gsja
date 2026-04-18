'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertModal } from '@/components/ui/AlertModal';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';

export default function KegiatanPage() {
  const { showLoader, hideLoader } = useLoader();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Authentication State
  const [userData, setUserData] = useState<any>(null);

  // Options State
  const [satelitOptions, setSatelitOptions] = useState<any[]>([]);
  const [departemenOptions, setDepartemenOptions] = useState<any[]>([]);
  const [komisiOptions, setKomisiOptions] = useState<any[]>([]);
  const [jenisKegiatanOptions, setJenisKegiatanOptions] = useState<any[]>([]);
  
  // Pagination & Stats State
  const [data, setData] = useState<any[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [bulanIni, setBulanIni] = useState(0);
  const [mingguIni, setMingguIni] = useState(0);
  const [menungguLpj, setMenungguLpj] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;
  
  // Filters
  const [filterSatelit, setFilterSatelit] = useState('');
  const [filterKomisi, setFilterKomisi] = useState('');
  const [filterDepartemen, setFilterDepartemen] = useState('');
  const [filterTanggal, setFilterTanggal] = useState('Bulan Ini');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [filterJenis, setFilterJenis] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Status Change State
  const [cancelModal, setCancelModal] = useState<{isOpen: boolean, kegiatanId: number | null, reason: string}>({isOpen: false, kegiatanId: null, reason: ''});
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string }>({ status: 'idle', message: '' });

  const handleUpdateStatus = async (id: number, newStatus: string, reason?: string) => {
    setSubmitState({ status: 'loading', message: `Sedang memproses acara...` });
    try {
      const res = await fetch(`/api/kegiatan/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status_kegiatan: newStatus, alasan_pembatalan: reason })
      });
      const data = await res.json();
      if (data.success) {
        setSubmitState({ status: 'success', message: 'Tindakan berhasil diaplikasikan!' });
        setTimeout(() => {
          setSubmitState({ status: 'idle', message: '' });
          setCancelModal({ isOpen: false, kegiatanId: null, reason: '' });
          setOpenMenuId(null);
          setRefreshTrigger(prev => prev + 1); // Force re-fetch data
        }, 1500);
      } else {
        setSubmitState({ status: 'error', message: data.message || 'Gagal mengubah status.' });
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
      }
    } catch(err) {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan server.' });
      setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
    }
  };

  const handleDeleteDraft = async (id: number) => {
    if (!confirm('Apakah Anda yakin ingin MENGHAPUS PERMANEN draf kegiatan ini? Data tidak dapat dipulihkan.')) return;
    
    setSubmitState({ status: 'loading', message: 'Menghapus permanen acara...' });
    try {
      const res = await fetch(`/api/kegiatan/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSubmitState({ status: 'success', message: 'Draf berhasil dihapus permanen!' });
        setTimeout(() => {
          setSubmitState({ status: 'idle', message: '' });
          setOpenMenuId(null);
          setRefreshTrigger(prev => prev + 1); // Force re-fetch data
        }, 1500);
      } else {
        setSubmitState({ status: 'error', message: data.message || 'Gagal menghapus draf kegiatan' });
        setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
      }
    } catch(err) {
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan server.' });
      setTimeout(() => setSubmitState({ status: 'idle', message: '' }), 2000);
    }
  };

  // Fetch Options and User Data on Mount
  // Fetch Master Options (Except Komisi which is reactive to Satelit) & User Data
  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      showLoader();
      try {
        const [resSatelit, resDept, resJenis, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=departemen'),
          fetch('/api/options?type=jenis_kegiatan'),
          fetch('/api/auth/me')
        ]);
        const satelitData = await resSatelit.json();
        
        let deptData = { success: false, data: [] };
        if (resDept.ok) {
           const text = await resDept.text();
           try { deptData = JSON.parse(text); } catch(e){}
        }

        let jenisData = { success: false, data: [] };
        if (resJenis.ok) {
           const text = await resJenis.text();
           try { jenisData = JSON.parse(text); } catch(e){}
        }

        const authData = resUser.ok ? await resUser.json() : null;

        if (satelitData.success) setSatelitOptions(satelitData.data);
        if (deptData.success) setDepartemenOptions(deptData.data);
        if (jenisData.success) setJenisKegiatanOptions(jenisData.data);
        
        if (authData) {
          setUserData(authData);
          if (authData.role_name?.toUpperCase().includes('SATELIT')) {
            setFilterSatelit(authData.satelit_id?.toString() || '');
          }
        }
      } catch (error) {
        console.error('Failed to fetch initial data', error);
      } finally {
        hideLoader();
      }
    };
    fetchOptionsAndUser();
  }, []);

  // Reactive Komisi Fetcher based on Satelit
  useEffect(() => {
    const fetchKomisi = async () => {
      try {
        // Reset komisi if satelit changes
        if (!filterSatelit) {
           setFilterKomisi('');
        }
        const query = filterSatelit ? `?type=komisi&satelit_id=${filterSatelit}` : `?type=komisi`;
        const res = await fetch(`/api/options${query}`);
        if (res.ok) {
          const text = await res.text();
          try {
            const data = JSON.parse(text);
            if (data.success) setKomisiOptions(data.data);
          } catch(e) {}
        }
      } catch (err) {
        console.error('Failed to fetch reactive komisi', err);
      }
    };
    fetchKomisi();
  }, [filterSatelit]);

  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterSatelit, filterKomisi, filterDepartemen, filterTanggal, customStartDate, customEndDate, filterJenis, filterStatus]);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.append('search', debouncedSearch);
        if (filterSatelit) queryParams.append('satelit_id', filterSatelit);
        if (filterKomisi) queryParams.append('penyelenggara', `komisi_${filterKomisi}`);
        else if (filterDepartemen) queryParams.append('penyelenggara', `dept_${filterDepartemen}`);
        if (filterTanggal) queryParams.append('tanggal', filterTanggal);
        if (filterTanggal === 'Custom' && customStartDate && customEndDate) {
          queryParams.append('start_date', customStartDate);
          queryParams.append('end_date', customEndDate);
        }
        if (filterStatus) queryParams.append('status', filterStatus);
        if (filterJenis) queryParams.append('jenis_kegiatan_id', filterJenis);
        
        queryParams.append('limit', limit.toString());
        queryParams.append('offset', ((currentPage - 1) * limit).toString());

        const res = await fetch(`/api/kegiatan?${queryParams.toString()}`);
        const result = await res.json();
        
        if (result.success) {
          setData(result.data);
          setTotalItems(result.meta.total);
          setBulanIni(result.meta.bulan_ini || 0);
          setMingguIni(result.meta.minggu_ini || 0);
          setMenungguLpj(result.meta.menunggu_lpj || 0);
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        hideLoader();
      }
    };

    fetchData();
  }, [debouncedSearch, filterSatelit, filterKomisi, filterDepartemen, filterTanggal, customStartDate, customEndDate, filterJenis, filterStatus, currentPage, refreshTrigger]);

  const totalPages = Math.ceil(totalItems / limit) || 1;

  // Render Status Badge
  const renderStatusBadge = (status: string) => {
    // 'Menunggu Dimulai' = visual-only warning badge (pulsing amber)
    if (status === 'Menunggu Dimulai') {
      return (
        <span className="px-2.5 py-1 text-xs font-black rounded-full border bg-amber-50 text-amber-700 border-amber-300 whitespace-nowrap flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
          ⚠️ Menunggu Dimulai
        </span>
      );
    }

    let colorClass = "bg-slate-100 text-slate-700 border-slate-200"; // Draft
    if (status === 'Menunggu Persetujuan') colorClass = "bg-orange-50 text-orange-700 border-orange-200";
    else if (status === 'Ditolak' || status === 'Dibatalkan') colorClass = "bg-red-50 text-red-700 border-red-200";
    else if (status === 'Akan Datang') colorClass = "bg-indigo-50 text-indigo-700 border-indigo-200";
    else if (status === 'Ongoing' || status === 'Registrasi') colorClass = "bg-blue-50 text-blue-700 border-blue-200";
    else if (status === 'Selesai') colorClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
    else if (status === 'Menunggu LPJ') colorClass = "bg-amber-50 text-amber-700 border-amber-200";

    return (
      <span className={`px-2.5 py-1 text-xs font-bold rounded-full border ${colorClass} whitespace-nowrap`}>
        {status}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    // timeString from DB often comes like "08:00:00"
    return timeString.substring(0, 5);
  };

  // Buka advanced filter otomatis jika pilih custom
  useEffect(() => {
    if (filterTanggal === 'Custom' && !showAdvancedFilters) {
      setShowAdvancedFilters(true);
    }
  }, [filterTanggal]);

  // Keamanan Route: Redirect jemaat jika membuka link admin
  useEffect(() => {
    if (userData?.role_name?.toLowerCase() === 'jemaat') {
      router.replace('/jadwal');
    }
  }, [userData, router]);

  if (userData?.role_name?.toLowerCase() === 'jemaat') {
    return null; // Tahan render selama dilempar ke /jadwal
  }

  return (
    <div className="w-full flex flex-col gap-8 pb-10 relative">
      
      {/* Submit Overlay */}
      {(submitState.status !== 'idle') && <SubmitOverlay status={submitState.status} message={submitState.message} />}

      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
          <div className="flex flex-col gap-1">
            <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Daftar Kegiatan</h1>
            <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6">Sistem Informasi Manajemen Jadwal & Kegiatan Gereja</div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/kegiatan/validasi-pembayaran" className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-lg flex justify-center items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm focus:ring-2 focus:ring-slate-400 focus:outline-none">
              <span className="material-icons-round text-sky-600 text-[20px]">price_check</span>
              <span className="text-sm font-bold font-['Inter'] leading-5">Validasi Pembayaran</span>
            </Link>
            {/* TODO: Add proper permission check for kegiatan_create */}
            {(hasPermission('jemaat_create') || true) && (
              <Link href="/kegiatan/new" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
                <span className="material-icons-round text-white text-[20px]">add</span>
                <span className="text-white text-sm font-bold font-['Inter'] leading-5">Tambah Kegiatan Baru</span>
              </Link>
            )}
          </div>
        </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        
        {/* Card 1 */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-indigo-50 rounded-xl flex justify-center items-center">
             <span className="material-icons-round text-indigo-600 text-3xl">calendar_month</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-['Public_Sans'] uppercase tracking-wide">TOTAL KEGIATAN (BULAN INI)</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">{bulanIni}</span>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-emerald-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-emerald-600 text-3xl">event_note</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-['Public_Sans'] uppercase tracking-wide leading-tight">
              KEGIATAN MENDATANG (7 HARI KEDEPAN)
            </span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">
                {mingguIni}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3 */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-amber-50 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-amber-600 text-3xl">assignment_late</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-600 text-xs font-bold font-['Public_Sans'] uppercase tracking-wide">MENUNGGU LPJ (LAPORAN)</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-amber-600 text-3xl font-bold font-['Public_Sans'] leading-9">{menungguLpj}</span>
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
            placeholder="Cari Acara..."
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Rentang Waktu Dropdown */}
        <div className="relative min-w-[140px]">
          <select 
            value={filterTanggal}
            onChange={(e) => setFilterTanggal(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer font-bold text-blue-700"
          >
            <option value="Hari Ini">Hari Ini</option>
            <option value="Minggu Ini">Minggu Ini</option>
            <option value="Bulan Ini">Bulan Ini</option>
            <option value="Custom">Custom...</option>
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">calendar_today</span>
        </div>

        {/* Status Dropdown */}
        <div className="relative min-w-[150px]">
          <select 
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
          >
            <option value="">Semua Status</option>
            <option value="Draft">Draft (Konsep)</option>
            <option value="Menunggu Persetujuan">Menunggu ACC</option>
            <option value="Akan Datang">Akan Datang</option>
            <option value="Ongoing">Sedang Berjalan</option>
            <option value="Menunggu LPJ">Menunggu LPJ</option>
            <option value="Selesai">Selesai</option>
            <option value="Dibatalkan">Dibatalkan</option>
            <option value="Ditolak">Ditolak</option>
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">flag</span>
        </div>

        {/* Satelit Dropdown */}
        <div className="relative min-w-[150px]">
          <select 
            value={filterSatelit}
            onChange={(e) => setFilterSatelit(e.target.value)}
            disabled={userData?.role_name?.toUpperCase().includes('SATELIT')}
            className={`appearance-none w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm ${
              userData?.role_name?.toUpperCase().includes('SATELIT') ? 'bg-slate-200 cursor-not-allowed opacity-70' : 'bg-slate-50 cursor-pointer'
            }`}
          >
            {!userData?.role_name?.toUpperCase().includes('SATELIT') && <option value="">Semua Satelit</option>}
            {satelitOptions.map((satelit) => (
              <option key={satelit.id} value={satelit.id}>{satelit.nama_satelit}</option>
            ))}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>
        
        {/* Jenis Kegiatan Dropdown */}
        <div className="relative min-w-[180px]">
          <select 
            value={filterJenis}
            onChange={(e) => setFilterJenis(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
          >
            <option value="">Semua Kategori</option>
            {(() => {
              const KATEGORI_ORDER = [
                'Ibadah Rutin',
                'Sosial & Diakonia',
                'Sakramen & Layanan',
                'Event & Perayaan',
                'Edukasi & Pelatihan',
              ];
              const grouped: Record<string, typeof jenisKegiatanOptions> = {};
              jenisKegiatanOptions.forEach(jk => {
                const k = jk.kategori || 'Lainnya';
                if (!grouped[k]) grouped[k] = [];
                grouped[k].push(jk);
              });
              const orderedKeys = [
                ...KATEGORI_ORDER.filter(k => grouped[k]),
                ...Object.keys(grouped).filter(k => !KATEGORI_ORDER.includes(k))
              ];
              return orderedKeys.map(kat => (
                <optgroup key={kat} label={`— ${kat.toUpperCase()} —`}>
                  {grouped[kat].map(jk => (
                    <option key={jk.id} value={jk.id}>{jk.nama_jenis_kegiatan}</option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* More Filters Toggle */}
        <button 
          onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
          className={`px-4 py-2.5 border rounded-lg flex items-center gap-2 transition-colors group ${showAdvancedFilters ? 'bg-slate-100 border-slate-300' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
        >
          <span className={`material-icons-round text-[20px] transition-colors ${showAdvancedFilters ? 'text-slate-800' : 'text-slate-500 group-hover:text-slate-700'}`}>tune</span>
          <span className={`text-sm font-medium font-['Public_Sans'] transition-colors ${showAdvancedFilters ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-800'}`}>More Filters</span>
        </button>
      </div>

      {/* Advanced Filter Collapse Layer */}
      {showAdvancedFilters && (
        <div className={`w-full p-6 bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 grid gap-6 ${filterTanggal === 'Custom' ? 'grid-cols-1 md:grid-cols-4' : 'grid-cols-1 md:grid-cols-2'}`}>
          
          {/* Komisi Dropdown */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-['Public_Sans']">Komisi (Satelit Spesifik)</label>
            <div className="relative">
              <select 
                value={filterKomisi}
                onChange={(e) => { setFilterKomisi(e.target.value); setFilterDepartemen(''); }}
                disabled={!filterSatelit}
                className={`appearance-none w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm ${!filterSatelit ? 'bg-slate-200 cursor-not-allowed opacity-70' : 'bg-slate-50 cursor-pointer'}`}
              >
                <option value="">Semua Komisi</option>
                {komisiOptions.map((komisi) => (
                    <option key={`komisi_${komisi.id}`} value={komisi.id}>{komisi.nama_komisi}</option>
                ))}
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>
          
          {/* Departemen Dropdown */}
          <div className="flex flex-col gap-2">
            <label className="text-slate-700 text-sm font-bold font-['Public_Sans']">Departemen Pusat (Global)</label>
            <div className="relative">
              <select 
                value={filterDepartemen}
                onChange={(e) => { setFilterDepartemen(e.target.value); setFilterKomisi(''); }}
                className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm cursor-pointer"
              >
                <option value="">Semua Departemen</option>
                {departemenOptions.map((dept) => (
                    <option key={`dept_${dept.id}`} value={dept.id}>{dept.nama_departemen}</option>
                ))}
              </select>
              <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
            </div>
          </div>

          {filterTanggal === 'Custom' && (
            <>
              <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
                <label className="text-slate-700 text-sm font-bold font-['Public_Sans']">Dari Tanggal</label>
                <input 
                  type="date" 
                  value={customStartDate} 
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-slate-700 text-sm font-bold font-['Public_Sans']">Sampai Tanggal</label>
                <input 
                  type="date" 
                  value={customEndDate} 
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm"
                />
              </div>
            </>
          )}

        </div>
      )}

      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto pb-32 min-h-[480px]">
          <div className="min-w-[1200px] flex flex-col">
            {/* Table Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-[180px] shrink-0 text-left pr-4 text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">TANGGAL & WAKTU</div>
              <div className="w-[200px] shrink-0 text-left pr-4 text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">STATUS</div>
              <div className="flex-1 min-w-[200px] text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">INFORMASI KEGIATAN</div>
              <div className="w-56 shrink-0 text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">JENIS KEGIATAN</div>
              <div className="w-[180px] shrink-0 text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">PELAKSANA</div>
              <div className="w-12 shrink-0 text-center text-slate-700 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">AKSI</div>
            </div>

            {/* Table Body */}
            <div>
              {data.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">event_busy</span>
                  <span className="text-sm font-['Public_Sans']">Tidak ada data kegiatan yang ditemukan.</span>
                </div>
              ) : (
                data.map((kegiatan, idx) => {
                  const isLastRows = data.length > 5 && idx >= data.length - 2;
                  
                  // ─── displayStatus: murni visual, TIDAK menyentuh DB ───────
                  // Prinsip: status DB hanya berubah lewat tombol manual admin.
                  // Frontend hanya memberi "toa" visual jika waktunya sudah tiba.
                  let displayStatus = kegiatan.status_kegiatan;

                  const isTerminal = ['Draft','Menunggu Persetujuan','Ditolak','Dibatalkan','Selesai','Menunggu LPJ','Ongoing'].includes(displayStatus);

                  if (!isTerminal && displayStatus === 'Akan Datang' && kegiatan.tanggal_mulai && kegiatan.waktu_mulai) {
                    // Ekstrak tanggal dalam timezone LOKAL browser (bukan UTC)
                    // tanggal_mulai dari PG bisa datang sebagai "2026-04-17T17:00:00.000Z"
                    // (= tengah malam WIB), substring(0,10) justru ambil tanggal UTC yang salah
                    const eventDateObj = new Date(kegiatan.tanggal_mulai);
                    const y = eventDateObj.getFullYear();
                    const m = String(eventDateObj.getMonth() + 1).padStart(2, '0');
                    const d = String(eventDateObj.getDate()).padStart(2, '0');
                    const jam = (kegiatan.waktu_mulai as string).substring(0, 5); // 'HH:MM'

                    if (jam && jam.includes(':')) {
                      // Bangun waktu mulai dengan offset WIB eksplisit
                      const eventStartWIB = new Date(`${y}-${m}-${d}T${jam}:00+07:00`);
                      const nowWIB = new Date();

                      if (nowWIB >= eventStartWIB) {
                        // Waktu sudah lewat tapi admin belum klik "Mulai Acara"
                        displayStatus = 'Menunggu Dimulai';
                      }
                      // else: masih di masa depan → tetap 'Akan Datang'
                    }
                  }


                  return (
                <div key={kegiatan.id || idx} className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-blue-50/40 hover:shadow-[inset_4px_0_0_0_#3b82f6] transition-all relative ${openMenuId === kegiatan.id ? 'z-50' : 'z-10'}`}>
                  {/* Kolom 1: Tanggal & Waktu */}
                  <div className="w-[180px] shrink-0 flex flex-col items-start justify-center pr-4 gap-1.5">
                     <div className="text-slate-700 text-sm font-bold flex flex-col items-start leading-tight">
                        <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="material-icons-round text-[16px] text-slate-400">event</span> {formatDate(kegiatan.tanggal_mulai)}</span>
                        <span className="text-slate-500 font-medium ml-6 text-xs whitespace-nowrap">Pkl. {formatTime(kegiatan.waktu_mulai)} WIB</span>
                     </div>
                  </div>
                  
                  {/* Kolom 2: Status */}
                  <div className="w-[200px] shrink-0 flex items-center justify-start pr-4">
                     {renderStatusBadge(displayStatus)}
                  </div>
                  
                  {/* Kolom 3: Informasi Kegiatan (Nama + ID + Lokasi) */}
                  <div className="flex-1 min-w-[200px] flex flex-col justify-center pr-4">
                     <span className="text-slate-900 font-bold text-sm capitalize mb-1" title={kegiatan.nama_kegiatan}>{kegiatan.nama_kegiatan}</span>
                     <div className="flex flex-col gap-0.5">
                       <span className="text-slate-400 text-[11px] font-['Liberation_Mono'] tracking-wide">ID: {kegiatan.kode_kegiatan}</span>
                       <span className="text-slate-500 text-xs font-medium line-clamp-1 mt-1 flex items-center gap-1"><span className="material-icons-round text-[14px]">place</span> {kegiatan.lokasi_kegiatan || '-'}</span>
                     </div>
                  </div>

                  {/* Kolom 3: Jenis Kegiatan */}
                  <div className="w-56 shrink-0 flex flex-col items-start justify-center pr-6 gap-1">
                     <span className="text-slate-700 font-bold text-[11px] bg-slate-100 px-2 py-1 rounded inline-block max-w-full truncate border border-slate-200" title={kegiatan.nama_jenis_kegiatan}>{kegiatan.nama_jenis_kegiatan || 'Tidak Diatur'}</span>
                     {(kegiatan.kategori || kegiatan.frekuensi_kegiatan) && (
                       <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">{kegiatan.frekuensi_kegiatan || 'Insidental - Tahunan'}</span>
                     )}
                  </div>

                  {/* Kolom 4: Pelaksana */}
                  <div className="w-[180px] shrink-0 flex flex-col justify-center pr-4">
                     <span className="text-slate-700 text-sm font-bold truncate flex items-center gap-1.5" title={kegiatan.nama_komisi || kegiatan.nama_departemen || kegiatan.nama_satelit || 'Pusat (Pusat)'}>
                        <span className="material-icons-round text-[16px] text-indigo-400">
                           {kegiatan.nama_komisi || kegiatan.nama_departemen ? 'groups' : 'account_balance'}
                        </span> 
                        {kegiatan.nama_komisi || kegiatan.nama_departemen || kegiatan.nama_satelit || 'Pusat (Pusat)'}
                     </span>
                     <span className="text-slate-500 text-[11px] truncate mt-1 flex items-center gap-1" title={kegiatan.pic_name ? `${kegiatan.nama_komisi || kegiatan.nama_departemen ? (kegiatan.nama_satelit || 'Pusat (Pusat)') : 'Panitia Umum'} (PIC: ${kegiatan.pic_name})` : (kegiatan.nama_komisi || kegiatan.nama_departemen ? (kegiatan.nama_satelit || 'Pusat (Pusat)') : 'Panitia Umum')}>
                        <span className="material-icons-round text-[14px] text-slate-400">{kegiatan.pic_name ? 'assignment_ind' : 'location_city'}</span> 
                        <span className="truncate">{kegiatan.nama_komisi || kegiatan.nama_departemen ? (kegiatan.nama_satelit || 'Pusat (Pusat)') : 'Panitia Umum'}</span>
                        {kegiatan.pic_name && <span className="text-slate-400 ml-0.5 shrink-0 font-normal">({kegiatan.pic_name.split(' ')[0]})</span>}
                     </span>
                  </div>

                  {/* Kolom 5: Aksi */}
                  <div className="w-12 shrink-0 flex justify-center items-center">
                    <div className="relative">
                      <button 
                        onClick={() => setOpenMenuId(openMenuId === kegiatan.id ? null : kegiatan.id)}
                        className="w-8 h-8 rounded-full flex justify-center items-center hover:bg-slate-200 text-slate-500 transition-colors"
                      >
                        <span className="material-icons-round text-[20px]">more_vert</span>
                      </button>

                      {openMenuId === kegiatan.id && (
                        <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-56 bg-white rounded-lg shadow-xl border border-slate-100 py-2 z-50`}>
                          
                          {/* DRAFT */}
                          {displayStatus === 'Draft' && (
                            <>
                              <Link href={`/kegiatan/${kegiatan.id}/edit`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Detail Draft</Link>
                              <Link href={`/kegiatan/${kegiatan.id}/edit`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">edit</span>Edit Kegiatan</Link>
                              <button onClick={() => handleUpdateStatus(kegiatan.id, 'Menunggu Persetujuan')} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-blue-500">send</span>Ajukan Jadwal Acara</button>
                              <div className="w-full h-px bg-slate-100 my-1"></div>
                              <button onClick={() => handleDeleteDraft(kegiatan.id)} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-red-400">delete</span>Hapus Data</button>
                            </>
                          )}

                          {/* MENUNGGU PERSETUJUAN */}
                          {displayStatus === 'Menunggu Persetujuan' && (
                            <>
                              <Link href={`/kegiatan/${kegiatan.id}/edit?mode=view`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Proposal Acara</Link>
                              <Link href={`/kegiatan/${kegiatan.id}/edit`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">edit</span>Edit Kegiatan</Link>
                              <div className="w-full h-px bg-slate-100 my-1"></div>
                              <button onClick={() => handleUpdateStatus(kegiatan.id, 'Akan Datang')} className="w-full text-left px-4 py-2 hover:bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2 font-bold"><span className="material-icons-round text-[18px] text-emerald-600">check_circle</span>Terima & Publish (ACC)</button>
                              <button onClick={() => handleUpdateStatus(kegiatan.id, 'Ditolak')} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2 font-bold"><span className="material-icons-round text-[18px] text-red-600">cancel</span>Tolak Pengajuan</button>
                            </>
                          )}

                          {/* DITOLAK */}
                          {displayStatus === 'Ditolak' && (
                            <>
                              <Link href={`/kegiatan/${kegiatan.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Acara</Link>
                              <button onClick={() => handleDeleteDraft(kegiatan.id)} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-red-400">delete</span>Hapus Data</button>
                            </>
                          )}

                          {/* AKAN DATANG + MENUNGGU DIMULAI */}
                          {(displayStatus === 'Akan Datang' || displayStatus === 'Menunggu Dimulai') && (
                            <>
                              <Link href={`/kegiatan/${kegiatan.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Detail</Link>
                              <Link href={`/kegiatan/${kegiatan.id}?tab=pelayan&mode=manage`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-indigo-400">groups</span>Kelola Pelayan &amp; Peserta</Link>
                              <div className="w-full h-px bg-slate-100 my-1"></div>
                              {/* Tombol Mulai Acara — lebih mencolok saat sudah waktunya */}
                              <button
                                onClick={() => handleUpdateStatus(kegiatan.id, 'Ongoing')}
                                className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 font-black transition-colors ${
                                  displayStatus === 'Menunggu Dimulai'
                                    ? 'hover:bg-amber-50 text-amber-700 bg-amber-50/50'
                                    : 'hover:bg-emerald-50 text-emerald-700'
                                }`}
                              >
                                <span className={`material-icons-round text-[18px] ${displayStatus === 'Menunggu Dimulai' ? 'text-amber-600' : 'text-emerald-600'}`}>play_circle</span>
                                {displayStatus === 'Menunggu Dimulai' ? '⚡ MULAI ACARA SEKARANG!' : 'Mulai Acara (Buka Absensi)'}
                              </button>
                              <button onClick={() => setCancelModal({ isOpen: true, kegiatanId: kegiatan.id, reason: '' })} className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-red-400">block</span>Batalkan Kegiatan</button>
                            </>
                          )}

                          {/* ONGOING — 4 Aksi Hierarkis */}
                          {displayStatus === 'Ongoing' && (
                            <>
                              {/* 1. Lihat Detail */}
                              <Link href={`/kegiatan/${kegiatan.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2">
                                <span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Detail
                              </Link>

                              <div className="w-full h-px bg-slate-100 my-1"></div>

                              {/* 2. INPUT ABSENSI JEMAAT — Primary Action (bold only) */}
                              <Link href={`/kegiatan/${kegiatan.id}/absen`} className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-blue-700 text-sm flex items-center gap-2 font-black">
                                <span className="material-icons-round text-[18px] text-blue-600">qr_code_scanner</span>
                                <span>INPUT ABSENSI JEMAAT</span>
                              </Link>

                              {/* 3. Absensi Tim Pelayan — Deep-link ke tab pelayan */}
                              <Link href={`/kegiatan/${kegiatan.id}?tab=pelayan&mode=manage`} className="w-full text-left px-4 py-2 hover:bg-indigo-50 text-indigo-700 text-sm flex items-center gap-2">
                                <span className="material-icons-round text-[18px] text-indigo-500">groups</span>Absensi Tim Pelayan
                              </Link>

                              <div className="w-full h-px bg-slate-100 my-1"></div>

                              {/* 4. Akhiri Kegiatan */}
                              <button
                                onClick={() => handleUpdateStatus(kegiatan.id, 'Menunggu LPJ')}
                                className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 text-sm flex items-center gap-2"
                              >
                                <span className="material-icons-round text-[18px] text-red-400">stop_circle</span>Akhiri Kegiatan
                              </button>
                            </>
                          )}

                          {/* MENUNGGU LPJ */}
                          {displayStatus === 'Menunggu LPJ' && (
                            <>
                              <Link href={`/kegiatan/${kegiatan.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Detail</Link>
                              <Link href={`/kegiatan/${kegiatan.id}/absensi-susulan`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">how_to_reg</span>Absensi Susulan</Link>
                              <div className="w-full h-px bg-slate-100 my-1"></div>
                              <button className="w-full text-left px-4 py-2 hover:bg-amber-50 text-amber-700 text-sm flex items-center gap-2 font-bold"><span className="material-icons-round text-[18px] text-amber-600">description</span>Input LPJ</button>
                            </>
                          )}

                          {/* SELESAI */}
                          {displayStatus === 'Selesai' && (
                            <>
                              <Link href={`/kegiatan/${kegiatan.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Detail</Link>
                              <button className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">print</span>Cetak Daftar Hadir</button>
                              <button className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">article</span>Lihat / Cetak LPJ</button>
                            </>
                          )}

                          {/* DIBATALKAN */}
                          {displayStatus === 'Dibatalkan' && (
                            <>
                              <Link href={`/kegiatan/${kegiatan.id}`} className="w-full text-left px-4 py-2 hover:bg-slate-50 text-slate-700 text-sm flex items-center gap-2"><span className="material-icons-round text-[18px] text-slate-400">visibility</span>Lihat Detail</Link>
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
              Menampilkan {((currentPage - 1) * limit) + 1} - {Math.min(currentPage * limit, totalItems)} dari {totalItems} acara
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 flex justify-center items-center hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent bg-white text-slate-600 shadow-sm"
              >
                <span className="material-icons-round text-lg">chevron_left</span>
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-bold flex justify-center items-center shadow-sm ${
                    currentPage === i + 1 
                    ? 'bg-slate-700 text-white border-transparent' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
              <button 
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg border border-slate-200 flex justify-center items-center hover:bg-white disabled:opacity-50 disabled:hover:bg-transparent bg-white text-slate-600 shadow-sm"
              >
                <span className="material-icons-round text-lg">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CANCEL MODAL */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => submitState.status !== 'loading' && setCancelModal({ isOpen: false, kegiatanId: null, reason: '' })}></div>
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl relative z-10 overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3 bg-slate-50/50">
              <div className="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <span className="material-icons-round">warning</span>
              </div>
              <div>
                <h3 className="text-slate-900 font-bold text-lg">Batalkan Kegiatan</h3>
                <p className="text-slate-500 text-xs mt-0.5">Acara akan dibatalkan permanen untuk jemaat.</p>
              </div>
            </div>
            
            <div className="p-6 flex flex-col gap-4">
               <div className="w-full flex flex-col gap-1.5">
                 <label className="text-slate-500 text-xs font-bold font-['Inter'] uppercase">Alasan Keputusan Pembatalan <span className="text-red-500">*</span></label>
                 <textarea 
                   rows={3}
                   value={cancelModal.reason} 
                   onChange={(e) => setCancelModal(prev => ({ ...prev, reason: e.target.value }))}
                   placeholder="Contoh: Bencana alam, cuaca buruk, narasumber batal hadir..."
                   className="px-4 py-3 bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 text-sm w-full font-medium text-slate-700 resize-none transition-all"
                 ></textarea>
               </div>
               <div className="bg-amber-50 border border-amber-200 p-3 rounded-lg flex gap-3 items-start">
                 <span className="material-icons-round text-amber-600 text-[18px] mt-0.5">info</span>
                 <p className="text-amber-800 text-xs leading-relaxed">Pemberitahuan darurat akan diteruskan ke aplikasi *mobile* Jemaat yang sudah terdaftar, dan notifikasi email ke seluruh panitia yang terlibat.</p>
               </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
               <button onClick={() => setCancelModal({ isOpen: false, kegiatanId: null, reason: '' })} disabled={submitState.status === 'loading'} className="px-5 py-2.5 rounded-lg text-slate-600 font-bold hover:bg-slate-200 text-sm transition-colors">
                 Tutup
               </button>
               <button 
                 onClick={() => cancelModal.kegiatanId && handleUpdateStatus(cancelModal.kegiatanId, 'Dibatalkan', cancelModal.reason)} 
                 disabled={submitState.status === 'loading' || !cancelModal.reason.trim()} 
                 className="px-6 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 flex items-center gap-2 text-sm shadow-sm hover:shadow-md disabled:opacity-50 transition-all"
               >
                 {submitState.status === 'loading' ? <span className="material-icons-round animate-spin text-[18px]">refresh</span> : <span className="material-icons-round text-[18px]">block</span>}
                 Proses Pembatalan Acara
               </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
