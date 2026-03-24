'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

export default function PengurusPage() {
  const { showLoader, hideLoader } = useLoader();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });

  // Alert Modal State
  const [alertState, setAlertState] = useState<{ isOpen: boolean; id: number | null; newStatus: string }>({
    isOpen: false,
    id: null,
    newStatus: ''
  });

  // Authentication State
  const [userData, setUserData] = useState<any>(null);
  
  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  // Options State
  const [satelitOptions,     setSatelitOptions]     = useState<any[]>([]);
  const [jabatanOptions,     setJabatanOptions]     = useState<any[]>([]);
  const [periodeOptions,     setPeriodeOptions]     = useState<any[]>([]);
  const [departemenOptions,  setDepartemenOptions]  = useState<any[]>([]);
  const [komisiOptions,      setKomisiOptions]      = useState<any[]>([]);

  // Pagination & Stats State
  const [data,          setData]          = useState<any[]>([]);
  const [totalItems,    setTotalItems]    = useState(0);
  const [pengurusBaru,  setPengurusBaru]  = useState(0);
  const [pengurusDemisioner, setPengurusDemisioner] = useState(0);
  const [currentPage,   setCurrentPage]   = useState(1);
  const limit = 10;

  // ── Quick Filters ──────────────────────────────────
  const [filterSatelitAsal,    setFilterSatelitAsal]    = useState('');
  const [filterStatusGlobal,   setFilterStatusGlobal]   = useState('Aktif');

  // ── Advanced Filters (applied on click) ────────────
  const [filterLingkup,        setFilterLingkup]        = useState('');
  const [filterSatelitPenugasan, setFilterSatelitPenugasan] = useState('');
  const [filterJabatan,        setFilterJabatan]        = useState('');
  const [filterPeriode,        setFilterPeriode]        = useState('');
  const [filterKomisi,         setFilterKomisi]         = useState('');
  const [filterDepartemen,     setFilterDepartemen]     = useState('');

  // Local temp states for Advanced Filters (apply button)
  const [tempLingkup,          setTempLingkup]          = useState('');
  const [tempSatelitPenugasan, setTempSatelitPenugasan] = useState('');
  const [tempJabatan,          setTempJabatan]          = useState('');
  const [tempPeriode,          setTempPeriode]          = useState('');
  const [tempKomisi,           setTempKomisi]           = useState('');
  const [tempDepartemen,       setTempDepartemen]       = useState('');

  // Fetch Options and User Data on Mount
  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      showLoader();
      try {
        const [resSatelit, resJabatan, resPeriode, resDepartemen, resKomisi, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=jabatan'),
          fetch('/api/options?type=periode_kepengurusan'),
          fetch('/api/options?type=departemen'),
          fetch('/api/options?type=komisi'),
          fetch('/api/auth/me'),
        ]);
        const satelitData = await resSatelit.json();
        const jabatanData = await resJabatan.json();
        const periodeData = await resPeriode.json();
        const departemenData = await resDepartemen.json();
        const komisiData = await resKomisi.json();
        const authData    = resUser.ok ? await resUser.json() : null;

        if (satelitData.success) setSatelitOptions(satelitData.data);
        if (jabatanData.success) setJabatanOptions(jabatanData.data);
        if (periodeData.success) setPeriodeOptions(periodeData.data);
        if (departemenData.success) setDepartemenOptions(departemenData.data);
        if (komisiData.success) setKomisiOptions(komisiData.data);
    // Auto-lock satelit asal untuk admin satelit
        if (authData) {
          setUserData(authData);
          if (authData.role_name?.toUpperCase().includes('SATELIT')) {
            setFilterSatelitAsal(authData.satelit_id?.toString() || '');
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

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterSatelitAsal, filterStatusGlobal, filterLingkup, filterSatelitPenugasan, filterJabatan, filterPeriode, filterKomisi, filterDepartemen]);

  // Fetch Data
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch)          queryParams.append('search',                debouncedSearch);
        if (filterSatelitAsal)        queryParams.append('satelit_asal_id',       filterSatelitAsal);
        if (filterStatusGlobal && filterStatusGlobal !== 'Semua') queryParams.append('status_global', filterStatusGlobal);
        if (filterLingkup)            queryParams.append('lingkup',               filterLingkup);
        if (filterSatelitPenugasan)   queryParams.append('satelit_penugasan_id',  filterSatelitPenugasan);
        if (filterJabatan)            queryParams.append('jabatan_id',            filterJabatan);
        if (filterPeriode)            queryParams.append('periode_id',            filterPeriode);
        if (filterKomisi)             queryParams.append('komisi_id',             filterKomisi);
        if (filterDepartemen)         queryParams.append('departemen_id',         filterDepartemen);

        queryParams.append('limit',  limit.toString());
        queryParams.append('offset', ((currentPage - 1) * limit).toString());

        const res    = await fetch(`/api/pengurus?${queryParams.toString()}`);
        const result = await res.json();

        if (result.success) {
          setData(result.data);
          setTotalItems(result.meta.total);
          setPengurusBaru(result.meta.pengurus_baru || 0);
          setPengurusDemisioner(result.meta.pengurus_demisioner || 0);
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        hideLoader();
      }
    };

    fetchData();
  }, [debouncedSearch, filterSatelitAsal, filterStatusGlobal, filterLingkup, filterSatelitPenugasan, filterJabatan, filterPeriode, filterKomisi, filterDepartemen, currentPage]);


  const handleToggleStatus = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Aktif' ? 'Demisioner' : 'Aktif';
    setAlertState({ isOpen: true, id, newStatus });
  };

  const confirmToggleStatus = async () => {
    const { id, newStatus } = alertState;
    if (!id) return;
    setAlertState({ isOpen: false, id: null, newStatus: '' });

    try {
      setSubmitState({ status: 'loading', message: '' });
      const res = await fetch(`/api/pengurus/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status_jabatan: newStatus }),
      });
      const result = await res.json();
      if (result.success) {
        setData(prev => prev.map(p => p.id === id ? { ...p, status_jabatan: newStatus } : p));
        setSubmitState({ status: 'success', message: `Status berhasil diubah menjadi ${newStatus}` });
      } else {
        setSubmitState({ status: 'error', message: result.message || 'Gagal mengubah status' });
      }
    } catch (error) {
      console.error(error);
      setSubmitState({ status: 'error', message: 'Terjadi kesalahan koneksi saat mengubah status.' });
    }
  };

  const totalPages = Math.ceil(totalItems / limit) || 1;

  return (
    <div className="w-full flex flex-col gap-8 pb-10">

      {/* Header Section */}
      <div className="w-full flex justify-between items-start">
        <div className="flex flex-col gap-1">
          <h1 className="text-slate-900 text-3xl font-black font-['Inter'] leading-9 mb-1">Database Pengurus</h1>
          <div className="text-slate-500 text-base font-medium font-['Inter'] leading-6">Sistem Informasi Manajemen Data Pengurus</div>
        </div>
        {hasPermission('pengurus_manage') && (
          <Link href="/pengurus/new" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
            <span className="material-icons-round text-white text-[20px]">add</span>
            <span className="text-white text-sm font-bold font-['Inter'] leading-5">Tambah Pengurus Baru</span>
          </Link>
        )}
      </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Total Pelayan Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-slate-700/10 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-slate-700 text-3xl">admin_panel_settings</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-['Public_Sans'] uppercase tracking-wide">Total Pengurus Aktif</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">{totalItems.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Pelayan Baru Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-slate-400/20 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-slate-700 text-3xl">person_add</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-['Public_Sans'] uppercase tracking-wide leading-tight">
              Pengurus Baru Bulan Ini
            </span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">
                {pengurusBaru.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Pelayan Nonaktif Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-rose-500/10 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-rose-500 text-3xl">person_off</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-['Public_Sans'] uppercase tracking-wide">Pengurus Demisioner</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-['Public_Sans'] leading-9">{pengurusDemisioner.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── LEVEL 1: Quick Filters ─────────────────────────── */}
      <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-3 shadow-sm">

        {/* Search Bar */}
        <div className="flex-1 min-w-[280px] relative flex items-center">
          <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            placeholder="Cari nama jemaat atau ID pengurus..."
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Satelit Asal (homebase jemaat) */}
        <div className="relative min-w-[190px]">
          <select
            value={filterSatelitAsal}
            onChange={(e) => setFilterSatelitAsal(e.target.value)}
            disabled={userData?.role_name?.toUpperCase().includes('SATELIT')}
            className={`appearance-none w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-['Public_Sans'] text-sm ${
              userData?.role_name?.toUpperCase().includes('SATELIT') ? 'bg-slate-200 cursor-not-allowed opacity-70' : 'bg-slate-50 cursor-pointer'
            }`}
          >
            <option value="">Semua Satelit Asal</option>
            {satelitOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.nama_satelit}</option>
            ))}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* Status Global — pill toggle */}
        <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg p-1">
          {(['Semua', 'Aktif', 'Non-Aktif'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatusGlobal(s === 'Semua' ? '' : s)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-bold transition-all ${
                (filterStatusGlobal === s) || (s === 'Semua' && !filterStatusGlobal)
                  ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {s === 'Aktif' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 align-middle"></span>}
              {s === 'Non-Aktif' && <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-400 mr-1 align-middle"></span>}
              {s}
            </button>
          ))}
        </div>

        {/* More Filters Toggle */}
        {(() => {
          const advCount = (filterLingkup ? 1 : 0) + (filterSatelitPenugasan ? 1 : 0) +
            (filterJabatan ? 1 : 0) + (filterPeriode ? 1 : 0) + (filterKomisi ? 1 : 0) + (filterDepartemen ? 1 : 0);
          const isActive = advCount > 0;
          return (
            <button
              onClick={() => {
                if (!showAdvancedFilters) {
                  setTempLingkup(filterLingkup);
                  setTempSatelitPenugasan(filterSatelitPenugasan);
                  setTempJabatan(filterJabatan);
                  setTempPeriode(filterPeriode);
                  setTempKomisi(filterKomisi);
                  setTempDepartemen(filterDepartemen);
                }
                setShowAdvancedFilters(!showAdvancedFilters);
              }}
              className={`px-4 py-2.5 border rounded-lg flex items-center gap-2 transition-colors group ${
                showAdvancedFilters ? 'bg-slate-100 border-slate-300' :
                isActive ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-white border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className={`material-icons-round text-[20px] ${showAdvancedFilters ? 'text-slate-800' : isActive ? 'text-violet-700' : 'text-slate-500 group-hover:text-slate-700'}`}>tune</span>
              <span className={`text-sm font-medium font-['Public_Sans'] ${showAdvancedFilters ? 'text-slate-900' : isActive ? 'text-violet-700 font-bold' : 'text-slate-600 group-hover:text-slate-800'}`}>Filter Lanjutan</span>
              {isActive && (
                <span className="flex items-center justify-center w-5 h-5 ml-1 bg-violet-600 text-white text-[10px] font-bold rounded-full">{advCount}</span>
              )}
            </button>
          );
        })()}
      </div>

      {/* ─── LEVEL 2: Advanced Filters Collapse Panel ────────── */}
      {showAdvancedFilters && (
        <div className="w-full p-6 bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-5">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-icons-round text-violet-600 text-[18px]">manage_search</span>
            <h3 className="text-slate-800 text-sm font-bold font-['Inter']">Filter Lanjutan Jabatan</h3>
            <span className="text-slate-400 text-xs font-['Public_Sans']">— Semua filter ini menggunakan logika EXISTS (1 orang tetap 1 baris)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">

            {/* 1. Lingkup Pelayanan */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-['Inter'] uppercase tracking-wide">Lingkup</label>
              <div className="relative">
                <select
                  value={tempLingkup}
                  onChange={(e) => setTempLingkup(e.target.value)}
                  className="appearance-none w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-['Public_Sans'] text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Semua Lingkup</option>
                  <option value="Pusat">Pusat</option>
                  <option value="Satelit">Satelit</option>
                  <option value="Komisi">Komisi</option>
                  <option value="Departemen">Departemen</option>
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* 2. Satelit Penugasan */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-['Inter'] uppercase tracking-wide">Satelit Penugasan</label>
              <div className="relative">
                <select
                  value={tempSatelitPenugasan}
                  onChange={(e) => setTempSatelitPenugasan(e.target.value)}
                  className="appearance-none w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-['Public_Sans'] text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Semua</option>
                  {satelitOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.nama_satelit}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* 3. Jabatan */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-['Inter'] uppercase tracking-wide">Jabatan</label>
              <div className="relative">
                <select
                  value={tempJabatan}
                  onChange={(e) => setTempJabatan(e.target.value)}
                  className="appearance-none w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-['Public_Sans'] text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Semua Jabatan</option>
                  {jabatanOptions.map((j) => (
                    <option key={j.id} value={j.id}>{j.nama_jabatan}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* 4. Periode */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-['Inter'] uppercase tracking-wide">Periode</label>
              <div className="relative">
                <select
                  value={tempPeriode}
                  onChange={(e) => setTempPeriode(e.target.value)}
                  className="appearance-none w-full pl-3 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-['Public_Sans'] text-sm cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-400"
                >
                  <option value="">Semua Periode</option>
                  {periodeOptions.map((p) => (
                    <option key={p.id} value={p.id}>{p.nama_periode}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* 5. Komisi */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-['Inter'] uppercase tracking-wide">Komisi</label>
              <div className="relative">
                <select
                  value={tempKomisi}
                  onChange={(e) => { setTempKomisi(e.target.value); if (e.target.value) setTempDepartemen(''); }}
                  disabled={!!tempDepartemen}
                  className={`appearance-none w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-slate-700 font-['Public_Sans'] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 ${tempDepartemen ? 'bg-slate-100 cursor-not-allowed opacity-50' : 'bg-slate-50 cursor-pointer'}`}
                >
                  <option value="">Semua</option>
                  {komisiOptions.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama_komisi}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* 6. Departemen */}
            <div className="flex flex-col gap-1.5">
              <label className="text-slate-600 text-xs font-bold font-['Inter'] uppercase tracking-wide">Departemen</label>
              <div className="relative">
                <select
                  value={tempDepartemen}
                  onChange={(e) => { setTempDepartemen(e.target.value); if (e.target.value) setTempKomisi(''); }}
                  disabled={!!tempKomisi}
                  className={`appearance-none w-full pl-3 pr-8 py-2 border border-slate-200 rounded-lg text-slate-700 font-['Public_Sans'] text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 ${tempKomisi ? 'bg-slate-100 cursor-not-allowed opacity-50' : 'bg-slate-50 cursor-pointer'}`}
                >
                  <option value="">Semua</option>
                  {departemenOptions.map((d) => (
                    <option key={d.id} value={d.id}>{d.nama_departemen}</option>
                  ))}
                </select>
                <span className="material-icons-round absolute right-2 top-2 text-slate-400 text-[18px] pointer-events-none">expand_more</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                setTempLingkup(''); setTempSatelitPenugasan(''); setTempJabatan('');
                setTempPeriode(''); setTempKomisi(''); setTempDepartemen('');
                setFilterLingkup(''); setFilterSatelitPenugasan(''); setFilterJabatan('');
                setFilterPeriode(''); setFilterKomisi(''); setFilterDepartemen('');
                setCurrentPage(1);
                setShowAdvancedFilters(false);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Reset Filter Lanjutan
            </button>
            <button
              onClick={() => {
                setFilterLingkup(tempLingkup);
                setFilterSatelitPenugasan(tempSatelitPenugasan);
                setFilterJabatan(tempJabatan);
                setFilterPeriode(tempPeriode);
                setFilterKomisi(tempKomisi);
                setFilterDepartemen(tempDepartemen);
                setCurrentPage(1);
                setShowAdvancedFilters(false);
              }}
              className="px-5 py-2 text-sm font-bold text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors shadow-sm"
            >
              Terapkan Filter
            </button>
          </div>
        </div>
      )}


      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto pb-4">
          <div className="min-w-[900px] flex flex-col">
            {/* Table Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-32 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">ID Pengurus</div>
              <div className="w-64 shrink-0 text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Profil Pengurus</div>
              <div className="flex-1 min-w-[200px] text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Jabatan Aktif</div>
              <div className="w-32 shrink-0 text-center text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Status Global</div>
              <div className="w-20 shrink-0 text-right text-slate-500 text-xs font-bold font-['Public_Sans'] uppercase tracking-wider">Aksi</div>
            </div>

            {/* Table Body */}
            <div className="min-h-64">
              {data.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">search_off</span>
                  <span className="text-sm font-['Public_Sans']">Tidak ada data pengurus yang ditemukan.</span>
                </div>
              ) : (
                data.map((pengurus, idx) => {
                  const isLastRows = data.length > 2 && idx >= data.length - 2;

                  return (
                    <div key={pengurus.id || idx} className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors relative ${openMenuId === pengurus.id ? 'z-50' : 'z-10'}`}>

                      {/* ID */}
                      <div className="w-32 shrink-0">
                        <span className="text-slate-500 text-sm font-mono">{pengurus.id_pengurus}</span>
                      </div>

                      {/* Profil: Nama + Satelit Asal */}
                      <div className="w-64 shrink-0 flex items-center gap-3">
                        <img
                          className="w-9 h-9 rounded-full object-cover border border-slate-200 flex-shrink-0"
                          src={pengurus.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pengurus.nama_lengkap)}&background=random`}
                          alt="avatar"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="text-slate-900 text-sm font-bold font-['Inter'] truncate">{pengurus.nama_lengkap}</span>
                          <span className="text-slate-400 text-xs font-['Public_Sans'] truncate">
                            📍 {pengurus.nama_satelit_asal || 'Belum ada satelit asal'}
                          </span>
                        </div>
                      </div>

                      {/* Jabatan Aktif — semua chip horizontal dari JSON array */}
                      <div className="flex-1 flex items-center gap-1.5 flex-wrap pr-4">
                        {(() => {
                          const list: { nama: string; label: string }[] = pengurus.jabatan_aktif_list ?? [];
                          if (list.length === 0) return <span className="text-slate-400 text-sm italic">Tidak ada jabatan aktif</span>;
                          return list.map((j, i) => (
                            <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-full border border-slate-200 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                              {j.label}
                            </span>
                          ));
                        })()}
                      </div>



                      {/* Status Global (pengurus.is_active) */}
                      <div className="w-32 shrink-0 flex justify-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-bold font-['Public_Sans'] uppercase ${
                          pengurus.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {pengurus.is_active ? 'Aktif' : 'Non-Aktif'}
                        </span>
                      </div>

                      {/* Aksi */}
                      <div className="w-20 shrink-0 flex justify-end gap-2 text-slate-400 relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === pengurus.id ? null : pengurus.id)}
                          className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors"
                        >
                          <span className="material-icons-round text-[24px]">more_horiz</span>
                        </button>
  
                        {openMenuId === pengurus.id && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                            <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-52 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 z-50 py-1 overflow-visible`}>
                              <Link
                                href={`/pengurus/${pengurus.id}?mode=view`}
                                className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-['Public_Sans']"
                              >
                                <span className="material-icons-round text-[18px] text-slate-400">visibility</span> Lihat Detail
                              </Link>
                              {hasPermission('pengurus_manage') && (
                                <Link
                                  href={`/pengurus/${pengurus.id}?mode=edit`}
                                  className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-['Public_Sans']"
                                >
                                  <span className="material-icons-round text-[18px] text-slate-400">edit</span> Edit / Kelola Jabatan
                                </Link>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

            </div>
          </div>
        </div>


        {/* Pagination Footer */}
        <div className="w-full px-6 py-4 bg-white border-t border-slate-200 flex flex-col md:flex-row justify-between items-center text-sm gap-4">
          <span className="text-slate-500 font-['Public_Sans']">
            Menampilkan {data.length > 0 ? ((currentPage - 1) * limit) + 1 : 0}-
            {Math.min(currentPage * limit, totalItems)} dari {totalItems} pengurus
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-9 h-9 rounded-lg border border-slate-200 flex justify-center items-center text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <span className="material-icons-round text-[18px]">chevron_left</span>
            </button>
            <span className="px-4 text-slate-700 font-bold">Halaman {currentPage} dari {totalPages}</span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalItems === 0}
              className="w-9 h-9 rounded-lg border border-slate-200 flex justify-center items-center text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <span className="material-icons-round text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      </div>

      <AlertModal
        isOpen={alertState.isOpen}
        title="Konfirmasi Perubahan Status"
        message={`Apakah Anda yakin ingin mengubah status pengurus menjadi ${alertState.newStatus}?`}
        onConfirm={confirmToggleStatus}
        onCancel={() => setAlertState({ isOpen: false, id: null, newStatus: '' })}
      />

      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        errors={submitState.errors}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />
    </div>
  );
}
