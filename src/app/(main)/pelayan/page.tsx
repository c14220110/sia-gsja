'use client';

import { useState, useEffect } from 'react';
import { useLoader } from '@/components/ui/GlobalLoader';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SubmitOverlay } from '@/components/ui/SubmitOverlay';
import { AlertModal } from '@/components/ui/AlertModal';

export default function PelayanPage() {
  const { showLoader, hideLoader } = useLoader();

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [submitState, setSubmitState] = useState<{ status: 'idle'|'loading'|'success'|'error', message: string, errors?: any }>({ status: 'idle', message: '' });
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const router = useRouter();

  // State untuk popup peringatan manis
  const [alertState, setAlertState] = useState<{ isOpen: boolean; id: number | null; newStatus: string }>({
    isOpen: false,
    id: null,
    newStatus: ''
  });

  // Data sesi siapa yang lagi buka halaman ini
  const [userData, setUserData] = useState<any>(null);

  // Kumpulan data pilihan buat dropdown-dropdown kita
  const [satelitOptions,     setSatelitOptions]     = useState<any[]>([]);
  const [rolePelayanOptions, setRolePelayanOptions] = useState<any[]>([]);

  // State halaman saat ini dan angka-angka statistiknya
  const [data,          setData]          = useState<any[]>([]);
  const [totalItems,    setTotalItems]    = useState(0);
  const [pelayanBaru,   setPelayanBaru]   = useState(0);
  const [menungguKonfirmasi, setMenungguKonfirmasi] = useState(0);
  const [currentPage,   setCurrentPage]   = useState(1);
  const limit = 10;

  // Filter saringan yang paling mendasar
  const [filterSatelit, setFilterSatelit] = useState('');
  const [filterRole,    setFilterRole]    = useState('');
  const [filterPending, setFilterPending] = useState(false);

  // Filter saringan lanjutan buat yang pengen lebih spesifik
  const [filterStatus,   setFilterStatus]   = useState('Aktif');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo,   setFilterDateTo]   = useState('');
  const [filterBulanJadwal, setFilterBulanJadwal] = useState('');

  // Nyimpen data filter lanjutan sementara (biar tombol Terapkan berfungsi sebagaimana mestinya)
  const [tempStatus,     setTempStatus]     = useState('Aktif');
  const [tempDateFrom,   setTempDateFrom]   = useState('');
  const [tempDateTo,     setTempDateTo]     = useState('');
  const [tempBulanJadwal, setTempBulanJadwal] = useState('');

  // Sedot data dropdown sama profil pengguna waktu halamannya pertama kali nongol
  useEffect(() => {
    const fetchOptionsAndUser = async () => {
      showLoader();
      try {
        const [resSatelit, resRole, resUser] = await Promise.all([
          fetch('/api/options?type=satelit'),
          fetch('/api/options?type=role_pelayan'),
          fetch('/api/auth/me'),
        ]);
        const satelitData = await resSatelit.json();
        const roleData    = await resRole.json();
        const authData    = resUser.ok ? await resUser.json() : null;

        if (satelitData.success) setSatelitOptions(satelitData.data);
        if (roleData.success)    setRolePelayanOptions(roleData.data);
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

  const hasPermission = (perm: string) => {
    if (!userData) return false;
    if (userData.is_super_admin) return true;
    return userData.permissions?.includes?.(perm);
  };

  // Beri sedikit waktu nafas pas ngetik pencarian biar server gak kewalahan
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Atur ulang posisinya ke halaman pertama tiap kali filternya diutak-atik
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, filterSatelit, filterRole, filterStatus, filterDateFrom, filterDateTo, filterBulanJadwal, filterPending]);

  // Tarik data besarnya dari belakang layar
  useEffect(() => {
    const fetchData = async () => {
      showLoader();
      try {
        const queryParams = new URLSearchParams();
        if (debouncedSearch) queryParams.append('search',     debouncedSearch);
        if (filterSatelit)   queryParams.append('satelit_id', filterSatelit);
        if (filterRole)      queryParams.append('role_id',    filterRole);
        if (filterStatus && filterStatus !== 'Semua') queryParams.append('status', filterStatus);
        if (filterDateFrom)  queryParams.append('date_from',  filterDateFrom);
        if (filterDateTo)    queryParams.append('date_to',    filterDateTo);
        if (filterBulanJadwal) queryParams.append('target_month', filterBulanJadwal);
        if (filterPending)   queryParams.append('pending_only', 'true');

        queryParams.append('limit',  limit.toString());
        queryParams.append('offset', ((currentPage - 1) * limit).toString());

        const res    = await fetch(`/api/pelayan?${queryParams.toString()}`);
        const result = await res.json();

        if (result.success) {
          setData(result.data);
          setTotalItems(result.meta.total);
          setPelayanBaru(result.meta.pelayan_baru   || 0);
          setMenungguKonfirmasi(result.meta.menunggu_konfirmasi || 0);
        }
      } catch (error) {
        console.error('Failed to fetch data', error);
      } finally {
        hideLoader();
      }
    };

    fetchData();
  }, [debouncedSearch, filterSatelit, filterRole, filterStatus, filterDateFrom, filterDateTo, filterBulanJadwal, filterPending, currentPage]);

  const handleToggleStatus = (id: number, currentStatus: string) => {
    const newStatus = currentStatus === 'Aktif' ? 'Tidak Aktif' : 'Aktif';
    setAlertState({ isOpen: true, id, newStatus });
  };

  const confirmToggleStatus = async () => {
    const { id, newStatus } = alertState;
    if (!id) return;
    setAlertState({ isOpen: false, id: null, newStatus: '' });

    try {
      setSubmitState({ status: 'loading', message: '' });
      const res = await fetch(`/api/pelayan/${id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status_pelayan: newStatus }),
      });
      const result = await res.json();
      if (result.success) {
        setData(prev => prev.map(p => p.id === id ? { ...p, status_pelayan: newStatus } : p));
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
          <h1 className="text-slate-900 text-3xl font-black font-sans leading-9 mb-1">Database Pelayan</h1>
          <div className="text-slate-500 text-base font-medium font-sans leading-6">Sistem Informasi Manajemen Data Pelayan</div>
        </div>
        <div className="flex gap-3">
          {hasPermission('pelayan_view') && (
            <Link href="/pelayan/roster" className="px-5 py-2.5 bg-white border border-slate-300 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
              <span className="material-icons-round text-slate-700 text-[20px]">calendar_month</span>
              <span className="text-slate-700 text-sm font-bold font-sans leading-5">Kalender Roster</span>
            </Link>
          )}
          {hasPermission('pelayan_manage') && (
            <Link href="/pelayan/new" className="px-5 py-2.5 bg-slate-700 rounded-lg flex justify-start items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm focus:ring-2 focus:ring-slate-500 focus:outline-none">
              <span className="material-icons-round text-white text-[20px]">add</span>
              <span className="text-white text-sm font-bold font-sans leading-5">Tambah Pelayan</span>
            </Link>
          )}
        </div>
      </div>

      {/* Statistic Cards */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Total Pelayan Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-slate-700/10 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-slate-700 text-3xl">volunteer_activism</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-sans uppercase tracking-wide">Total Pelayan</span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">{totalItems.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Pelayan Baru Card */}
        <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-slate-400/20 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-slate-700 text-3xl">person_add</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-sans uppercase tracking-wide leading-tight">
              Baru Bulan Ini
            </span>
            <div className="flex items-end gap-2 mt-1">
              <span className="text-slate-900 text-3xl font-bold font-sans leading-9">
                {pelayanBaru.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Menunggu Konfirmasi Card */}
        <div 
          onClick={() => setFilterPending(!filterPending)}
          className={`p-6 bg-white rounded-xl shadow-sm border flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer ${filterPending ? 'border-amber-500 ring-2 ring-amber-100' : 'border-slate-200'}`}
        >
          <div className="w-14 h-14 bg-amber-500/10 rounded-xl flex justify-center items-center">
            <span className="material-icons-round text-amber-600 text-3xl">pending_actions</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-500 text-sm font-medium font-sans uppercase tracking-wide leading-tight">Menunggu Konfirmasi</span>
            <div className="flex items-end gap-2 mt-1">
              <span className={`text-3xl font-bold font-sans leading-9 ${menungguKonfirmasi > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{menungguKonfirmasi.toLocaleString()}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Filter Options */}
      <div className="w-full px-4 py-4 bg-white rounded-xl border border-slate-200 flex flex-wrap items-center gap-4 shadow-sm">

        {/* Search Bar */}
        <div className="flex-1 min-w-[300px] relative flex items-center">
          <span className="material-icons-round absolute left-4 text-slate-400 text-[20px]">search</span>
          <input
            type="text"
            placeholder="Cari pelayan berdasarkan nama, ID jemaat, atau ID pelayanan..."
            className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Satelit Dropdown */}
        <div className="relative min-w-[200px]">
          <select
            value={filterSatelit}
            onChange={(e) => setFilterSatelit(e.target.value)}
            disabled={userData?.role_name?.toUpperCase().includes('SATELIT')}
            className={`appearance-none w-full pl-4 pr-10 py-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm ${
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

        {/* Role Dropdown */}
        <div className="relative min-w-[200px]">
          <select
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
          >
            <option value="">Semua Role</option>
            {rolePelayanOptions.map((role) => (
              <option key={role.id} value={role.id}>{role.nama_role}</option>
            ))}
          </select>
          <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
        </div>

        {/* More Filters Toggle */}
        <button
          onClick={() => {
            if (!showAdvancedFilters) {
              setTempStatus(filterStatus);
              setTempDateFrom(filterDateFrom);
              setTempDateTo(filterDateTo);
              setTempBulanJadwal(filterBulanJadwal);
            }
            setShowAdvancedFilters(!showAdvancedFilters);
          }}
          className={`px-4 py-2.5 border rounded-lg flex items-center gap-2 transition-colors group ${showAdvancedFilters ? 'bg-slate-100 border-slate-300' : (filterStatus !== 'Aktif' || filterDateFrom || filterDateTo || filterBulanJadwal) ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-white border-slate-200 hover:bg-slate-50'}`}
        >
          <span className={`material-icons-round text-[20px] transition-colors ${showAdvancedFilters ? 'text-slate-800' : (filterStatus !== 'Aktif' || filterDateFrom || filterDateTo || filterBulanJadwal) ? 'text-violet-700' : 'text-slate-500 group-hover:text-slate-700'}`}>tune</span>
          <span className={`text-sm font-medium font-sans transition-colors ${showAdvancedFilters ? 'text-slate-900' : (filterStatus !== 'Aktif' || filterDateFrom || filterDateTo || filterBulanJadwal) ? 'text-violet-700 font-bold' : 'text-slate-600 group-hover:text-slate-800'}`}>More Filters</span>
          {(filterStatus !== 'Aktif' || filterDateFrom || filterDateTo || filterBulanJadwal) && (
            <span className="flex items-center justify-center w-5 h-5 ml-1 bg-violet-600 text-white text-[10px] font-bold rounded-full">
              {(filterStatus !== 'Aktif' ? 1 : 0) + (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0) + (filterBulanJadwal ? 1 : 0)}
            </span>
          )}
        </button>
      </div>

      {/* Advanced Filter Collapse Layer */}
      {showAdvancedFilters && (
        <div className="w-full p-6 bg-white rounded-xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* 1. Status Pelayan */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-700 text-sm font-bold font-sans">Status Pelayan</label>
              <div className="relative">
                <select
                  value={tempStatus}
                  onChange={(e) => setTempStatus(e.target.value)}
                  className="appearance-none w-full pl-4 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm cursor-pointer"
                >
                  <option value="Semua">Semua</option>
                  <option value="Aktif">Aktif</option>
                  <option value="Tidak Aktif">Tidak Aktif</option>
                </select>
                <span className="material-icons-round absolute right-3 top-2.5 text-slate-400 pointer-events-none">expand_more</span>
              </div>
            </div>

            {/* 2. Bulan Mulai Bergabung (dari) */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-700 text-sm font-bold font-sans">Bergabung (Dari)</label>
              <input
                type="month"
                value={tempDateFrom}
                onChange={(e) => setTempDateFrom(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
              />
            </div>

            {/* 3. Bulan Mulai Bergabung (sampai) */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-700 text-sm font-bold font-sans">Bergabung (Sampai)</label>
              <input
                type="month"
                value={tempDateTo}
                onChange={(e) => setTempDateTo(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
              />
            </div>

            {/* 4. Target Bulan Jadwal */}
            <div className="flex flex-col gap-2">
              <label className="text-slate-700 text-sm font-bold font-sans">Filter Bulan Jadwal</label>
              <input
                type="month"
                value={tempBulanJadwal}
                onChange={(e) => setTempBulanJadwal(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-700 font-sans text-sm"
              />
            </div>
          </div>
          
          <div className="flex justify-end items-center gap-3 pt-4 border-t border-slate-100">
            <button
              onClick={() => {
                setTempStatus('Aktif');
                setTempDateFrom('');
                setTempDateTo('');
                setTempBulanJadwal('');
                setFilterStatus('Aktif');
                setFilterDateFrom('');
                setFilterDateTo('');
                setFilterBulanJadwal('');
                setCurrentPage(1);
                setShowAdvancedFilters(false);
              }}
              className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => {
                setFilterStatus(tempStatus);
                setFilterDateFrom(tempDateFrom);
                setFilterDateTo(tempDateTo);
                setFilterBulanJadwal(tempBulanJadwal);
                setCurrentPage(1);
                setShowAdvancedFilters(false);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-slate-800 rounded-lg hover:bg-slate-900 transition-colors shadow-sm"
            >
              Terapkan
            </button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <div className="w-full bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col relative z-0">
        <div className="w-full overflow-x-auto pb-4">
          <div className="min-w-[1200px] flex flex-col">
            {/* Table Header */}
            <div className="w-full bg-slate-50 border-b border-slate-200 flex items-center px-6 py-4">
              <div className="w-44 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">ID Pelayanan</div>
              <div className="w-64 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Nama Lengkap</div>
              <div className="w-36 shrink-0 text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Satelit</div>
              <div className="flex-1 min-w-[180px] text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Role Pelayanan</div>
              <div className="w-28 shrink-0 text-center text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Tgl. Mulai</div>
              <div className="w-28 shrink-0 text-center text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">
                {filterBulanJadwal ? `Jadwal (${filterBulanJadwal.split('-').reverse().join('/')})` : 'Jadwal Bln Ini'}
              </div>
              <div className="w-28 shrink-0 text-center text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Status</div>
              <div className="w-20 shrink-0 text-right text-slate-500 text-xs font-bold font-sans uppercase tracking-wider">Aksi</div>
            </div>

            {/* Table Body */}
            <div className="min-h-64">
              {data.length === 0 ? (
                <div className="w-full py-12 flex flex-col items-center justify-center text-slate-500">
                  <span className="material-icons-round text-5xl mb-2 text-slate-300">search_off</span>
                  <span className="text-sm font-sans">Tidak ada data pelayan yang ditemukan.</span>
                </div>
              ) : (
              data.map((pelayan, idx) => {
                const isLastRows = data.length > 2 && idx >= data.length - 2;
                const roles: string[] = pelayan.roles ? pelayan.roles.split(' • ').filter(Boolean) : [];
                return (
                  <div 
                    key={pelayan.id || idx} 
                    onClick={() => router.push(`/pelayan/${pelayan.id}?mode=view`)}
                    className={`w-full flex items-center px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition-colors relative cursor-pointer ${openMenuId === pelayan.id ? 'z-50' : 'z-10'}`}
                  >
                    <div className="w-44 shrink-0 flex flex-col">
                      <span className="text-slate-700 text-sm font-bold font-sans">{pelayan.id_pelayanan}</span>
                      <span className="text-slate-400 text-[11px] font-medium font-sans mt-0.5">JMT: {pelayan.jemaat_nomor || '-'}</span>
                    </div>
                    <div className="w-64 shrink-0 flex items-center gap-3">
                      <div 
                        className="relative group cursor-pointer shrink-0"
                        title="Lihat foto"
                        onClick={(e) => {
                          e.stopPropagation(); // Mencegah pindah halaman pas lagi asik nge-klik foto
                          setPreviewPhotoUrl(pelayan.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pelayan.nama_lengkap)}&background=random`);
                        }}
                      >
                        <img
                          className="w-11 h-11 rounded-full object-cover border border-slate-200 flex-shrink-0"
                          src={pelayan.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(pelayan.nama_lengkap)}&background=random`}
                          alt="avatar"
                        />
                        <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex justify-center items-center">
                          <span className="material-icons-round text-white text-[20px]">zoom_in</span>
                        </div>
                      </div>
                      <span className="text-slate-900 text-sm font-semibold font-sans w-full truncate pr-2">{pelayan.nama_lengkap}</span>
                    </div>
                    <div className="w-36 shrink-0 text-slate-600 text-sm font-sans truncate pr-2">{pelayan.nama_satelit || '-'}</div>
                    <div className="flex-1 min-w-[180px] flex flex-wrap gap-1 items-center py-1">
                      {roles.length > 0 ? (
                        <>
                          {roles.slice(0, 2).map((r, i) => (
                            <span key={i} className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded text-slate-700 text-[10px] font-bold font-sans uppercase whitespace-nowrap">
                              {r}
                            </span>
                          ))}
                          {roles.length > 2 && (
                            <span className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-slate-500 text-[10px] font-bold font-sans whitespace-nowrap">
                              +{roles.length - 2}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-slate-400 font-bold ml-1">-</span>
                      )}
                    </div>
                    <div className="w-28 shrink-0 flex flex-col justify-center gap-0.5">
                      <span className="text-slate-900 text-sm font-medium font-sans">
                        {pelayan.tanggal_mulai ? new Date(pelayan.tanggal_mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                      </span>
                    </div>
                    <div className="w-28 shrink-0 flex justify-center items-center">
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-slate-900 text-lg font-black font-sans">{pelayan.jadwal_bulan_ini || 0}</span>
                        <span className="text-slate-400 text-[10px] font-bold font-sans uppercase tracking-wider">Jadwal</span>
                      </div>
                    </div>
                    <div className="w-28 shrink-0 flex justify-center items-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold font-sans uppercase whitespace-nowrap ${pelayan.status_pelayan === 'Aktif' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {pelayan.status_pelayan}
                      </span>
                    </div>
                    <div className="w-20 shrink-0 flex justify-end gap-2 text-slate-400 relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation(); // Mencegah pindah halaman saat klik menu titik tiga
                          setOpenMenuId(openMenuId === pelayan.id ? null : pelayan.id);
                        }}
                        className="hover:text-slate-700 hover:bg-slate-100 p-1.5 rounded transition-colors"
                      >
                        <span className="material-icons-round text-[24px]">more_horiz</span>
                      </button>

                      {openMenuId === pelayan.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)}></div>
                          <div className={`absolute right-0 ${isLastRows ? 'bottom-full mb-1' : 'top-full mt-1'} w-52 bg-white rounded-lg shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)] border border-slate-200 z-50 py-1 overflow-visible`}>
                            <Link
                              href={`/pelayan/${pelayan.id}?mode=view`}
                              className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                            >
                              <span className="material-icons-round text-[18px] text-slate-400">visibility</span> Lihat Detail
                            </Link>
                            {hasPermission('pelayan_manage') && (
                              <>
                                <Link
                                  href={`/pelayan/${pelayan.id}?mode=edit`}
                                  className="w-full text-left px-4 py-2 hover:bg-slate-50 transition-colors flex items-center gap-3 text-sm text-slate-700 font-sans"
                                >
                                  <span className="material-icons-round text-[18px] text-slate-400">edit</span> Edit Data
                                </Link>
                                <div className="w-full h-px bg-slate-100 my-1"></div>
                                {pelayan.status_pelayan === 'Aktif' ? (
                                  <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); handleToggleStatus(pelayan.id, pelayan.status_pelayan); }} className="w-full text-left px-4 py-2 hover:bg-amber-50 hover:text-amber-700 transition-colors flex items-center gap-3 text-sm text-amber-600 font-sans">
                                    <span className="material-icons-round text-[18px] text-amber-400">person_off</span> Nonaktifkan
                                  </button>
                                ) : (
                                  <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); handleToggleStatus(pelayan.id, pelayan.status_pelayan); }} className="w-full text-left px-4 py-2 hover:bg-emerald-50 hover:text-emerald-700 transition-colors flex items-center gap-3 text-sm text-emerald-600 font-sans">
                                    <span className="material-icons-round text-[18px] text-emerald-400">person_add</span> Aktifkan
                                  </button>
                                )}
                              </>
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
          <span className="text-slate-500 font-sans">
            Menampilkan {data.length > 0 ? ((currentPage - 1) * limit) + 1 : 0}-
            {Math.min(currentPage * limit, totalItems)} dari {totalItems} pelayan
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
        title="Konfirmasi Perubahan Pelayan"
        message={`Apakah Anda yakin ingin mengubah status pelayan menjadi ${alertState.newStatus}?`}
        onConfirm={confirmToggleStatus}
        onCancel={() => setAlertState({ isOpen: false, id: null, newStatus: '' })}
      />

      <SubmitOverlay
        status={submitState.status}
        message={submitState.message}
        errors={submitState.errors}
        onClose={() => setSubmitState({ status: 'idle', message: '' })}
      />

      {/* Photo Preview Modal */}
      {previewPhotoUrl && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" 
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div className="relative max-w-2xl w-full p-4 flex flex-col items-center">
            <button 
              className="absolute top-0 right-0 m-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex justify-center items-center text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setPreviewPhotoUrl(null); }}
            >
              <span className="material-icons-round">close</span>
            </button>
            <img 
              src={previewPhotoUrl} 
              alt="Preview Pelayan" 
              className="max-h-[85vh] w-auto object-contain rounded-xl shadow-2xl border border-white/20 bg-white" 
              onClick={(e) => e.stopPropagation()} // Biar modalnya anteng gak ketutup tiba-tiba pas fotonya diklik
            />
          </div>
        </div>
      )}
    </div>
  );
}
